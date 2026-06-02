-- Políticas para indicadores
CREATE POLICY "Permitir lectura a todos los autenticados en indicadores"
  ON public.indicadores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir todo a administradores en indicadores"
  ON public.indicadores FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
