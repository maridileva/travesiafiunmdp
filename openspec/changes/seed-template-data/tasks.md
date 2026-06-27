# Tasks: Seed Template Data

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350-450 (two files: ~180 + ~220) |
| 400-line budget risk | Medium (two files, each under 250) |
| Chained PRs recommended | No |
| Suggested split | Single PR (two independent migrations) |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Both migrations + verification | PR 1 | Single PR; two independent SQL files, no TS changes |

## Phase 1: Migration 009 — Carreras + Plan Estudios

- [ ] 1.1 Create `supabase/migrations/009_seed_carreras_materias.sql` with header comment block documenting idempotency strategy
- [ ] 1.2 Add `CREATE UNIQUE INDEX IF NOT EXISTS carreras_codigo_uniq ON public.carreras (codigo)` at top of file
- [ ] 1.3 Insert 10 carreras with `ON CONFLICT (codigo) DO NOTHING`: INF, COM, ELE, ELC, EMC, IND, MEC, QUI, ALI, MAT — canonical names from `planesdeestudio.md`
- [ ] 1.4 Insert ~55 materias for Informática Plan 2024: 1 ingreso (`ING0000`), 40 obligatorias (1°–5° año), 14 optativas (`tipo='electiva'`). Use `ON CONFLICT DO NOTHING` with subquery for `carrera_id`: `(SELECT id FROM carreras WHERE codigo = 'INF')`
- [ ] 1.5 Insert 55 `plan_estudios` rows linking each materia to Informática with correct `anio_teorico` (1–5), `cuatrimestre` (1–2), `tipo` (obligatoria/electiva). Use `ON CONFLICT (carrera_id, materia_id) DO NOTHING` with subqueries for FK resolution
- [ ] 1.6 Insert ~50 `correlativas` rows as `(materia_id, materia_requerida_id)` pairs. Optativas have zero correlativas. Use `ON CONFLICT (materia_id, materia_requerida_id) DO NOTHING` with subqueries. Verify `ING6201` (Programación A) has correlativas: `INGM101`, `INGM105`, `ING6102`

## Phase 2: Migration 010 — Indicadores + Encuestas

- [ ] 2.1 Create `supabase/migrations/010_seed_indicadores_encuestas.sql` with header comment documenting keyword contract for Edge Function substring matching
- [ ] 2.2 Add `CREATE UNIQUE INDEX IF NOT EXISTS` on `indicadores.nombre` and `categorias_pregunta.nombre` for idempotency
- [ ] 2.3 Insert 4 indicadores with deterministic UUIDs: Rendimiento Académico (40), Encuestas y Bienestar Emocional (35), Ralentización Académica (15), Alerta de Aislamiento (10). `ON CONFLICT (nombre) DO NOTHING`
- [ ] 2.4 Insert `indicador_componentes` rows (≥1 per indicador) with non-empty `formula` column. Use deterministic UUIDs, `ON CONFLICT (id) DO NOTHING`
- [ ] 2.5 Insert 5 `categorias_pregunta` rows with deterministic UUIDs: Emocional (30), Académico (25), Social (15), Económico (15), Motivacional (15). `ON CONFLICT (nombre) DO NOTHING`. Sum = 100
- [ ] 2.6 Insert 3 encuestas with deterministic UUIDs: inicial (activa=true), cuatrimestral (activa=true), entrevista (activa=false). `ON CONFLICT (id) DO NOTHING`
- [ ] 2.7 Insert `encuesta_secciones` rows: inicial=1 sección, cuatrimestral=3 secciones, entrevista=2 secciones. Deterministic UUIDs, `ON CONFLICT (id) DO NOTHING`
- [ ] 2.8 Insert `preguntas` rows for each sección with types: `unica`, `escala`, `numerica`, `texto`. Link via `seccion_id` (deterministic UUID). Set `categoria_id` FK. Use `valor_minimo`/`valor_maximo` columns (NOT `escala_min`/`escala_max`)
- [ ] 2.9 Insert `scoring_opciones` for `unica` preguntas with `opcion_valor` and `score` columns (NOT `puntaje`). Each links to `pregunta_id` and optionally `categoria_id`
- [ ] 2.10 Insert `scoring_tramos` for `escala`/`numerica` preguntas using actual schema: `condicion_tipo` (menor/mayor_igual/entre), `condicion_valor`/`condicion_valor_min`/`condicion_valor_max`, `formula`, `orden`. Cover full ranges (e.g., 1–10 for escala)
- [ ] 2.11 Add `GRANT SELECT ON indicadores TO authenticated` and `GRANT SELECT ON indicador_componentes TO authenticated` at end of file

## Phase 3: Verify

- [ ] 3.1 Run `supabase db reset` to apply all migrations 000→010 cleanly
- [ ] 3.2 Verify idempotency: run `supabase db reset` again, assert no errors and identical row counts
- [ ] 3.3 Verify `SELECT count(*) FROM carreras` = 10
- [ ] 3.4 Verify `SELECT count(*) FROM indicadores WHERE activo = true` = 4 and `sum(peso)` = 100
- [ ] 3.5 Verify `SELECT count(*) FROM encuestas` = 3, entrevista.activa = false
- [ ] 3.6 Verify Edge Function keyword contract: each indicador name contains expected substring (`académico`, `emocional`, `ralentizaci`, `aislamiento`)
- [ ] 3.7 Verify zero orphan rows in `correlativas` and `plan_estudios` FK joins
- [ ] 3.8 Run `tsc --noEmit` — must pass (no TS changes)
