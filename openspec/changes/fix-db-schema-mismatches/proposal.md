# Proposal: Fix DB Schema ↔ Frontend Mismatches

## Intent

Supabase migrations (source of truth) and the React/TS frontend have drifted. The critical gap: **14 tables have RLS ENABLED but ZERO policies**, making them unreadable/unwritable for any `authenticated` client — the likely root cause of the "multiple bugs" reported. Further mismatches silently break survey scoring (`escala_min` legacy write path, missing aggregated score RPC) and violate a CHECK constraint on `cursadas.situacion`. The app is non-functional for end users until resolved.

## Scope

### In Scope
- Migration `007`: RLS policies for all 14 unprotected tables + `GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated`
- Migration `007` (same file): drop legacy `preguntas.escala_min/escala_max`, add missing CHECK constraints, expand realtime publication
- New RPC `get_distribucion_cohorte(carrera_id)` returning aggregated risk counts
- TS patches: `EncuestaEditor` write payload (`valor_minimo/valor_maximo` + `descripcion`), `encuestasService` SELECT, `Encuestas.tsx` situacion flow, `scoresService` + `DashAdmin` RPC consumption

### Out of Scope
- Edge functions `calcular-score` / `importar-alumnos` (no `supabase/functions/` dir) — separate change
- `scoringService.ts` stub implementation — separate change
- `EncuestaInicial.tsx` string-slug FK design issue — separate change
- `score_maximo` numeric/string typing, `materias.creditos` dead column, `carreras` timestamps — non-blocking

## Capabilities

> Contract for sdd-spec. No existing specs in `openspec/specs/`.

### New Capabilities
- `database-access-control`: RLS policies for 14 tables, `GRANT EXECUTE` on `is_admin()`, realtime publication expansion
- `survey-persistence`: `preguntas` write/read path (`valor_minimo/valor_maximo`, `descripcion`), drop legacy `escala_min/escala_max`
- `cursada-survey-flow`: `cursadas.situacion` CHECK alignment, `aprobada/desaprobada` routing to `progreso_estudiante`/`finales`
- `score-reporting`: `get_distribucion_cohorte` RPC + service/dashboard aggregation

### Modified Capabilities
- None

## Approach

Single additive migration `007_schema_fixes.sql` bundled with targeted TS patches — migrations are append-only (source-of-truth pattern). Order: migration first (unblocks reads), then TS fixes per capability, then RPC + dashboard last.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/007_schema_fixes.sql` | New | RLS policies, GRANT, drop legacy cols, CHECKs, realtime, RPC |
| `src/components/dashboards/EncuestaEditor.tsx` | Modified | Write payload + descripcion (#1, #8) |
| `src/components/dashboards/Encuestas.tsx` | Modified | situacion flow (#2) |
| `src/components/dashboards/DashAdmin.tsx` | Modified | Consume RPC aggregates (#4) |
| `src/services/encuestasService.ts` | Modified | SELECT new columns (#5) |
| `src/services/scoresService.ts` | Modified | Call RPC (#4) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| RLS policies lock out legit access if `is_admin()` lacks GRANT EXECUTE | Med | Add `GRANT EXECUTE` in same migration; verify `is_admin()` is `SECURITY DEFINER` |
| Dropping `escala_min/escala_max` breaks unknown downstream (views/edge fns) | Low | Grep confirms no in-repo consumer; migration reversible |
| `aprobada/desaprobada` fix changes data model — historical backfill needed | Med | Document migration; backfill only if prior broken data exists |
| RPC signature mismatch with TS consumer | Low | Define RPC + update service in same slice |

## Rollback Plan

Revert TS patches via git. Migration 007 is mostly additive (policies, GRANT, RPC, CHECKs) plus two `DROP COLUMN` statements: restore `escala_min/escala_max` from a pre-migration `pg_dump` of `preguntas`, then drop new policies/RPC. Provide `008_revert_schema_fixes.sql` if needed.

## Dependencies

- Supabase project must be linked to apply migration (currently local-only; repo not connected to a live project)

## Success Criteria

- [ ] All 14 tables have at least one RLS policy; `authenticated` clients read/write per role
- [ ] `GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated` present
- [ ] `EncuestaEditor` writes `valor_minimo/valor_maximo` + `descripcion`; legacy `escala_min/escala_max` dropped
- [ ] `Encuestas.tsx` no longer violates `cursadas.situacion` CHECK constraint
- [ ] `DashAdmin` KPIs render real counts (no `NaN`) via `get_distribucion_cohorte` RPC
- [ ] All CRITICAL (#1–#4) and WARNING (#5–#11) findings resolved; `tsc --noEmit` passes; app loads and core flows function
