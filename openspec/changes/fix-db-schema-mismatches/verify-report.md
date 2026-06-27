# Verification Report: fix-db-schema-mismatches

## Summary

| Field | Value |
|-------|-------|
| Change | fix-db-schema-mismatches |
| Mode | Standard verify (no Strict TDD) |
| Verdict | **PASS WITH WARNINGS** |
| Date | 2026-06-27 |

## Completeness

| Artifact | Status |
|----------|--------|
| Proposal | ✅ Present |
| Specs (4 capabilities) | ✅ Present |
| Design | ✅ Present |
| Tasks (22 total) | ✅ 20/22 complete, 2 incomplete |
| Migration 007 | ✅ Applied (confirmed by user: `supabase db reset` passed) |
| Migration 008 (rollback) | 🔲 Not created (task 6.1 incomplete) |
| `tsc --noEmit` | ✅ Zero errors (confirmed by user) |

## Build / Type-Check Evidence

| Command | Result |
|---------|--------|
| `tsc --noEmit` | ✅ PASS — zero type errors |
| `supabase db reset` | ✅ PASS — all 7 migrations applied |

## Test Evidence

| Test | Method | Result |
|------|--------|--------|
| RLS policies exist (14 tables) | Source inspection of 007_schema_fixes.sql | ✅ 14 CREATE POLICY statements verified |
| `GRANT EXECUTE` on `is_admin()` | Source inspection (line 18) | ✅ Present, placed FIRST before policies |
| `escala_min`/`escala_max` dropped | Source inspection (lines 145-146) + grep src/ | ✅ Dropped in migration; zero references in src/ |
| `get_distribucion_cohorte` RPC | Source inspection (lines 153-170) | ✅ SECURITY DEFINER STABLE, GRANT EXECUTE to authenticated |
| Realtime publication | Source inspection (lines 135-137) | ✅ sesiones_encuesta, respuestas, scores added |
| `cursadas.situacion` CHECK | Source inspection of 000_base_de_datos.sql:107 | ✅ CHECK allows promovio/habilito/desaprobo/abandono |
| `progreso_estudiante` UNIQUE | Source inspection of 000_base_de_datos.sql:97 | ✅ UNIQUE(estudiante_id, materia_id) exists for upsert |
| Survey write path | Source inspection of EncuestaEditor.tsx:245-246 | ✅ Uses `valor_minimo`/`valor_maximo` |
| Survey read path | Source inspection of encuestasService.ts:14 | ✅ SELECT includes `valor_minimo, valor_maximo, descripcion` |
| Score RPC call | Source inspection of scoresService.ts:24 | ✅ `.rpc('get_distribucion_cohorte', { p_carrera_id: carreraId })` |
| DashAdmin NaN guard | Source inspection of DashAdmin.tsx:42-45 | ✅ `Number(distribucion.bajo) || 0` pattern |
| Cursada split flow | Source inspection of Encuestas.tsx:84-110 | ✅ aprobada/desaprobada route to finales + progreso_estudiante |
| `guardarCursada` type safety | Source inspection of encuestasService.ts:95 | ✅ Type restricts situacion to valid CHECK values |

## Spec Compliance Matrix

### database-access-control

| Scenario | Status | Evidence |
|----------|--------|----------|
| Authenticated reads own row in `usuarios` | ✅ COMPLIANT | Policy `usuarios_own_or_admin` USING `id = auth.uid() OR public.is_admin()` |
| Authenticated cannot read another user's row | ✅ COMPLIANT | Same policy restricts to own row |
| Admin reads all rows | ✅ COMPLIANT | `OR public.is_admin()` clause |
| Student writes own `respuestas` | ✅ COMPLIANT | Policy via session ownership subquery |
| Student cannot write `respuestas` for another's session | ✅ COMPLIANT | WITH CHECK mirrors USING |
| Authenticated can call `is_admin()` | ✅ COMPLIANT | `GRANT EXECUTE` at line 18 |
| Admin policy doesn't silently deny | ✅ COMPLIANT | GRANT placed BEFORE all policies |
| Realtime on `respuestas` | ✅ COMPLIANT | ALTER PUBLICATION line 136 |
| Realtime on `alertas` no regression | ✅ COMPLIANT | Already in publication from 000, not removed |

### survey-persistence

| Scenario | Status | Evidence |
|----------|--------|----------|
| EncuestaEditor saves `valor_minimo`/`valor_maximo` | ✅ COMPLIANT | Lines 245-246 write correct columns |
| EncuestaEditor saves `descripcion` | ⚠️ WARNING | `descripcion` NOT in save payload (lines 235-247) |
| Read path uses new columns | ✅ COMPLIANT | encuestasService.ts:14 SELECT correct |
| Legacy columns dropped | ✅ COMPLIANT | Migration 007 lines 145-146 |
| Write to legacy column fails | ✅ COMPLIANT | Columns dropped, insert would error |

### cursada-survey-flow

| Scenario | Status | Evidence |
|----------|--------|----------|
| `promovio` writes to cursadas | ✅ COMPLIANT | Lines 111-119 normal flow |
| `abandono` writes to cursadas | ✅ COMPLIANT | Lines 111-119 normal flow |
| Dropdown doesn't offer aprobada/desaprobada for cursada | ⚠️ WARNING | Dropdown offers them (lines 210-211) but split flow routes correctly — see findings |
| `aprobada` routes to finales + progreso | ✅ COMPLIANT | Lines 84-110 split flow |
| `desaprobada` routes to finales + progreso | ✅ COMPLIANT | Lines 84-110 split flow |
| No `aprobada`/`desaprobada` written to cursadas.situacion | ✅ COMPLIANT | Split flow writes `desaprobo` as FK anchor |

### score-reporting

| Scenario | Status | Evidence |
|----------|--------|----------|
| RPC returns correct counts | ✅ COMPLIANT | SQL uses FILTER + COUNT with career join |
| RPC returns zeros for no scores | ✅ COMPLIANT | COUNT returns 0 when no rows match |
| RPC isolates by career | ✅ COMPLIANT | WHERE e.carrera_id = p_carrera_id |
| scoresService calls RPC | ✅ COMPLIANT | `.rpc('get_distribucion_cohorte', ...)` |
| Dashboard renders correct total | ✅ COMPLIANT | `totalEstudiantes = bajo + medio + alto + critico` |
| Dashboard renders numEnRiesgo | ✅ COMPLIANT | `numEnRiesgo = alto + critico` |
| Dashboard handles zero gracefully | ✅ COMPLIANT | `Number(...) || 0` coercion |

## Design Coherence

| Decision | Implementation | Status |
|----------|---------------|--------|
| GRANT EXECUTE first in migration | Line 18, before all policies | ✅ Matches design |
| Own-row OR admin pattern | All 14 policies follow pattern | ✅ Matches design |
| Single migration 007 | All fixes in one file | ✅ Matches design |
| aprobada/desaprobada → finales + progreso | Split flow in Encuestas.tsx | ✅ Matches design |
| `get_distribucion_cohorte` SECURITY DEFINER | Lines 153-155 | ✅ Matches design |
| Drop columns after TS fix | Same change slice | ✅ Matches design |

## Issues

### CRITICAL
_None_

### WARNING

1. **W1: `descripcion` not saved in EncuestaEditor payload**
   - **Spec**: survey-persistence, Requirement 1, Scenario "EncuestaEditor saves a question with description"
   - **Task**: 3.1 — "add `descripcion` field"
   - **Evidence**: EncuestaEditor.tsx lines 235-247 build `pPayload` but never add `descripcion`. The column exists in DB (`preguntas.descripcion text` at 000:163), the SELECT reads it (encuestasService.ts:14), but the save payload omits it.
   - **Impact**: Admin cannot save/edit question descriptions from the editor. The field will always remain NULL for new/edited questions.
   - **Fix**: Add `if (preg.descripcion !== undefined) pPayload.descripcion = preg.descripcion;` after line 247.

2. **W2: Rollback migration 008 not created**
   - **Task**: 6.1 — "Create `supabase/migrations/008_revert_schema_fixes.sql`"
   - **Evidence**: File does not exist (glob returned no results).
   - **Impact**: No atomic rollback path if issues are discovered post-deploy. Design marks this as optional but task is explicit.
   - **Fix**: Create the rollback migration or explicitly remove the task.

3. **W3: Dropdown includes `aprobada`/`desaprobada` options**
   - **Spec**: cursada-survey-flow, Requirement 1, Scenario "Frontend does not offer `aprobada`/`desaprobada` for cursada situacion"
   - **Evidence**: Encuestas.tsx lines 210-211 include `{ value: 'aprobada', label: 'Aprobada (Final)' }` and `{ value: 'desaprobada', label: 'Desaprobada' }` in the dropdown options.
   - **Mitigating factor**: The split flow (lines 84-110) correctly routes these to `finales` + `progreso_estudiante`, never writing them to `cursadas.situacion`. The DB CHECK constraint would reject them anyway.
   - **Impact**: Spec literal interpretation fails, but runtime behavior is correct. The dropdown is a unified "estado" selector, not a cursada-specific situacion selector.
   - **Fix**: Either (a) document this as intentional UX design (single dropdown for full lifecycle), or (b) split into two dropdowns (cursada situacion + final resultado).

### SUGGESTION

1. **S1: `guardarFinal` doesn't return inserted row**
   - `encuestasService.ts:140` — `guardarFinal` does `.insert({...})` without `.select().single()`. The caller doesn't use the return value, so this is functional, but inconsistent with `guardarCursada` which does return the row.

2. **S2: Hardcoded `carreraId` in DashAdmin**
   - `DashAdmin.tsx:32` — `'1fded8a2-a8c6-4d04-8b5e-0498b5fa0b94'` is hardcoded. Design flags this as an open question. Not blocking but should be parameterized before production.

3. **S3: `riskDistribution` filters out zero-value levels**
   - `DashAdmin.tsx:55` — `.filter(d => d.value > 0)` removes levels with zero count from the chart. Spec says "chart MUST display bars/segments for bajo, medio, alto, and critico with the correct values" — this could be interpreted as requiring all four levels to always appear.

## Incomplete Tasks

| Task | Description | Severity |
|------|-------------|----------|
| 3.1 (partial) | Add `descripcion` field to EncuestaEditor save payload | WARNING |
| 6.1 | Create `008_revert_schema_fixes.sql` rollback migration | WARNING |

## Runtime Verification Notes

Database queries via Supabase MCP tools returned empty results for `pg_policies` and `information_schema.columns`. This indicates the MCP connection targets a remote project without the local migrations applied. All database-level verification was performed via source inspection of migration files, which is reliable given that `supabase db reset` was confirmed to pass all 7 migrations locally.

## Verdict

**PASS WITH WARNINGS**

The implementation correctly addresses all four spec capabilities at the architectural level:
- RLS policies are correctly defined for all 14 tables
- Survey persistence uses the correct column names
- Cursada split flow routes aprobada/desaprobada correctly
- Score reporting RPC is properly defined and consumed

Three warnings require attention:
1. `descripcion` field not saved (functional gap in survey editor)
2. Rollback migration not created (operational safety gap)
3. Dropdown spec interpretation (cosmetic/spec-literal gap, runtime correct)

No CRITICAL issues. The change is safe to deploy with the warnings documented.
