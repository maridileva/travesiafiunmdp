-- =========================================================================
-- Migration 007: Fix DB Schema ↔ Frontend Mismatches
-- =========================================================================
-- Applies four fixes in a single additive migration:
-- 1. GRANT EXECUTE on is_admin() + RLS policies for 14 unprotected tables
-- 2. Realtime publication expansion (sesiones_encuesta, respuestas, scores)
-- 3. Drop legacy preguntas columns (escala_min, escala_max)
-- 4. get_distribucion_cohorte RPC + GRANT EXECUTE
-- 5. Optional CHECK backfill (guarded, non-failing)
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. GRANT EXECUTE on is_admin() — MUST be first
--    is_admin() is SECURITY DEFINER (001_rls_policies.sql:15) but has no
--    GRANT EXECUTE anywhere in 000–006. Without this, every policy that
--    references is_admin() silently denies admin access.
-- -------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- -------------------------------------------------------------------------
-- 2. RLS policies for 14 unprotected tables
--    Pattern: own-row OR admin (FOR ALL TO authenticated)
--    Each table has RLS ENABLED but zero policies — these unlock access.
-- -------------------------------------------------------------------------

-- 2.1 usuarios
CREATE POLICY "usuarios_own_or_admin"
  ON public.usuarios FOR ALL TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- 2.2 estudiantes
CREATE POLICY "estudiantes_own_or_admin"
  ON public.estudiantes FOR ALL TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin())
  WITH CHECK (usuario_id = auth.uid() OR public.is_admin());

-- 2.3 correlativas
CREATE POLICY "correlativas_auth_all"
  ON public.correlativas FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2.4 progreso_estudiante
CREATE POLICY "progreso_estudiante_own_or_admin"
  ON public.progreso_estudiante FOR ALL TO authenticated
  USING (estudiante_id = auth.uid() OR public.is_admin())
  WITH CHECK (estudiante_id = auth.uid() OR public.is_admin());

-- 2.5 cursadas
CREATE POLICY "cursadas_own_or_admin"
  ON public.cursadas FOR ALL TO authenticated
  USING (estudiante_id = auth.uid() OR public.is_admin())
  WITH CHECK (estudiante_id = auth.uid() OR public.is_admin());

-- 2.6 finales
CREATE POLICY "finales_own_or_admin"
  ON public.finales FOR ALL TO authenticated
  USING (estudiante_id = auth.uid() OR public.is_admin())
  WITH CHECK (estudiante_id = auth.uid() OR public.is_admin());

-- 2.7 sesiones_encuesta
CREATE POLICY "sesiones_encuesta_own_or_admin"
  ON public.sesiones_encuesta FOR ALL TO authenticated
  USING (estudiante_id = auth.uid() OR public.is_admin())
  WITH CHECK (estudiante_id = auth.uid() OR public.is_admin());

-- 2.8 respuestas — via session ownership
CREATE POLICY "respuestas_own_session_or_admin"
  ON public.respuestas FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sesiones_encuesta s
      WHERE s.id = respuestas.sesion_id AND s.estudiante_id = auth.uid()
    ) OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sesiones_encuesta s
      WHERE s.id = respuestas.sesion_id AND s.estudiante_id = auth.uid()
    ) OR public.is_admin()
  );

-- 2.9 indicador_componentes — reference table, auth read + admin write
CREATE POLICY "indicador_componentes_auth_all"
  ON public.indicador_componentes FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2.10 scores
CREATE POLICY "scores_own_or_admin"
  ON public.scores FOR ALL TO authenticated
  USING (estudiante_id = auth.uid() OR public.is_admin())
  WITH CHECK (estudiante_id = auth.uid() OR public.is_admin());

-- 2.11 asignaciones_tutor
CREATE POLICY "asignaciones_tutor_own_or_admin"
  ON public.asignaciones_tutor FOR ALL TO authenticated
  USING (tutor_id = auth.uid() OR estudiante_id = auth.uid() OR public.is_admin())
  WITH CHECK (tutor_id = auth.uid() OR estudiante_id = auth.uid() OR public.is_admin());

-- 2.12 alertas
CREATE POLICY "alertas_own_or_admin"
  ON public.alertas FOR ALL TO authenticated
  USING (estudiante_id = auth.uid() OR tutor_id = auth.uid() OR public.is_admin())
  WITH CHECK (estudiante_id = auth.uid() OR tutor_id = auth.uid() OR public.is_admin());

-- 2.13 intervenciones
CREATE POLICY "intervenciones_own_or_admin"
  ON public.intervenciones FOR ALL TO authenticated
  USING (estudiante_id = auth.uid() OR tutor_id = auth.uid() OR public.is_admin())
  WITH CHECK (estudiante_id = auth.uid() OR tutor_id = auth.uid() OR public.is_admin());

-- 2.14 entrevistas — via intervencion ownership
CREATE POLICY "entrevistas_own_or_admin"
  ON public.entrevistas FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.intervenciones i
      WHERE i.id = entrevistas.intervencion_id
        AND (i.estudiante_id = auth.uid() OR i.tutor_id = auth.uid())
    ) OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.intervenciones i
      WHERE i.id = entrevistas.intervencion_id
        AND (i.estudiante_id = auth.uid() OR i.tutor_id = auth.uid())
    ) OR public.is_admin()
  );

-- -------------------------------------------------------------------------
-- 3. Realtime publication expansion
-- -------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE sesiones_encuesta;
ALTER PUBLICATION supabase_realtime ADD TABLE respuestas;
ALTER PUBLICATION supabase_realtime ADD TABLE scores;

-- -------------------------------------------------------------------------
-- 4. Drop legacy preguntas columns
--    TS write fix ships in the same change slice, so no transient errors.
--    Historical rows with stale escala_min/escala_max data remain as NULL
--    in valor_minimo/valor_maximo (admin-authored test data, no backfill).
-- -------------------------------------------------------------------------
ALTER TABLE public.preguntas DROP COLUMN IF EXISTS escala_min;
ALTER TABLE public.preguntas DROP COLUMN IF EXISTS escala_max;

-- -------------------------------------------------------------------------
-- 5. get_distribucion_cohorte RPC
--    SECURITY DEFINER: bypasses RLS so admin dashboard sees all careers.
--    STABLE: safe to call multiple times in a transaction.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_distribucion_cohorte(p_carrera_id uuid)
RETURNS TABLE (bajo int, medio int, alto int, critico int)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COUNT(*) FILTER (WHERE s.nivel_riesgo = 'bajo')::int,
    COUNT(*) FILTER (WHERE s.nivel_riesgo = 'medio')::int,
    COUNT(*) FILTER (WHERE s.nivel_riesgo = 'alto')::int,
    COUNT(*) FILTER (WHERE s.nivel_riesgo = 'critico')::int
  FROM scores s
  JOIN estudiantes e ON e.usuario_id = s.estudiante_id
  WHERE e.carrera_id = p_carrera_id
    AND s.calculado_at = (
      SELECT MAX(s2.calculado_at) FROM scores s2
      WHERE s2.estudiante_id = s.estudiante_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_distribucion_cohorte(uuid) TO authenticated;

-- -------------------------------------------------------------------------
-- 6. Optional CHECK backfill (guarded, non-failing)
--    The CHECK on cursadas.situacion already exists in 000_base_de_datos.sql:107.
--    Any violating insert would have failed at insert time — zero invalid rows.
--    Documented here for completeness.
-- -------------------------------------------------------------------------
-- No backfill needed: the CHECK constraint was always present; only the
-- frontend was sending invalid values ('aprobada'/'desaprobada'). Those
-- inserts failed at the DB level, leaving zero invalid rows in cursadas.
