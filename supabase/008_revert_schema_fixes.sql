-- =========================================================================
-- Migration 008: Revert 007_schema_fixes.sql
-- =========================================================================
-- Rolls back all changes from 007 in reverse order.
-- Restore escala_min/escala_max columns first (re-adds them as NULL).
-- =========================================================================

-- 1. Drop the RPC
DROP FUNCTION IF EXISTS public.get_distribucion_cohorte(uuid);

-- 2. Restore legacy preguntas columns
ALTER TABLE public.preguntas ADD COLUMN IF NOT EXISTS escala_min int;
ALTER TABLE public.preguntas ADD COLUMN IF NOT EXISTS escala_max int;

-- 3. Remove tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS sesiones_encuesta;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS respuestas;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS scores;

-- 4. Drop RLS policies for the 14 tables
DROP POLICY IF EXISTS "usuarios_own_or_admin" ON public.usuarios;
DROP POLICY IF EXISTS "estudiantes_own_or_admin" ON public.estudiantes;
DROP POLICY IF EXISTS "correlativas_auth_all" ON public.correlativas;
DROP POLICY IF EXISTS "progreso_estudiante_own_or_admin" ON public.progreso_estudiante;
DROP POLICY IF EXISTS "cursadas_own_or_admin" ON public.cursadas;
DROP POLICY IF EXISTS "finales_own_or_admin" ON public.finales;
DROP POLICY IF EXISTS "sesiones_encuesta_own_or_admin" ON public.sesiones_encuesta;
DROP POLICY IF EXISTS "respuestas_own_session_or_admin" ON public.respuestas;
DROP POLICY IF EXISTS "indicador_componentes_auth_all" ON public.indicador_componentes;
DROP POLICY IF EXISTS "scores_own_or_admin" ON public.scores;
DROP POLICY IF EXISTS "asignaciones_tutor_own_or_admin" ON public.asignaciones_tutor;
DROP POLICY IF EXISTS "alertas_own_or_admin" ON public.alertas;
DROP POLICY IF EXISTS "intervenciones_own_or_admin" ON public.intervenciones;
DROP POLICY IF EXISTS "entrevistas_own_or_admin" ON public.entrevistas;

-- 5. Revoke EXECUTE on is_admin()
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM authenticated;
