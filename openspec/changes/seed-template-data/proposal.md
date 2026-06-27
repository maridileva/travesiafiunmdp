# Proposal: Seed Template Data

## Intent

The app ships **completely empty**: 22 schema tables exist but zero rows are seeded. `DashPlanAdmin` shows its empty-state, `DashEncuestasAdmin` shows "No hay encuestas todavía", and the `calcular-score` Edge Function falls back to hardcoded 40/35/15/10 defaults because it finds no `indicadores`. We seed canonical template data (carreras, Informática plan, indicadores, encuesta templates) so a fresh DB reset gives a ready-to-use admin experience without manual inserts.

## Scope

### In Scope
- Two **idempotent** SQL migrations only (no TS changes):
  - `009_seed_carreras_materias.sql` — 10 carreras, 55 materias for Informática Plan 2024, 55 `plan_estudios` rows, ~50 `correlativas` rows
  - `010_seed_indicadores_encuestas.sql` — 4 indicadores, 5 `categorias_pregunta`, 3 encuestas, ~10 secciones, ~25 preguntas, ~50 `scoring_opciones`, ~5 `scoring_tramos`
- `ON CONFLICT DO NOTHING` on all inserts (safe re-apply)
- Optional `supabase/011_revert_seed_template_data.sql` mirroring the `008` revert convention

### Out of Scope
- `EncuestaInicial.tsx` slug-as-UUID bug (separate change `fix-encuesta-inicial-slugs`)
- Detailed subjects for the other 9 carreras (no source data available)
- `indicador_componentes` rows (Edge Function ignores this table)
- `usuarios`, `estudiantes`, `progreso_estudiante`, `scores`, `alertas` (per-deployment runtime data)

## Capabilities

> No `openspec/specs/` exist yet — all are new capabilities.

### New Capabilities
- `carreras-data-template`: 10 FIUNMdP engineering carreras + Informática Plan 2024 (materias, plan_estudios, correlativas) as seed rows
- `indicadores-template`: 4 default indicadores with exact names matching `calcular-score` substring lookup (`académico`, `emocional`, `ralentización`, `aislamiento`)
- `encuesta-templates`: 3 template encuestas (inicial, cuatrimestral, entrevista) with secciones, preguntas, categorías, and scoring (opciones + tramos)

### Modified Capabilities
None (no existing specs).

## Approach

**Approach 4 from exploration: split by table ownership.** Two independent migrations, each ~150-220 lines (well under the 400-line review budget). Migration 009 ships admin plan management; 010 ships admin survey management — both are independently functional, no forward FK references. Idempotent inserts (`ON CONFLICT DO NOTHING`) so a re-applied reset never breaks.

Indicador names MUST keep keywords (`Rendimiento Académico`, `Encuestas y Bienestar Emocional`, `Ralentización Académica`, `Alerta de Aislamiento`) — the Edge Function matches by substring and silently falls back to hardcoded defaults otherwise.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/009_seed_carreras_materias.sql` | New | Carreras + Informática plan + correlativas seed |
| `supabase/migrations/010_seed_indicadores_encuestas.sql` | New | Indicadores + categorias + encuesta templates seed |
| `supabase/011_revert_seed_template_data.sql` | New (optional) | Revert in reverse FK order |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `calcular-score` substring match breaks if names renamed | Medium | Add SQL comment block in 010 stating the keyword contract |
| Two encuestas of same `tipo` active → `getEncuestaActiva` 500 | Medium | Seed `entrevista.activa = false`; only inicial + cuatrimestral active |
| EncuestaInicial.tsx slug bug still broken after seed | High (pre-existing) | Out of scope; flagged for separate change. Schema is correct. |

## Rollback Plan

Apply `supabase/011_revert_seed_template_data.sql` (drop-insert in reverse FK order): clear preguntas → secciones → encuestas → categorias → indicadores → correlativas → plan_estudios → materias → carreras. Alternatively `supabase db reset` (drops ALL migrations and reapplies from 000) — re-runs 009+010 cleanly because of idempotency.

## Dependencies

- Existing migrations 000–007 (schema source of truth)
- `supabase/docs/planesdeestudio.md` (carreras + Informática data source)
- `EXPLICACION_SCORE.md` (4-pillar scoring model + weights)

## Success Criteria

- [ ] `supabase db reset` applies 009 + 010 cleanly with no errors
- [ ] `DashPlanAdmin` shows "Ingeniería en Informática" with 55 materias
- [ ] `Configuración` page shows all 4 indicadores with weights summing to 100% (40+35+15+10)
- [ ] `EncuestaEditor` shows 3 template encuestas with preguntas and scoring options
- [ ] `getEncuestaActiva('cuatrimestral').single()` returns 1 row (no 500)
- [ ] `calcular-score` finds 4 indicadores by substring (no fallback to hardcoded defaults)
- [ ] `tsc --noEmit` still passes (no TS changes)