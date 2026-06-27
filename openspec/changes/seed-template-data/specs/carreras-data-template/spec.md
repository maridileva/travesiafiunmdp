# carreras-data-template Specification

## Purpose

Seed canonical FIUNMdP carrera data so `DashPlanAdmin` ships with 10 careers and a complete Ingeniería en Informática Plan 2024 (subjects, study-plan links, and prerequisite chains). All inserts MUST be idempotent.

## Requirements

### Requirement: Carrera Seed Rows

The system MUST insert exactly 10 rows into `carreras` with unique `codigo` values: `INF`, `COM`, `ELE`, `ELC`, `EMC`, `IND`, `MEC`, `QUI`, `ALI`, `MAT`. Each row MUST use the canonical name from `supabase/docs/planesdeestudio.md`. `ELE` maps to Ingeniería Electrónica; `ELC` maps to Ingeniería Eléctrica (disambiguation).

#### Scenario: All 10 carreras exist after migration

- GIVEN a fresh database after `supabase db reset`
- WHEN querying `SELECT count(*) FROM carreras`
- THEN the result MUST equal 10

#### Scenario: Carrera codes are unique and correct

- GIVEN the seeded `carreras` table
- WHEN querying `SELECT codigo, nombre FROM carreras ORDER BY codigo`
- THEN each of the 10 codes (`INF`, `COM`, `ELE`, `ELC`, `EMC`, `IND`, `MEC`, `QUI`, `ALI`, `MAT`) MUST appear exactly once with its canonical name

#### Scenario: Idempotent re-apply

- GIVEN the migration 009 has already been applied
- WHEN the migration is re-applied (e.g. via `supabase db reset`)
- THEN no duplicate rows are created and no errors occur (`ON CONFLICT DO NOTHING`)

### Requirement: Materias for Informática Plan 2024

The system MUST insert approximately 55 rows into `materias` covering: 1 ingreso subject (`ING0000`), 40 obligatory subjects across 5 años, and 14 optativas (`tipo='electiva'`). Each materia MUST have a unique `codigo` following the `ING####` convention.

#### Scenario: Informática materias count

- GIVEN migration 009 applied
- WHEN counting materias linked to Informática via `plan_estudios`
- THEN the count MUST be approximately 55 (±2 for optativas variance)

#### Scenario: Optativas are electiva type

- GIVEN the seeded materias for Informática
- WHEN filtering `tipo = 'electiva'`
- THEN exactly 14 optativas MUST be returned, all in 5° año / 2° cuatrimestre

### Requirement: Plan Estudios Links

The system MUST insert one `plan_estudios` row per materia linking it to the Informática carrera (`carrera_id` FK) with correct `anio_teorico` (1–5), `cuatrimestre` (1–2), and `tipo` (`obligatoria` or `electiva`). Ingreso (`ING0000`) maps to año 1, cuatrimestre 1.

#### Scenario: Plan estudios links all materias

- GIVEN migration 009 applied
- WHEN joining `plan_estudios` ⋈ `materias` for Informática
- THEN every materia MUST have exactly one `plan_estudios` row with valid `anio_teorico` and `cuatrimestre`

#### Scenario: Ingreso subject placement

- GIVEN the seeded plan_estudios
- WHEN looking up materia `ING0000`
- THEN `anio_teorico` = 1 AND `cuatrimestre` = 1 AND `tipo` = 'obligatoria'

### Requirement: Correlativas Dependency Graph

The system MUST insert approximately 50 rows into `correlativas` mapping `(materia_id, correlativa_id)` pairs. Each row represents "materia_id requires correlativa_id as a prerequisite." Optativas MUST NOT have correlativas.

#### Scenario: Correlativas reference valid materias

- GIVEN migration 009 applied
- WHEN joining `correlativas` ⋈ `materias` on both FK columns
- THEN zero orphan rows MUST exist (all FKs resolve)

#### Scenario: Programming A has correct prerequisites

- GIVEN the seeded correlativas
- WHEN querying prerequisites for `ING6201` (Programación A)
- THEN the result MUST include `INGM101`, `INGM105`, and `ING6102`

#### Scenario: Optativas have no prerequisites

- GIVEN the seeded correlativas
- WHEN querying for correlativas of any optativa (14 electiva materias)
- THEN zero rows MUST be returned

### Requirement: Migration Idempotency

All INSERT statements in migration 009 MUST use `ON CONFLICT DO NOTHING` on primary key or unique constraints. Re-applying the migration MUST NOT raise errors or create duplicate data.

#### Scenario: Double apply produces same row counts

- GIVEN migration 009 applied once
- WHEN recording row counts, applying again, and comparing
- THEN all row counts MUST be identical before and after the second apply
