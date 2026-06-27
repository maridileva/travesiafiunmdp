# Survey Persistence Specification

## Purpose

Align the `preguntas` write/read path so the frontend writes to the correct columns (`valor_minimo`, `valor_maximo`, `descripcion`) and remove the legacy `escala_min`/`escala_max` columns.

## Requirements

### Requirement 1: Write Payload Uses New Column Names

The system MUST write question numeric range values to `preguntas.valor_minimo` and `preguntas.valor_maximo` (type `numeric`), NOT to `preguntas.escala_min` or `preguntas.escala_max`.

#### Scenario: EncuestaEditor saves a question with numeric range

- GIVEN an admin editing a survey question with `valor_minimo = 1` and `valor_maximo = 5`
- WHEN the admin clicks save
- THEN the `preguntas` row MUST have `valor_minimo = 1` and `valor_maximo = 5`
- AND the legacy columns `escala_min`/`escala_max` MUST NOT be written to

#### Scenario: EncuestaEditor saves a question with description

- GIVEN an admin editing a survey question with `descripcion = "Evaluate your experience"`
- WHEN the admin clicks save
- THEN the `preguntas` row MUST have `descripcion = 'Evaluate your experience'`

### Requirement 2: Read Path Uses New Column Names

The system MUST read question numeric range values from `preguntas.valor_minimo` and `preguntas.valor_maximo`. The `encuestasService.getEncuestaActiva` SELECT MUST reference these columns, not `escala_min`/`escala_max`.

#### Scenario: EncuestaEditor loads a question with numeric range

- GIVEN a `preguntas` row with `valor_minimo = 1` and `valor_maximo = 5`
- WHEN the EncuestaEditor fetches the survey
- THEN the editor MUST display `valor_minimo = 1` and `valor_maximo = 5`

#### Scenario: encuestasService SELECT does not reference legacy columns

- GIVEN the `encuestasService.getEncuestaActiva` query
- WHEN the query is executed
- THEN the SELECT MUST include `valor_minimo` and `valor_maximo`
- AND the SELECT MUST NOT include `escala_min` or `escala_max`

### Requirement 3: Legacy Columns Dropped

The system MUST drop `preguntas.escala_min` and `preguntas.escala_max` in migration `007_schema_fixes.sql`.

#### Scenario: Legacy columns no longer exist after migration

- GIVEN migration `007_schema_fixes.sql` has been applied
- WHEN querying `information_schema.columns` for `preguntas`
- THEN `escala_min` and `escala_max` MUST NOT appear

#### Scenario: Write to legacy column fails after migration

- GIVEN migration `007_schema_fixes.sql` has been applied
- WHEN a client attempts to insert with `escala_min = 1`
- THEN the database MUST reject the insert with a column-not-found error
