-- Políticas para encuestas
CREATE POLICY "Permitir lectura a todos los autenticados en encuestas"
  ON public.encuestas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir todo a administradores en encuestas"
  ON public.encuestas FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Políticas para encuesta_secciones
CREATE POLICY "Permitir lectura a todos los autenticados en encuesta_secciones"
  ON public.encuesta_secciones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir todo a administradores en encuesta_secciones"
  ON public.encuesta_secciones FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Políticas para preguntas
CREATE POLICY "Permitir lectura  a todos los autenticados en preguntas"
  ON public.preguntas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir todo a administradores en preguntas"
  ON public.preguntas FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
