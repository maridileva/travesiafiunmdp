# indicadores-template Specification

## Purpose

Seed the 4-pillar scoring indicadores so the `calcular-score` Edge Function finds them by substring match instead of falling back to hardcoded 40/35/15/10 defaults. Includes `indicador_componentes` with formulas matching Edge Function expectations and proper GRANT permissions.

## Requirements

### Requirement: Indicador Seed Rows with Keyword Contract

The system MUST insert exactly 4 rows into `indicadores` with names containing the exact keywords the `calcular-score` Edge Function matches by substring:

| Name | peso | activo | Keyword matched |
|------|------|--------|-----------------|
| `Rendimiento Académico` | 40 | true | `académico` |
| `Encuestas y Bienestar Emocional` | 35 | true | `emocional` |
| `Ralentización Académica` | 15 | true | `ralentización` |
| `Alerta de Aislamiento` | 10 | true | `aislamiento` |

Names MUST NOT be renamed — the Edge Function uses `nombre.toLowerCase().includes(keyword)`.

#### Scenario: All 4 indicadores exist

- GIVEN migration 010 applied
- WHEN querying `SELECT count(*) FROM indicadores WHERE activo = true`
- THEN the result MUST equal 4

#### Scenario: Edge Function substring match succeeds

- GIVEN the seeded indicadores
- WHEN the `calcular-score` function queries `nombre LIKE '%académico%'`
- THEN exactly 1 row MUST be returned (`Rendimiento Académico`)

#### Scenario: Weights sum to 100%

- GIVEN the seeded indicadores
- WHEN computing `SELECT sum(peso) FROM indicadores`
- THEN the result MUST equal 100

### Requirement: Indicador Componentes with Formulas

The system MUST insert `indicador_componentes` rows with formulas matching Edge Function expectations. Each componente links to its parent indicador and defines how sub-scores are calculated.

#### Scenario: Componentes exist for each indicador

- GIVEN migration 010 applied
- WHEN joining `indicador_componentes` ⋈ `indicadores`
- THEN each of the 4 indicadores MUST have at least 1 componente row

#### Scenario: Component formulas are non-empty

- GIVEN the seeded indicador_componentes
- WHEN querying `SELECT count(*) FROM indicador_componentes WHERE formula IS NULL OR formula = ''`
- THEN the result MUST equal 0

### Requirement: GRANT SELECT to Authenticated

The system MUST execute `GRANT SELECT ON indicadores TO authenticated` and `GRANT SELECT ON indicador_componentes TO authenticated` so the Edge Function and client queries can read these tables.

#### Scenario: Authenticated role can read indicadores

- GIVEN migration 010 applied
- WHEN an `authenticated` role queries `SELECT 1 FROM indicadores LIMIT 1`
- THEN the query MUST succeed without permission errors

#### Scenario: Authenticated role can read indicador_componentes

- GIVEN migration 010 applied
- WHEN an `authenticated` role queries `SELECT 1 FROM indicador_componentes LIMIT 1`
- THEN the query MUST succeed without permission errors

### Requirement: Migration Idempotency

All INSERT statements in migration 010 for indicadores and indicador_componentes MUST use `ON CONFLICT DO NOTHING`. GRANT statements are inherently idempotent. Re-applying MUST NOT raise errors.

#### Scenario: Double apply produces same state

- GIVEN migration 010 applied once
- WHEN re-applied via `supabase db reset`
- THEN row counts and permissions MUST remain identical
