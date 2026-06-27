# Tasks: Fix DB Schema ↔ Frontend Mismatches

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250–320 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | N/A |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Low

---

## Phase 1: Database Migration — `007_schema_fixes.sql`

- [ ] 1.1 Create `supabase/migrations/007_schema_fixes.sql` with `GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated` as first statement
- [ ] 1.2 Add RLS policies for all 14 tables (`usuarios`, `estudiantes`, `correlativas`, `progreso_estudiante`, `cursadas`, `finales`, `sesiones_encuesta`, `respuestas`, `indicador_componentes`, `scores`, `asignaciones_tutor`, `alertas`, `intervenciones`, `entrevistas`) using pattern: own-row `USING (id = auth.uid() OR public.is_admin())` with `FOR ALL TO authenticated`
- [ ] 1.3 Add `ALTER PUBLICATION supabase_realtime ADD TABLE sesiones_encuesta, respuestas, scores`
- [ ] 1.4 Add `ALTER TABLE preguntas DROP COLUMN IF EXISTS escala_min, DROP COLUMN IF EXISTS escala_max` (column drop AFTER TS write fix ships in same slice)
- [ ] 1.5 Add `get_distribucion_cohorte(p_carrera_id uuid)` RPC returning `(bajo int, medio int, alto int, critico int)` as `SECURITY DEFINER STABLE` + `GRANT EXECUTE TO authenticated`
- [ ] 1.6 Add optional CHECK backfill for `cursadas.numero_cursada > 0`, `finales.numero_intento > 0`, `progreso_estudiante.nota_final BETWEEN 0 AND 10` (guarded, non-failing)
- [ ] 1.7 Verify `is_admin()` is `SECURITY DEFINER` in `001_rls_policies.sql` (confirm, no action if true)

## Phase 2: TS Type Definitions

- [ ] 2.1 Add `DistribucionCohorte` interface to `src/types/database.ts`: `{ bajo: number; medio: number; alto: number; critico: number }`
- [ ] 2.2 Verify no other consumer references `escala_min`/`escala_max` from `Pregunta` type (grep check)

## Phase 3: Survey Persistence — Write/Read Path Fix

- [ ] 3.1 Modify `src/components/dashboards/EncuestaEditor.tsx` lines ~245-246: change `escala_min`/`escala_max` to `valor_minimo`/`valor_maximo` in save payload; add `descripcion` field
- [ ] 3.2 Modify `src/services/encuestasService.ts` line ~14: change SELECT from `escala_min, escala_max` to `valor_minimo, valor_maximo, descripcion`
- [ ] 3.3 Verify `EncuestaEditor` read map (lines ~57-58) maps `valor_minimo`/`valor_maximo` correctly post-drop

## Phase 4: Cursada Survey Flow — Situacion Routing Fix

- [ ] 4.1 Modify `src/components/dashboards/Encuestas.tsx` lines ~80-101: split `aprobada`/`desaprobada` away from `guardarCursada` call
- [ ] 4.2 Implement routing: `aprobada`/`desaprobada` → insert `cursadas` row with `situacion='desaprobo'` (FK anchor) → insert `finales` with `resultado='aprobado'|'desaprobado'` → upsert `progreso_estudiante`
- [ ] 4.3 Ensure `promovio`/`habilito`/`abandono` still route to `guardarCursada` as before
- [ ] 4.4 Verify dropdown options do NOT include `aprobada`/`desaprobada` for cursada situacion

## Phase 5: Score Reporting — RPC + Dashboard

- [ ] 5.1 Modify `src/services/scoresService.ts`: replace raw `scores` SELECT with `.rpc('get_distribucion_cohorte', { p_carrera_id: carreraId }).single()`
- [ ] 5.2 Modify `src/components/dashboards/DashAdmin.tsx`: guard `distribucion` shape; coerce `NaN`→`0` for KPI math
- [ ] 5.3 Verify `totalEstudiantes` computes as `bajo + medio + alto + critico`; `numEnRiesgo` as `alto + critico`

## Phase 6: Rollback Script + Verification

- [ ] 6.1 Create `supabase/migrations/008_revert_schema_fixes.sql` with: `DROP FUNCTION`, `DROP POLICY` ×14, `REVOKE EXECUTE`, `ALTER PUBLICATION DROP TABLE`, restore `escala_min`/`escala_max` columns
- [ ] 6.2 Run `tsc --noEmit` — verify zero type errors
- [ ] 6.3 Run app against seeded DB — verify DashAdmin renders numeric KPIs (no NaN)
- [ ] 6.4 Verify survey flow: save question with `valor_minimo`/`valor_maximo` persists correctly
- [ ] 6.5 Verify cursada flow: `promovio` writes to cursadas; `aprobada` writes to finales + progreso_estudiante

---

**Total tasks: 22** | **Phases: 6** | **Estimated lines: 250–320**
