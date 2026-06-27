-- Tablas para scoring y categorías de preguntas
-- Se crean antes de aplicar sus políticas RLS

SET search_path TO extensions, public;

CREATE TABLE IF NOT EXISTS public.categorias_pregunta (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text,
  score_maximo numeric(5,2) DEFAULT 0,
  color text DEFAULT '#6366f1',
  activa boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.categorias_pregunta ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.scoring_opciones (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  pregunta_id uuid REFERENCES public.preguntas(id) ON DELETE CASCADE NOT NULL,
  opcion_valor text NOT NULL,
  score numeric(5,2) DEFAULT 0
);

ALTER TABLE public.scoring_opciones ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.scoring_tramos (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  pregunta_id uuid REFERENCES public.preguntas(id) ON DELETE CASCADE NOT NULL,
  orden int NOT NULL DEFAULT 0,
  condicion_tipo text NOT NULL CHECK (condicion_tipo IN ('menor', 'menor_igual', 'mayor', 'mayor_igual', 'igual', 'entre')),
  condicion_valor numeric(5,2),
  condicion_valor_min numeric(5,2),
  condicion_valor_max numeric(5,2),
  formula text NOT NULL
);

ALTER TABLE public.scoring_tramos ENABLE ROW LEVEL SECURITY;

-- Agregar columna categoria_id a preguntas si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'preguntas' AND column_name = 'categoria_id'
  ) THEN
    ALTER TABLE public.preguntas ADD COLUMN categoria_id uuid REFERENCES public.categorias_pregunta(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Otorgar permisos a authenticated para las tablas de scoring
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_pregunta TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scoring_opciones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scoring_tramos TO authenticated;
