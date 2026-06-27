# Design: Fix DB Schema ↔ Frontend Mismatches

## Technical Approach

Single additive migration `007_schema_fixes.sql` bundles four fixes: RLS policies for 14 unprotected tables, `GRANT EXECUTE` on `is_admin()`, drop of legacy `preguntas.escala_min/escala_max`, realtime publication expansion, optional CHECK backfill, and the `get_distribucion_cohorte` RPC. Targeted TS patches follow per capability. Migration ordering: schema first (unblocks reads), then TS write/read fixes, then RPC + dashboard.

## Architecture Decisions

| # | Decision | Option / Alternative | Tradeoff |
|---|----------|----------------------|----------|
| 1 | Follow spec's "own-row OR admin" policy pattern | Existing repo uses "USING true SELECT + admin FOR ALL" on config tables | Stronger per-row isolation; diverges from existing config-table pattern but matches the security spec's intent and is appropriate for student-owned data |
| 2 | Add `GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated` in same migration | Ship in separate file | One file, atomic: policies referencing `is_admin()` work on first apply, no transient admin lockout |
| 3 | Single migration `007_schema_fixes.sql` for all four capabilities | Split per-capability migrations | Proposal commits to one file (append-only pattern); ordering within file matters, dependencies satisfied |
| 4 | `aprobada`/`desaprobada` route to `finales` + `progreso_estudiante`, not `cursadas` | Expand `cursadas.situacion` CHECK to include them | Spec requires split; keeps `cursadas` as the in-term-only state. `cursada_id` FK in `finales` requires a cursada row — see Data Flow |
| 5 | `get_distribucion_cohorte` as `SECURITY DEFINER STABLE` SQL function | Client-side aggregation of raw rows via existing service | Aggregation in DB avoids transferring all `scores` rows; `SECURITY DEFINER` bypasses RLS so admin dashboard sees all careers |
| 6 | Drop `escala_min/escala_max` AFTER TS write fix is shipped | Drop first | Defer column drop until TS no longer writes them to avoid transient write errors; but ship in same migration per spec — TS fix must land in the same change slice |

### Decision: `is_admin()` GRANT placement
**Choice**: Add `GRANT EXECUTE` at the TOP of `007_schema_fixes.sql`, before any policy referencing `is_admin()`.
**Alternatives**: Append at end.
**Rationale**: `is_admin()` is `SECURITY DEFINER` (confirmed in `001_rls_policies.sql:15`) but has no `GRANT EXECUTE` anywhere in migrations 000–006. Without the GRANT, every new policy using `is_admin()` silently denies admin access. Putting it first guarantees subsequent policies resolve correctly on first apply.

### Decision: `finales.cursada_id` FK constraint under split flow
**Choice**: When state is `aprobada`/`desaprobada`, insert a `cursadas` row with `situacion = 'desaprobo'` (final attempted) or a new neutral value, then insert `finales` referencing it.
**Alternatives**: Make `finales.cursada_id` nullable.
**Rationale**: `finales.cursada_id` is `NOT NULL` with `ON DELETE CASCADE`. Making it nullable is a schema change beyond this fix's scope. Simplest: insert cursada with a valid `situacion` ('desaprobo' is semantically correct for a final attempt), then the final. See Open Questions.

## Data Flow

### Cursada/Final split (Encuestas.tsx submit)

```
form.estado
  ├─ 'no_cursada'           → no write
  ├─ 'habilito'/'promovio'/'abandono'
  │     └─→ guardarCursada(situacion=estado)   → cursadas row
  └─ 'aprobada'/'desaprobada'
        ├─→ guardarCursada(situacion='desaprobo')  → cursadas row (FK anchor)
        ├─→ guardarFinal(resultado='aprobado'|'desaprobado', cursada_id)
        └─→ upsert progreso_estudiante(estado='aprobada'|'final_pendiente')
```

### Score aggregation (DashAdmin)

```
DashAdmin → useScore(carreraId) → scoresService.getDistribucionCohorte
  → supabase.rpc('get_distribucion_cohorte', { p_carrera_id })
  → returns { bajo, medio, alto, critico } (single row)
  → DashAdmin reads distribucion[0]
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/007_schema_fixes.sql` | Create | `GRANT EXECUTE`, 14× RLS policies, realtime expansion, DROP legacy cols, `get_distribucion_cohorte` RPC, optional CHECK backfill |
| `supabase/migrations/008_revert_schema_fixes.sql` | Create (optional) | Rollback: re-add cols, drop policies, drop RPC |
| `src/components/dashboards/EncuestaEditor.tsx` | Modify | Lines 245-246: write `valor_minimo`/`valor_maximo`; add `descripcion`; remove `escala_min`/`escala_max` write. Read map lines 57-58 already correct, but switch to new columns directly post-drop |
| `src/services/encuestasService.ts` | Modify | Line 14: SELECT `valor_minimo, valor_maximo, descripcion` instead of `escala_min, escala_max` |
| `src/components/dashboards/Encuestas.tsx` | Modify | Lines 80-101: split `aprobada`/`desaprobada` away from `guardarCursada.situacion`; route to `finales` + `progreso_estudiante` |
| `src/services/scoresService.ts` | Modify | `getDistribucionCohorte` → `.rpc('get_distribucion_cohorte', { p_carrera_id: carreraId }).single()` |
| `src/components/dashboards/DashAdmin.tsx` | Modify | Guard `distribucion` shape; coerce `NaN`→`0` for KPI math |
| `src/types/database.ts` | Modify | Add `DistribucionCohorte` interface `{ bajo, medio, alto, critico: number }` |

## Interfaces / Contracts

```ts
// src/types/database.ts (addition)
export interface DistribucionCohorte {
  bajo: number; medio: number; alto: number; critico: number;
}
```

```sql
-- 007_schema_fixes.sql (RPC core)
CREATE OR REPLACE FUNCTION public.get_distribucion_cohorte(p_carrera_id uuid)
RETURNS TABLE (bajo int, medio int, alto int, critico int)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COUNT(*) FILTER (WHERE s.nivel_riesgo = 'bajo')::int,
    COUNT(*) FILTER (WHERE s.nivel_riesgo = 'medio')::int,
    COUNT(*) FILTER (WHERE s.nivel_riesgo = 'alto')::int,
    COUNT(*) FILTER (WHERE s.nivel_riesgo = 'critico')::int
  FROM scores s
  JOIN estudiantes e ON e.usuario_id = s.estudiante_id
  WHERE e.carrera_id = p_carrera_id
    AND s.calculado_at = (
      SELECT MAX(s2.calculado_at) FROM scores s2
      WHERE s2.estudiante_id = s.estudiante_id
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_distribucion_cohorte(uuid) TO authenticated;
```

```sql
-- RLS pattern (per table). Example: respuestas
CREATE POLICY "respuestas_own_session" ON public.respuestas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM sesiones_encuesta s
                 WHERE s.id = respuestas.sesion_id AND s.estudiante_id = auth.uid())
         OR public.is_admin())
  WITH CHECK (EXISTS (SELECT 1 FROM sesiones_encuesta s
                 WHERE s.id = respuestas.sesion_id AND s.estudiante_id = auth.uid())
         OR public.is_admin());
```

## Migration Ordering and Dependencies

`007_schema_fixes.sql` internal order (each block idempotent / append-safe):

1. `GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated` — unblocks all following policies
2. RLS policies for 14 tables (own-row OR admin) — unblocks reads
3. `ALTER PUBLICATION supabase_realtime ADD TABLE sesiones_encuesta, respuestas, scores` — realtime
4. `ALTER TABLE preguntas DROP COLUMN IF EXISTS escala_min, DROP COLUMN IF EXISTS escala_max` — AFTER TS write fix lands in same slice
5. `get_distribucion_cohorte` RPC + `GRANT EXECUTE`
6. (Optional) CHECK backfill for `cursadas.numero_cursada > 0`, `finales.numero_intento > 0`, `progreso_estudiante.nota_final BETWEEN 0 AND 10` — guarded to not fail existing data

Dependencies: TS write fix (#4 in proposal order) must deploy before/at-same-time as column drop so no transient `column "escala_min" does not exist` errors in production. RPC and dashboard ship together to avoid shape mismatch.

## TS Type Changes

`database.ts`:
- Remove `escala_min`/`escala_max` from any `Pregunta`-derived type (already absent in current `Pregunta` interface — confirm no other consumer)
- Add `DistribucionCohorte`
- `scoresService.getDistribucionCohorte` return type → `DistribucionCohorte | null`

## Data Migration Strategy

- **RLS policies**: additive, no data motion. Existing service_role/owner access unaffected.
- **Legacy column drop**: `escala_min`/`escala_max` data is NOT migrated to `valor_minimo`/`valor_maximo`; they hold stale past writes while `valor_minimo`/`valor_maximo` are NULL for those rows. **Decision**: leave historical rows as-is (NULL min/max permitted). New/edited questions write correct columns. Document gap; no backfill needed since past rows are admin-authored test data per exploration.
- **`cursadas.situacion` CHECK backfill**: run a guarded `UPDATE cursadas SET situacion = 'desaprobo' WHERE situacion NOT IN ('promovio','habilito','desaprobo','abandono')` BEFORE adding the CHECK — but existing CHECK already exists (`000_base_de_datos.sql:107`), so any row violating it couldn't have inserted. **No backfill needed** — the constraint was always there; only the frontend was buggy. Buggy inserts would have failed at insert time, leaving zero invalid rows. Document this in migration comment.
- **`aprobada`/`desaprobada` historical data**: none exists in `cursadas` (inserts failed). No migration.

## Rollback Plan

1. **TS patches**: revert via git (clean, atomic).
2. **Migration 007**: provide `008_revert_schema_fixes.sql`:
   - `DROP FUNCTION IF EXISTS public.get_distribucion_cohorte(uuid);`
   - `DROP POLICY` for each of the 14 named policies
   - `REVOKE EXECUTE ON FUNCTION public.is_admin() FROM authenticated;`
   - `ALTER PUBLICATION supabase_realtime DROP TABLE sesiones_encuesta, respuestas, scores;`
   - Restore `escala_min`/`escala_max` from pre-migration `pg_dump` of `preguntas` (recommend `pg_dump -t preguntas` before applying 007)
3. **RPC**: dropping the function removes the dashboard aggregation path; dashboard falls back to `NaN` until `009` reintroduces a client-side fallback — acceptable for rollback window.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (SQL) | RLS denies other-user read, allows own + admin | `pgTAP` or manual SQL with `SET ROLE authenticated` + `request.jwt.claims` |
| Unit (SQL) | `is_admin()` callable by authenticated | `SET ROLE authenticated; SELECT public.is_admin();` returns bool |
| Unit (SQL) | `get_distribucion_cohorte` counts correct | Seed scores for 2 careers, verify counts and career isolation |
| Unit (SQL) | Drop of legacy cols + write to them fails | `INSERT INTO preguntas(... escala_min ...)` → error |
| Integration (TS) | `EncuestaEditor` save writes `valor_minimo/valor_maximo` + `descripcion` | Mock supabase, assert payload keys |
| Integration (TS) | `encuestasService.getEncuestaActiva` SELECT omits legacy cols | String assertion on query |
| Integration (TS) | `Encuestas.tsx` aprobada/desaprobada does not call `guardarCursada` with invalid situacion | Mock services, assert cursada situacion ∈ CHECK set |
| Integration (TS) | `scoresService.getDistribucionCohorte` calls `.rpc` | Assert `.rpc('get_distribucion_cohorte', ...)` |
| E2E | DashAdmin renders numeric KPIs (no NaN) | Run app against seeded DB, assert rendered counts |
| Type | `tsc --noEmit` passes | CI |

## Open Questions

- [ ] **`finales.cursada_id` anchor for aprobada/desaprobada split**: the FK is `NOT NULL`. Options: (a) insert a `cursadas` row with `situacion='desaprobo'` as the FK anchor (chosen default), (b) make `finales.cursada_id` nullable (schema change beyond this fix). Confirm product intent before applying.
- [ ] Confirm the hardcoded `carreraId` in `DashAdmin.tsx:32` is acceptable for now or should be parameterized (out of scope but flagged).
- [ ] Whether to ship optional CHECK backfill (Finding #11) in 007 or defer to 009. Current design includes it as guarded, optional block — confirm.

## Next Step

Ready for tasks (sdd-tasks).