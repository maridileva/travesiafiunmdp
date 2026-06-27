# encuesta-templates Specification

## Purpose

Seed 3 template encuestas (inicial, cuatrimestral, entrevista) with their full structure — secciones, preguntas, categorías, scoring opciones, and scoring tramos — so `DashEncuestasAdmin` and `EncuestaEditor` ship with ready-to-use survey templates.

## Requirements

### Requirement: Three Encuesta Types Seeded

The system MUST insert exactly 3 rows into `encuestas`:

| Tipo | Activa | Título |
|------|--------|--------|
| `inicial` | true | Encuesta de Ingreso |
| `cuatrimestral` | true | Encuesta Cuatrimestral |
| `entrevista` | false | Encuesta de Entrevista (template) |

Only ONE encuesta per `tipo` MUST be active. `entrevista` MUST be inactive to prevent `getEncuestaActiva` (`.single()`) from throwing.

#### Scenario: Exactly 3 encuestas exist

- GIVEN migration 010 applied
- WHEN querying `SELECT count(*) FROM encuestas`
- THEN the result MUST equal 3

#### Scenario: Active constraint — one per tipo

- GIVEN the seeded encuestas
- WHEN querying `SELECT tipo, count(*) FROM encuestas WHERE activa = true GROUP BY tipo`
- THEN each tipo with `activa = true` MUST have exactly 1 row

#### Scenario: Entrevista is inactive

- GIVEN the seeded encuestas
- WHEN querying `SELECT activa FROM encuestas WHERE tipo = 'entrevista'`
- THEN `activa` MUST be `false`

### Requirement: Encuesta Secciones with Preguntas

Each encuesta MUST have `encuesta_secciones` rows with ordered `preguntas`. Preguntas MUST have valid types: `unica` (single-choice), `escala` (numeric scale), `numerica` (numeric input), or `texto` (free text). Each pregunta MUST link to its sección via `seccion_id` FK.

#### Scenario: Secciones exist for each encuesta

- GIVEN migration 010 applied
- WHEN joining `encuesta_secciones` ⋈ `encuestas`
- THEN `inicial` MUST have 1 sección, `cuatrimestral` MUST have 3 secciones, `entrevista` MUST have 2 secciones

#### Scenario: Preguntas link to valid secciones

- GIVEN the seeded preguntas
- WHEN joining `preguntas` ⋈ `encuesta_secciones`
- THEN zero orphan rows MUST exist

### Requirement: Categorías Pregunta with Score Máximo

The system MUST insert 5 rows into `categorias_pregunta`:

| Nombre | score_maximo | Color |
|--------|--------------|-------|
| Emocional | 30 | #EC4899 |
| Académico | 25 | #3B82F6 |
| Social | 15 | #10B981 |
| Económico | 15 | #F59E0B |
| Motivacional | 15 | #8B5CF6 |

Sum of `score_maximo` MUST equal 100 (matching the 0–100 bienestar scale).

#### Scenario: Five categorías exist

- GIVEN migration 010 applied
- WHEN querying `SELECT count(*) FROM categorias_pregunta WHERE activa = true`
- THEN the result MUST equal 5

#### Scenario: Score máximo sums to 100

- GIVEN the seeded categorias_pregunta
- WHEN computing `SELECT sum(score_maximo) FROM categorias_pregunta`
- THEN the result MUST equal 100

### Requirement: Scoring Opciones for Multiple-Choice Preguntas

Preguntas of type `unica` MUST have `scoring_opciones` rows with `puntaje` values for risk calculation. Each opción links to its pregunta and a `categoria_pregunta` (except texto preguntas which have no scoring).

#### Scenario: Scoring opciones exist for unica preguntas

- GIVEN the seeded preguntas of type `unica`
- WHEN joining `scoring_opciones` ⋈ `preguntas`
- THEN every `unica` pregunta MUST have at least 2 opciones

#### Scenario: Horario trabajo opciones have correct puntajes

- GIVEN the inicial encuesta's "¿Cuántas horas semanales trabajás?" pregunta
- WHEN querying its scoring_opciones ordered by puntaje
- THEN opciones MUST include: `No trabajo` (0), `Hasta 10 horas` (5), `10 a 20 horas` (10), `Más de 20 horas` (15)

### Requirement: Scoring Tramos for Numeric Preguntas

Preguntas of type `escala` or `numerica` MUST have `scoring_tramos` rows defining numeric ranges (`valor_minimo`, `valor_maximo`) with a `formula` for risk calculation. Each tramo links to its pregunta and a `categoria_pregunta`.

#### Scenario: Escala pregunta has tramos

- GIVEN the cuatrimestral encuesta's "rendimiento" escala pregunta (1–10)
- WHEN querying its scoring_tramos
- THEN at least 3 tramos MUST exist covering the full 1–10 range

#### Scenario: Tramos have valid numeric ranges

- GIVEN the seeded scoring_tramos
- WHEN querying `SELECT count(*) FROM scoring_tramos WHERE valor_minimo >= valor_maximo`
- THEN the result MUST equal 0 (min < max for all tramos)

### Requirement: Migration Idempotency

All INSERT statements in migration 010 MUST use `ON CONFLICT DO NOTHING`. Re-applying MUST NOT raise errors or create duplicate data.

#### Scenario: Double apply produces same state

- GIVEN migration 010 applied once
- WHEN re-applied via `supabase db reset`
- THEN all row counts MUST remain identical
