# Database Access Control Specification

## Purpose

Restore read/write access for `authenticated` clients on all 14 tables that currently have RLS ENABLED but zero policies. Ensure `is_admin()` is callable by authenticated users and realtime publication covers tables used by live hooks.

## Requirements

### Requirement 1: RLS Policies for Unprotected Tables

The system MUST create at least one RLS policy on each of the 14 unprotected tables (`usuarios`, `estudiantes`, `correlativas`, `progreso_estudiante`, `cursadas`, `finales`, `sesiones_encuesta`, `respuestas`, `indicador_componentes`, `scores`, `asignaciones_tutor`, `alertas`, `intervenciones`, `entrevistas`).

Each policy MUST restrict access to the authenticated user's own data OR allow full access when `public.is_admin()` returns true.

#### Scenario: Authenticated student reads own row in `usuarios`

- GIVEN an authenticated user with `auth.uid()` = `U1`
- WHEN the user executes `SELECT * FROM usuarios WHERE id = 'U1'`
- THEN the query MUST return the row for `U1`

#### Scenario: Authenticated student cannot read another user's row

- GIVEN an authenticated user with `auth.uid()` = `U1`
- WHEN the user executes `SELECT * FROM usuarios WHERE id = 'U2'`
- THEN the query MUST return zero rows

#### Scenario: Admin user reads all rows

- GIVEN an authenticated user for whom `public.is_admin()` returns true
- WHEN the user executes `SELECT * FROM usuarios`
- THEN the query MUST return all rows

#### Scenario: Authenticated student writes own `respuestas`

- GIVEN an authenticated student with a valid `sesiones_encuesta` row owned by them
- WHEN the student inserts into `respuestas` referencing that session
- THEN the insert MUST succeed

#### Scenario: Authenticated student cannot write `respuestas` for another student's session

- GIVEN an authenticated student with `auth.uid()` = `U1`
- WHEN the student inserts into `respuestas` referencing a session owned by `U2`
- THEN the insert MUST be rejected by RLS

### Requirement 2: GRANT EXECUTE on `is_admin()`

The system MUST execute `GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated` in the same migration that creates the RLS policies.

#### Scenario: Authenticated user can call `is_admin()`

- GIVEN an authenticated user
- WHEN the user invokes `SELECT public.is_admin()`
- THEN the function MUST execute without a permission error

#### Scenario: RLS policy referencing `is_admin()` does not silently deny admin access

- GIVEN an admin user and a table with a policy `USING (id = auth.uid() OR public.is_admin())`
- WHEN the admin user queries the table
- THEN the query MUST return all rows (not zero rows due to missing GRANT)

### Requirement 3: Realtime Publication Expansion

The system MUST add `sesiones_encuesta`, `respuestas`, and `scores` to the `supabase_realtime` publication.

#### Scenario: Realtime subscription on `respuestas` receives changes

- GIVEN a client subscribed to `postgres_changes` on `respuestas`
- WHEN a new row is inserted into `respuestas`
- THEN the client MUST receive the change event

#### Scenario: Realtime subscription on `alertas` continues to work

- GIVEN a client subscribed to `postgres_changes` on `alertas` (already in publication)
- WHEN a new row is inserted into `alertas`
- THEN the client MUST continue to receive the change event (no regression)
