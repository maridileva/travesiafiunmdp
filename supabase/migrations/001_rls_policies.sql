-- Políticas básicas para permitir inserción/actualización al admin
-- Permite todas las operaciones en las tablas de configuración si el usuario tiene rol 'admin'

-- Función auxiliar para verificar si el usuario es admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.usuario_roles
    WHERE usuario_id = auth.uid()
    AND rol = 'admin'
    AND activo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas para carreras
CREATE POLICY "Permitir lectura a todos los autenticados en carreras"
  ON public.carreras FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir todo a administradores en carreras"
  ON public.carreras FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Políticas para materias
CREATE POLICY "Permitir lectura a todos los autenticados en materias"
  ON public.materias FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir todo a administradores en materias"
  ON public.materias FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Políticas para plan_estudios
CREATE POLICY "Permitir lectura a todos los autenticados en plan_estudios"
  ON public.plan_estudios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir todo a administradores en plan_estudios"
  ON public.plan_estudios FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
