# Score Reporting Specification

## Purpose

Create a server-side RPC `get_distribucion_cohorte` that returns aggregated risk-level counts per career, and align the frontend service and dashboard to consume the aggregated shape instead of raw rows.

## Requirements

### Requirement 1: `get_distribucion_cohorte` RPC Returns Aggregated Counts

The system MUST provide a PostgreSQL function `get_distribucion_cohorte(p_carrera_id uuid)` that returns a single row with integer counts: `bajo`, `medio`, `alto`, `critico`.

Each count MUST represent the number of students in the given career whose latest `scores.nivel_riesgo` matches that level.

#### Scenario: RPC returns correct counts for a career with students at all levels

- GIVEN a career with 10 students: 4 `bajo`, 3 `medio`, 2 `alto`, 1 `critico`
- WHEN `get_distribucion_cohorte(carrera_id)` is called
- THEN the result MUST be `{ bajo: 4, medio: 3, alto: 2, critico: 1 }`

#### Scenario: RPC returns zeros for a career with no scores

- GIVEN a career with no rows in `scores`
- WHEN `get_distribucion_cohorte(carrera_id)` is called
- THEN the result MUST be `{ bajo: 0, medio: 0, alto: 0, critico: 0 }`

#### Scenario: RPC only counts students enrolled in the specified career

- GIVEN student A in career X with `nivel_riesgo = 'alto'`
- AND student B in career Y with `nivel_riesgo = 'alto'`
- WHEN `get_distribucion_cohorte(career_x_id)` is called
- THEN `alto` MUST be 1 (only student A)

### Requirement 2: `scoresService` Calls the RPC

The system MUST update `scoresService.getDistribucionCohorte` to call `.rpc('get_distribucion_cohorte', { p_carrera_id: carreraId })` instead of performing a raw `scores` table SELECT.

#### Scenario: Service returns aggregated shape

- GIVEN a valid `carreraId`
- WHEN `getDistribucionCohorte(carreraId)` is called
- THEN the returned data MUST have the shape `{ bajo: number, medio: number, alto: number, critico: number }`

### Requirement 3: `DashAdmin` Renders Real Counts

The system MUST update `DashAdmin` to consume the aggregated RPC response and compute KPIs without `NaN`.

#### Scenario: Dashboard displays correct total and risk counts

- GIVEN the RPC returns `{ bajo: 4, medio: 3, alto: 2, critico: 1 }`
- WHEN `DashAdmin` renders the KPI cards
- THEN `totalEstudiantes` MUST display `10`
- AND `numEnRiesgo` MUST display `3` (alto + critico)

#### Scenario: Dashboard distribution chart renders all four levels

- GIVEN the RPC returns counts for all four levels
- WHEN the distribution chart renders
- THEN the chart MUST display bars/segments for `bajo`, `medio`, `alto`, and `critico` with the correct values

#### Scenario: Dashboard handles zero-count response gracefully

- GIVEN the RPC returns `{ bajo: 0, medio: 0, alto: 0, critico: 0 }`
- WHEN `DashAdmin` renders
- THEN all KPIs MUST display `0` (not `NaN` or `undefined`)
