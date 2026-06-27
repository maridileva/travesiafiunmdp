# Exploration: DB Schema ↔ Frontend TypeScript Mismatches

**Date**: 2026-06-27
**Scope**: Comprehensive audit of all `supabase/migrations/*.sql` against every `src/**/*.ts(x)` file
**Mode**: Read-only investigation (no code or SQL changed)

---

## Current State

The project has **7 migration files** (`000_base_de_datos.sql` through `006_schema_inicial.sql`) defining **22 tables** with full RLS scaffolding. The frontend uses **`@supabase/supabase-js` v2.106** with TypeScript services under `src/services/` and 16 dashboard components under `src/components/dashboards/`. The Migrations-as-source-of-truth pattern is in place (all changes append new files), but several inconsistencies between DB and TS code have accumulated.

**Note**: The `supabase_list_tables` MCP call returned no live tables — the local repo is not connected to a Supabase project, so the migrations are the schema source of truth.

---

## CRITICAL Findings

### 1. ❌ `EncuestaEditor.tsx` save payload writes to LEGACY columns `escala_min`/`escala_max` (was only fixed on READ)
- **Location**: `src/components/dashboards/EncuestaEditor.tsx:245-247`
- **Description**: The user fixed the **read** mapping (`fetchData`, lines 57-58: `valor_minimo: p.escala_min, valor_maximo: p.escala_max`) so the editor DISPLAYS the legacy columns under new field names. But the **write** payload still targets the old columns:
  ```ts
  if (preg.valor_minimo !== undefined) pPayload.escala_min = preg.valor_minimo;
  if (preg.valor_maximo !== undefined) pPayload.escala_max = preg.valor_maximo;
  ```
  Result: every save writes the numeric range to `preguntas.escala_min/escala_max` (legacy `int` columns) and leaves `valor_minimo/valor_maximo` (new `numeric` columns) as `NULL`. Any consumer that reads the new columns (e.g. the scoring engine, the Edge Function `calcular-score`) will see `NULL` and fall back to defaults — silently breaking numeric-question scoring.
- **Fix**: Change lines 245-246 to `pPayload.valor_minimo = preg.valor_minimo` / `pPayload.valor_maximo = preg.valor_maximo`. **Then drop the legacy columns** in a new migration:
  ```sql
  ALTER TABLE public.preguntas DROP COLUMN IF EXISTS escala_min;
  ALTER TABLE public.preguntas DROP COLUMN IF EXISTS escala_max;
  ```

### 2. ❌ `Encuestas.tsx` sends `aprobada`/`desaprobada` to `cursadas.situacion` — VIOLATES CHECK constraint
- **Location**: `src/components/dashboards/Encuestas.tsx:82-89`
- **Description**: The dropdown options (lines 185-192) include `'aprobada'` and `'desaprobada'`. The code passes `situacion: d.estado` directly to `guardarCursada`. But `cursadas.situacion` is constrained to `('promovio', 'habilito', 'desaprobo', 'abandono')` (migration `000_base_de_datos.sql:107`). The form values `'aprobada'`/`'desaprobada'` are NOT valid and will fail the CHECK constraint at insert time.
- **Fix**: Either (a) change the form values to match the constraint, or (b) treat `'aprobada'`/`'desaprobada'` differently — these belong in `progreso_estudiante.estado` and `finales.resultado`, not `cursadas.situacion`. Recommended: split the flow — if state is `aprobada`/`desaprobada` write only to `progreso_estudiante` + `finales`, not `cursadas`.

### 3. ❌ 14 tables have RLS ENABLED but ZERO policies
- **Location**: All migrations in `supabase/migrations/`
- **Description**: A table with RLS enabled and no policies is **unreadable and unwritable for everyone except `service_role` and table owners** — the opposite of what's intended for this app. Affected tables:
  - `usuarios` — line 19 of `000_base_de_datos.sql`
  - `estudiantes` — line 49
  - `correlativas` — line 84
  - `progreso_estudiante` — line 99
  - `cursadas` — line 119
  - `finales` — line 134
  - `sesiones_encuesta` — line 190
  - `respuestas` — line 202
  - `indicador_componentes` — line 224
  - `scores` — line 236
  - `asignaciones_tutor` — line 250
  - `alertas` — line 264
  - `intervenciones` — line 280
  - `entrevistas` — line 292
- **Impact**: This silently breaks almost every read/write flow. Examples: `useAuth` cannot read `usuarios`/`usuario_roles`, `usePlan` cannot read `progreso_estudiante`/`materias` via the join, `useAlertas` cannot subscribe to `alertas`, `useEncuesta` cannot read `sesiones_encuesta`/`respuestas`. The user reported "multiple bugs" — this is likely the root cause of many of them.
- **Fix**: Add a new migration `007_rls_missing_policies.sql` with policies for every table. At minimum: a `SELECT TO authenticated USING (true)` for public-reference data and a `FOR ALL TO authenticated USING (...) WITH CHECK (...)` per role. Critical baseline policies:
  ```sql
  -- usuarios: each user sees their own + admin sees all
  CREATE POLICY "users_see_own_or_admin" ON public.usuarios FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_admin());
  CREATE POLICY "users_update_own_or_admin" ON public.usuarios FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.is_admin());
  
  -- respuestas: only own session; admin sees all
  CREATE POLICY "respuestas_own_session" ON public.respuestas FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM sesiones_encuesta s WHERE s.id = respuestas.sesion_id AND s.estudiante_id = auth.uid())
       OR public.is_admin())
    WITH CHECK (EXISTS (SELECT 1 FROM sesiones_encuesta s WHERE s.id = respuestas.sesion_id AND s.estudiante_id = auth.uid())
       OR public.is_admin());
  -- (similar pattern for cursadas, finales, sesiones_encuesta, alertas, intervenciones, entrevistas,
  --  progreso_estudiante, asignaciones_tutor, scores, estudiantes, correlativas,
  --  indicador_componentes)
  ```

### 4. ❌ `getDistribucionCohorte` returns raw rows but `DashAdmin` expects aggregated counts
- **Location**: `src/services/scoresService.ts:21-29` ↔ `src/components/dashboards/DashAdmin.tsx:42-44`
- **Description**: `getDistribucionCohorte` does:
  ```ts
  supabase.from('scores').select('nivel_riesgo, estudiantes!inner (carrera_id)').eq(...)
  ```
  This returns one row per `scores` record, each with a `nivel_riesgo` STRING ('bajo'/'medio'/'alto'/'critico'). But `DashAdmin.tsx:43-44` reads:
  ```ts
  totalEstudiantes = dataRow.bajo + dataRow.medio + dataRow.alto + dataRow.critico;
  numEnRiesgo = dataRow.alto + dataRow.critico;
  ```
  There are no `bajo`/`medio`/`alto`/`critico` numeric columns. The dashboard will render `NaN` for every KPI and the distribution chart will be empty.
- **Fix**: Add an RPC function (e.g. `get_distribucion_cohorte(carrera_id uuid)`) in a new migration that returns `{ bajo int, medio int, alto int, critico int }` via `COUNT(*) FILTER (WHERE nivel_riesgo = ...)`. Then update the service to call `.rpc('get_distribucion_cohorte', { p_carrera_id: carreraId })`.

---

## WARNING Findings

### 5. ⚠ `encuestasService.getEncuestaActiva` still selects legacy columns
- **Location**: `src/services/encuestasService.ts:14`
- **Description**: The nested select still references `escala_min, escala_max` and `aplica_por_materia, peso_defecto`. The first two are LEGACY (see #1). This will keep working because the columns still exist in the DB, but it perpetuates the broken-naming situation. **Note**: the file in this repo ALSO has a critical bug — it never writes the `pregunta_id` correctly for nested edits (it uses `s.id` for sections but doesn't handle the case where sections are `isNew` — already a pre-existing issue, out of scope).
- **Fix**: Update line 14 to select `valor_minimo, valor_maximo` instead of `escala_min, escala_max`. Keep `aplica_por_materia` and `peso_defecto` (those are correct).

### 6. ⚠ Legacy `preguntas.escala_min/escala_max` columns should be dropped
- **Location**: `supabase/migrations/000_base_de_datos.sql:166-167`
- **Description**: After fixing #1, the legacy columns become dead weight. They will hold stale data from past saves and risk confusing future developers. The CHECK constraint and TypeScript types no longer reference them.
- **Fix**: Add `ALTER TABLE public.preguntas DROP COLUMN IF EXISTS escala_min, DROP COLUMN IF EXISTS escala_max;` to the same migration that adds the missing RLS policies.

### 7. ⚠ Edge functions `calcular-score` and `importar-alumnos` are referenced but never defined in migrations
- **Location**: `src/services/encuestasService.ts:163` and `src/services/scoresService.ts:32` and `src/components/dashboards/ImportarAlumnos.tsx:119`
- **Description**: These functions are `supabase.functions.invoke(...)` calls. No `supabase/functions/*/index.ts` exists in the repo. If they're not deployed, every survey completion and every CSV import will fail with a 404.
- **Fix**: Either (a) confirm these functions are deployed manually via the Supabase dashboard and document where, or (b) create local stubs in `supabase/functions/calcular-score/index.ts` and `supabase/functions/importar-alumnos/index.ts`. The `scoringService.ts` file is currently a 9-line stub with a TODO comment — this is a separate work item.

### 8. ⚠ `EncuestaEditor` does not save `preguntas.descripcion` despite DB column existing
- **Location**: `src/components/dashboards/EncuestaEditor.tsx:235-243` (`pPayload`)
- **Description**: The `pPayload` object does not include `descripcion`, even though the DB column exists (`000_base_de_datos.sql:163`) and the migration was supposedly updated. The user-fixed migration added the column but the editor never writes to it.
- **Fix**: Add `descripcion: preg.descripcion || null` to `pPayload`.

### 9. ⚠ Realtime publication may not include all tables that subscribe to it
- **Location**: `supabase/migrations/000_base_de_datos.sql:323-329`
- **Description**: Only `alertas` is added to `supabase_realtime`. But `useAlertas.ts:18-28` subscribes to `postgres_changes` on `alertas` only — that part is fine. However, if any future hook wants realtime on `respuestas` or `intervenciones`, it will fail silently because those tables aren't in the publication.
- **Fix**: Add `ALTER PUBLICATION supabase_realtime ADD TABLE sesiones_encuesta, respuestas, scores;` to the new RLS migration so future realtime hooks Just Work.

### 10. ⚠ `materias.creditos` is in DB but not used in planService
- **Location**: `supabase/migrations/000_base_de_datos.sql:60` ↔ `src/services/planService.ts:8`
- **Description**: `materias.creditos int` exists; the service select picks it up but no component reads it. Dead column. (Minor — leave for now or document.)
- **Fix**: Either use it in `DashPlanEstudiante.tsx` or drop it. Not blocking.

### 11. ⚠ CHECK constraints are missing for some text enums
- **Location**: Multiple tables
- **Description**: These text columns have no CHECK constraints and could be silently corrupted by bad data:
  - `cursadas.como_se_sintio` (text, no CHECK)
  - `cursadas.dedicacion` (text, no CHECK)
  - `cursadas.ritmo_estudio` (text, no CHECK)
  - `cursadas.numero_cursada` (int, no range CHECK — can be negative or 0)
  - `finales.numero_intento` (int, no range CHECK)
  - `scores.cuatrimestre` and `scores.anio` (ints, no range CHECK)
  - `progreso_estudiante.nota_final` (numeric(4,2), no range CHECK — should be 0-10)
- **Fix**: Add CHECK constraints in the new RLS migration, e.g. `CHECK (numero_cursada > 0)`, `CHECK (nota_final BETWEEN 0 AND 10)`. Lower priority — only matters if the app writes untrusted data.

---

## SUGGESTION Findings

### 12. 💡 `score_maximo` is `numeric(5,2)` in DB but `number` in TypeScript
- **Location**: `supabase/migrations/004_scoring_tablas.sql:8` ↔ `src/types/database.ts:13`
- **Description**: Supabase JS returns `numeric` columns as **strings** by default. Treating them as `number` will work in JS but cause subtle bugs in serialization and arithmetic. Better to type as `number` (after casting) or document the conversion.
- **Fix**: Either cast in the service (`Number(cat.score_maximo)`) or use a generated types file. Low priority.

### 13. 💡 `EncuestaInicial.tsx` passes string slugs as `respuesta.pregunta_id`
- **Location**: `src/components/dashboards/EncuestaInicial.tsx:64-67`
- **Description**: `guardarRespuesta(sessionId, 'horas_trabajo', formData.horas_trabajo)` — the second arg is `'horas_trabajo'`, a string slug. But `respuestas.pregunta_id` is a UUID with a FK to `preguntas(id)`. These slugs are not valid UUIDs and the FK constraint will reject them.
- **Fix**: This is a pre-existing design issue (the initial survey was hardcoded rather than schema-driven). Out of scope for the current fix, but should be flagged as a follow-up.

### 14. 💡 `scoringService.ts` is a stub
- **Location**: `src/services/scoringService.ts` (entire file is 9 lines, including 4 lines of comments)
- **Description**: All the question-scoring logic (tramos, opciones) is currently handled directly inside `EncuestaEditor.tsx` (the save flow). `getScoringsPorEncuesta` returns nothing.
- **Fix**: Implement or delete. Not blocking the current schema work.

### 15. 💡 `carreras` table lacks `descripcion` and timestamps
- **Location**: `supabase/migrations/000_base_de_datos.sql:21-25`
- **Description**: No `created_at`, no `descripcion`. Minor — usually only matters for audit. The `DashPlanAdmin.tsx` form only uses `nombre` and `codigo`, which exist.

---

## Affected Areas (summary of files)

| File | Issues |
|---|---|
| `src/components/dashboards/EncuestaEditor.tsx` | #1 (write to legacy), #8 (missing descripcion) |
| `src/components/dashboards/Encuestas.tsx` | #2 (CHECK violation) |
| `src/components/dashboards/DashAdmin.tsx` | #4 (consumes wrong shape) |
| `src/services/encuestasService.ts` | #5 (selects legacy cols) |
| `src/services/scoresService.ts` | #4 (returns wrong shape) |
| `src/services/scoringService.ts` | #14 (stub) |
| `supabase/migrations/000_base_de_datos.sql` | #3 (14 tables no policies), #6 (legacy cols), #9 (realtime limited), #11 (missing CHECKs), #15 (carreras no ts) |
| `supabase/migrations/001_rls_policies.sql` through `006_*` | #3 (no coverage for 14 tables) |
| `src/types/database.ts` | #12 (numeric typing) |

---

## Recommended Fix Order (proposal, not implemented)

1. **Migration 007**: Add RLS policies for all 14 unprotected tables (#3) — this alone will fix most user-reported bugs
2. **Migration 007 (same file)**: Drop `escala_min`/`escala_max` (#6) and add missing CHECKs (#11) and add more tables to realtime publication (#9)
3. **TS fix (EncuestaEditor.tsx)**: Update write payload to use new column names (#1) and add `descripcion` (#8)
4. **TS fix (encuestasService.ts)**: Update SELECT to use new column names (#5)
5. **TS fix (Encuestas.tsx)**: Fix the `situacion` value flow (#2)
6. **New RPC + service fix**: Add `get_distribucion_cohorte` RPC and update `scoresService` + `DashAdmin` (#4)
7. **Follow-up issues**: scoringService stub (#14), edge functions (#7), EncuestaInicial FK (#13), `score_maximo` typing (#12) — handle in separate change proposals

---

## Risks

- **High risk** if the RLS policies (#3) are added without testing: admin access via `public.is_admin()` requires the function to be `SECURITY DEFINER` AND to have `GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated`. The function definition is correct but no explicit `GRANT EXECUTE` exists in any migration — needs to be added.
- **High risk** if `escala_min`/`escala_max` are dropped (#6) before confirming no other consumer reads them. A grep confirms no other consumer, but downstream (e.g. views, edge functions) may exist outside the repo.
- **Medium risk** for the `Encuestas.tsx` flow (#2): fixing it changes the data model — a backfill of historical data may be needed if any surveys were already submitted with the broken values.

---

## Ready for Proposal

**Yes** — the audit is complete and the findings are concrete and actionable. The orchestrator should propose a change named `fix-db-schema-mismatches` with these findings, prioritizing #1, #3, and #4 as the top three fixes that unblock the most user flows.
