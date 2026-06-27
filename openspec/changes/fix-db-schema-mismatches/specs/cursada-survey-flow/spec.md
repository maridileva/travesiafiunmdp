# Cursada Survey Flow Specification

## Purpose

Fix the `cursadas.situacion` CHECK constraint violation caused by the frontend sending `aprobada`/`desaprobada` values, and split the routing so these states write to `progreso_estudiante`/`finales` instead of `cursadas`.

## Requirements

### Requirement 1: `cursadas.situacion` Only Receives Valid Values

The system MUST ensure that writes to `cursadas.situacion` only use values from the CHECK constraint: `promovio`, `habilito`, `desaprobo`, `abandono`.

The frontend MUST NOT send `aprobada` or `desaprobada` to `cursadas.situacion`.

#### Scenario: User selects `promovio` in cursada dropdown

- GIVEN a user editing a cursada record
- WHEN the user selects `promovio` from the situacion dropdown
- AND saves the record
- THEN `cursadas.situacion` MUST be set to `'promovio'`
- AND the database MUST accept the write without a CHECK violation

#### Scenario: User selects `abandono` in cursada dropdown

- GIVEN a user editing a cursada record
- WHEN the user selects `abandono` from the situacion dropdown
- AND saves the record
- THEN `cursadas.situacion` MUST be set to `'abandono'`
- AND the database MUST accept the write

#### Scenario: Frontend does not offer `aprobada`/`desaprobada` for cursada situacion

- GIVEN the Encuestas.tsx cursada form
- WHEN the form renders the situacion dropdown
- THEN the dropdown options MUST NOT include `aprobada` or `desaprobada`

### Requirement 2: `aprobada`/`desaprobada` Routing to `progreso_estudiante` and `finales`

The system MUST route `aprobada` and `desaprobada` states to `progreso_estudiante.estado` and `finales.resultado` respectively, NOT to `cursadas.situacion`.

#### Scenario: User marks student as `aprobada`

- GIVEN a user reviewing a student's cursada outcome
- WHEN the user selects `aprobada`
- THEN the system MUST write to `progreso_estudiante` with the appropriate estado
- AND the system MUST write to `finales` with `resultado = 'aprobada'`
- AND the system MUST NOT write `aprobada` to `cursadas.situacion`

#### Scenario: User marks student as `desaprobada`

- GIVEN a user reviewing a student's cursada outcome
- WHEN the user selects `desaprobada`
- THEN the system MUST write to `progreso_estudiante` with the appropriate estado
- AND the system MUST write to `finales` with `resultado = 'desaprobada'`
- AND the system MUST NOT write `desaprobada` to `cursadas.situacion`

#### Scenario: Historical data with invalid situacion values

- GIVEN existing `cursadas` rows with `situacion` values outside the CHECK constraint (if any were inserted before the fix)
- WHEN the migration is applied
- THEN the system MUST NOT crash on existing data
- AND the migration SHOULD document whether backfill is needed
