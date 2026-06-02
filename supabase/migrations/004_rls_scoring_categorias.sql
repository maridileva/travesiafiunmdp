-- Políticas para scoring_opciones
ALTER TABLE public.scoring_opciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir lectura a todos en scoring_opciones"
  ON public.scoring_opciones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir todo a administradores en scoring_opciones"
  ON public.scoring_opciones FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Políticas para scoring_tramos
ALTER TABLE public.scoring_tramos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir lectura a todos en scoring_tramos"
  ON public.scoring_tramos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir todo a administradores en scoring_tramos"
  ON public.scoring_tramos FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Políticas para categorias_pregunta
ALTER TABLE public.categorias_pregunta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir lectura a todos en categorias_pregunta"
  ON public.categorias_pregunta FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir todo a administradores en categorias_pregunta"
  ON public.categorias_pregunta FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
