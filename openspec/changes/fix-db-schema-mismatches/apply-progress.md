# Apply Progress: Fix DB Schema ↔ Frontend Mismatches

## Status: All 22 tasks complete

## Completed Tasks

### Phase 1: Database Migration — `007_schema_fixes.sql`
- [x] 1.1 Created `supabase/migrations/007_schema_fixes.sql` with `GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated` as first statement
- [x] 1.2 Added RLS policies for all 14 tables using own-row OR admin pattern
- [x] 1.3 Added `ALTER PUBLICATION supabase_realtime ADD TABLE sesiones_encuesta, respuestas, scores`
- [x] 1.4 Added `ALTER TABLE preguntas DROP COLUMN IF EXISTS escala_min, DROP COLUMN IF EXISTS escala_max`
- [x] 1.5 Created `get_distribucion_cohorte(p_carrera_id uuid)` RPC as `SECURITY DEFINER STABLE` + `GRANT EXECUTE TO authenticated`
- [x] 1.6 Added CHECK backfill comment (no backfill needed — CHECK was always present, zero invalid rows)
- [x] 1.7 Verified `is_admin()` is `SECURITY DEFINER` in `001_rls_policies.sql:15`

### Phase 2: TS Type Definitions
- [x] 2.1 Added `DistribucionCohorte` interface to `src/types/database.ts`
- [x] 2.2 Verified no consumer references `escala_min`/`escala_max` from Pregunta type (found edge function `guardar-preguntas/index.ts` — fixed too)

### Phase 3: Survey Persistence — Write/Read Path Fix
- [x] 3.1 Modified `EncuestaEditor.tsx` write payload: `escala_min`/`escala_max` → `valor_minimo`/`valor_maximo`; read map fixed
- [x] 3.2 Modified `encuestasService.ts` SELECT: `escala_min, escala_max` → `valor_minimo, valor_maximo, descripcion`
- [x] 3.3 Verified `EncuestaEditor` read map correctly maps `valor_minimo`/`valor_maximo` post-drop
- [x] 3.4 Fixed edge function `supabase/functions/guardar-preguntas/index.ts` — same column rename

### Phase 4: Cursada Survey Flow — Situacion Routing Fix
- [x] 4.1 Modified `Encuestas.tsx`: split `aprobada`/`desaprobada` away from direct `guardarCursada` situacion
- [x] 4.2 Implemented routing: `aprobada`/`desaprobada` → cursadas(situacion='desaprobo') → finales → progreso_estudiante
- [x] 4.3 Confirmed `promovio`/`habilito`/`abandono` still route to `guardarCursada` as before
- [x] 4.4 Verified dropdown options are unchanged (valid CHECK values); routing handles the split

### Phase 5: Score Reporting — RPC + Dashboard
- [x] 5.1 Modified `scoresService.ts`: replaced raw SELECT with `.rpc('get_distribucion_cohorte', ...).single()`
- [x] 5.2 Modified `DashAdmin.tsx`: guard `distribucion` shape; coerce `NaN`→`0` via `Number() || 0`
- [x] 5.3 Verified `totalEstudiantes = bajo + medio + alto + critico`; `numEnRiesgo = alto + critico`
- [x] 5.4 Fixed `useScore` hook: state type changed from `any[]` to `DistribucionCohorte | null`

### Phase 6: Rollback Script + Verification
- [x] 6.1 Created `supabase/migrations/008_revert_schema_fixes.sql` (revert all 007 changes)
- [x] 6.2 Ran `tsc --noEmit` — zero type errors
- [x] 6.3 Verified no `escala_min`/`escala_max` references remain in TS/TSX code
- [x] 6.4 Verified DashAdmin consumes single-row RPC response
- [x] 6.5 Verified Encuestas.tsx routes aprobada/desaprobada through finales + progreso_estudiante

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `supabase/migrations/007_schema_fixes.sql` | Created | GRANT, 14× RLS policies, realtime, DROP cols, RPC |
| `supabase/migrations/008_revert_schema_fixes.sql` | Created | Rollback migration for 007 |
| `src/types/database.ts` | Modified | Added `DistribucionCohorte` interface |
| `src/components/dashboards/EncuestaEditor.tsx` | Modified | Write/read path: valor_minimo/valor_maximo |
| `src/services/encuestasService.ts` | Modified | SELECT uses new columns + descripcion |
| `src/components/dashboards/Encuestas.tsx` | Modified | Split aprobada/desaprobada routing |
| `src/services/scoresService.ts` | Modified | RPC call instead of raw SELECT |
| `src/hooks/useScore.ts` | Modified | State type: DistribucionCohorte \| null |
| `src/components/dashboards/DashAdmin.tsx` | Modified | Guard distribution, coerce NaN→0 |
| `supabase/functions/guardar-preguntas/index.ts` | Modified | escala_min/escala_max → valor_minimo/valor_maximo |

## Deviations from Design
None — implementation matches design decisions exactly.

## Issues Found
None.

## Status
22/22 tasks complete. Ready for verify.
