# Design: Seed Template Data

## Technical Approach

Two idempotent SQL migrations seed canonical template data so a fresh `supabase db reset` yields a ready-to-use admin with zero manual inserts. Migration 009 seeds the academic plan domain (`carreras` → `materias` → `plan_estudios` → `correlativas`); 010 seeds the scoring/survey domain (`indicadores` → `indicador_componentes` → `categorias_pregunta` → `encuestas` → `encuesta_secciones` → `preguntas` → `scoring_opciones`/`scoring_tramos`). Both depend only on the existing schema (migrations 000–007); no forward FK references between the two files, so each ships independently.

Idempotency is the central constraint. All inserts use `ON CONFLICT DO NOTHING`. Because most target tables have only a surrogate UUID PK (no natural unique key), re-apply safety requires **deterministic UUID literals** for every `id` we insert — a re-run supplies the same UUID, hits the PK conflict, and is a no-op. `materias`, `plan_estudios`, and `correlativas` instead rely on their existing natural UNIQUE constraints (`(carrera_id, codigo)`, `(carrera_id, materia_id)`, `(materia_id, materia_requerida_id)`), so they resolve FK UUIDs via subqueries at insert time.

## Architecture Decisions

### Decision: Deterministic UUIDs for PK-only tables

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Let `uuid_generate_v4()` assign IDs | Non-deterministic → re-apply creates duplicate rows | Rejected |
| Deterministic UUID literals per row | Stable PK → `ON CONFLICT (id) DO NOTHING` is a true no-op | **Chosen** |

**Rationale**: `encuestas`, `encuesta_secciones`, `preguntas`, `scoring_opciones`, `scoring_tramos`, `categorias_pregunta`, `indicadores`, `indicador_componentes` have no natural unique constraint. Random UUIDs would make `db reset` re-runs duplicate data. We hand-author UUIDv4-format literals (documented in a header comment block per migration).

### Decision: Add UNIQUE on `carreras.codigo`

**Choice**: `CREATE UNIQUE INDEX IF NOT EXISTS carreras_codigo_uniq ON public.carreras (codigo);` at the top of 009, then `ON CONFLICT (codigo) DO NOTHING`.
**Alternatives**: deterministic UUID + `ON CONFLICT (id)` (rejected — `ImportarAlumnos.tsx` CSV validation already treats `codigo` as the lookup key; codifying uniqueness is a sensible integrity gain).
**Rationale**: The schema has no unique constraint on `carreras.codigo`, so `ON CONFLICT (codigo)` is impossible today. The index is additive, low-risk, and matches the app's existing assumption.

### Decision: Resolve FK UUIDs via subqueries, not literals

**Choice**: `(SELECT id FROM public.carreras WHERE codigo = 'INF')` and `(SELECT id FROM public.materias WHERE codigo = 'ING6201')` inside `plan_estudios` / `correlativas` inserts.
**Rationale**: materias IDs are random UUIDs (`uuid_generate_v4()`); we don't control them. Subqueries keep the SQL readable and decoupled from the UUID literals. `materias` carries `carrera_id` (NOT NULL), so every Informática materia subqueries the INF carrera row.

### Decision: Seed `indicador_componentes` (vs proposal's "skip")

**Choice**: Seed ≥1 `indicador_componentes` row per indicador with non-empty `formula`.
**Alternatives**: skip (proposal noted Edge Function ignores the table).
**Rationale**: The delta spec `indicadores-template` requires it and the task brief mandates it. The Edge Function not reading it today doesn't preclude the admin UI surfacing it; seeding keeps the data model coherent.

### Decision: Follow actual `scoring_tramos` schema, not spec prose

**Choice**: Use `condicion_tipo` (`menor`/`mayor_igual`/`entre`) + `condicion_valor`/`condicion_valor_min`/`condicion_valor_max` + `formula` + `orden`.
**Alternatives**: spec prose says `valor_minimo/valor_maximo` — those columns don't exist on `scoring_tramos`.
**Rationale**: Match migration 004's real DDL; spec wording is aspirational. Ranges are encoded as `entre` with min/max or as `menor`/`mayor_igual` thresholds.

## Data Flow

```
009:  carreras ──► materias ──► plan_estudios ──► correlativas
          │            │            │                  │
          └─ UNIQUE    └─ (carrera, └─ (carrera,       └─ (materia,
             on codigo     codigo)       materia)         materia_requerida)

010:  indicadores ──► indicador_componentes
          │
          ▼
      categorias_pregunta ◄── pregunta.categoria_id
          │
          ▼
      encuestas ──► encuesta_secciones ──► preguntas ──► scoring_opciones
                                                   └──► scoring_tramos
```

All 010 inserts use deterministic UUID literals; FK columns cross-reference the same literals (e.g. `preguntas.seccion_id` = the section's literal UUID).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/009_seed_carreras_materias.sql` | Create | UNIQUE idx on `carreras.codigo`; 10 carreras; ~55 Informática materias; 55 `plan_estudios`; ~50 `correlativas`. All `ON CONFLICT DO NOTHING`. |
| `supabase/migrations/010_seed_indicadores_encuestas.sql` | Create | UNIQUE idx on `categorias_pregunta.nombre` + `indicadores.nombre`; 4 indicadores; ≥4 componentes; 5 categorías; 3 encuestas; ~6 secciones; ~13 preguntas; ~40 `scoring_opciones`; ~8 `scoring_tramos`. GRANT SELECT (redundant/idempotent). |

## Interfaces / Contracts

Keyword contract (010 header comment): indicador names MUST retain substrings `académico`, `emocional` (or `encuesta`), `ralentizaci`, `aislamiento` — `calcular-score/index.ts:130-140` matches by `nombre.toLowerCase().includes(...)`. Renaming silently falls back to hardcoded 40/35/15/10.

| Indicador (exact name) | peso | keyword |
|------------------------|------|---------|
| `Rendimiento Académico` | 40 | `académico` |
| `Encuestas y Bienestar Emocional` | 35 | `emocional` |
| `Desempeño / Ralentización` | 15 | `ralentizaci` |
| `Alerta de Aislamiento` | 10 | `aislamiento` |

Carreras codes: `INF, COM, ELE, ELC, EMC, IND, MEC, QUI, ALI, MAT` (`ELE`=Electrónica, `ELC`=Eléctrica). Materia codes: `ING####` (Ingreso `ING0000`).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| SQL | Idempotency | Apply 009+010 twice; assert row counts identical (per spec scenarios) |
| SQL | FK integrity | Zero orphans across `correlativas`/`plan_estudios` joins |
| Integration | Edge Function match | `calcular-score` finds 4 indicadores by substring (no default fallback) |
| Integration | Admin UI | `DashPlanAdmin` shows Informática w/ 55 materias; `DashEncuestasAdmin` shows 3 surveys |
| Regression | `getEncuestaActiva('cuatrimestral').single()` | Returns exactly 1 row, no 500 |
| Type | `tsc --noEmit` | No TS changes → still passes |

## Migration / Rollout

`supabase db reset` reapplies 000→010; idempotency makes re-runs safe. Manual revert (optional, not built here): drop-insert in reverse FK order. No feature flags needed.

## Open Questions

- [ ] Confirm exact Indicador #3 name: "Desempeño / Ralentización" (brief) vs "Ralentización Académica" (exploration/spec) — both satisfy the `ralentizaci` substring; brief chosen pending confirmation.
- [ ] Should `encuesta_entrevista` ship `activa=false` (spec) — yes, to protect `getEncuestaActiva` `.single()`.