-- Proyecto Travesía - Esquema Inicial de Base de Datos para Supabase
-- Ejecutá este script en el SQL Editor de tu proyecto de Supabase.

SET search_path TO extensions, public;

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------
-- 1. TABLAS PRINCIPALES (Usuarios y Roles)
-- --------------------------------------------------------

CREATE TABLE public.usuarios (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre text NOT NULL,
  apellido text NOT NULL,
  email text NOT NULL UNIQUE,
  legajo text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.carreras (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre text NOT NULL,
  codigo text
);
ALTER TABLE public.carreras ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.usuario_roles (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  rol text NOT NULL CHECK (rol IN ('admin', 'docente', 'tutor', 'asesor_par', 'estudiante')),
  carrera_id uuid REFERENCES public.carreras(id) ON DELETE SET NULL,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, rol, carrera_id)
);
ALTER TABLE public.usuario_roles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.usuario_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_roles TO service_role;

CREATE TABLE public.estudiantes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL UNIQUE,
  carrera_id uuid REFERENCES public.carreras(id) ON DELETE RESTRICT NOT NULL,
  anio_ingreso int NOT NULL,
  encuesta_inicial_completada boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.estudiantes ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- 2. PLAN DE ESTUDIOS
-- --------------------------------------------------------

CREATE TABLE public.materias (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  carrera_id uuid REFERENCES public.carreras(id) ON DELETE CASCADE NOT NULL,
  nombre text NOT NULL,
  codigo text NOT NULL,
  creditos int,
  UNIQUE(carrera_id, codigo)
);
ALTER TABLE public.materias ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.plan_estudios (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  carrera_id uuid REFERENCES public.carreras(id) ON DELETE CASCADE NOT NULL,
  materia_id uuid REFERENCES public.materias(id) ON DELETE CASCADE NOT NULL,
  anio_teorico int NOT NULL,
  cuatrimestre int NOT NULL,
  tipo text DEFAULT 'obligatoria',
  es_critica boolean DEFAULT false,
  UNIQUE(carrera_id, materia_id)
);
ALTER TABLE public.plan_estudios ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.correlativas (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  materia_id uuid REFERENCES public.materias(id) ON DELETE CASCADE NOT NULL,
  materia_requerida_id uuid REFERENCES public.materias(id) ON DELETE CASCADE NOT NULL,
  tipo text DEFAULT 'aprobada' CHECK (tipo IN ('aprobada', 'cursada')),
  UNIQUE(materia_id, materia_requerida_id)
);
ALTER TABLE public.correlativas ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- 3. PROGRESO Y CURSADAS (Datos académicos)
-- --------------------------------------------------------

CREATE TABLE public.progreso_estudiante (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  estudiante_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  materia_id uuid REFERENCES public.materias(id) ON DELETE CASCADE NOT NULL,
  estado text NOT NULL CHECK (estado IN ('aprobada', 'final_pendiente', 'cursando', 'no_cursada', 'recursando')),
  nota_final numeric(4,2),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(estudiante_id, materia_id)
);
ALTER TABLE public.progreso_estudiante ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cursadas (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  estudiante_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  materia_id uuid REFERENCES public.materias(id) ON DELETE CASCADE NOT NULL,
  cuatrimestre int NOT NULL,
  anio int NOT NULL,
  situacion text NOT NULL CHECK (situacion IN ('promovio', 'habilito', 'desaprobo', 'abandono')),
  nota_cursada int,
  como_se_sintio text,
  dificultades text[],
  dedicacion text,
  ritmo_estudio text,
  tiene_materiales boolean,
  numero_cursada int DEFAULT 1,
  es_confiable boolean DEFAULT false,
  valor_original_alumno jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.cursadas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.finales (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  cursada_id uuid REFERENCES public.cursadas(id) ON DELETE CASCADE NOT NULL,
  estudiante_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  materia_id uuid REFERENCES public.materias(id) ON DELETE CASCADE NOT NULL,
  resultado text NOT NULL CHECK (resultado IN ('aprobado', 'desaprobado', 'ausente')),
  nota int,
  fecha_intento date,
  numero_intento int DEFAULT 1,
  es_confiable boolean DEFAULT false,
  valor_original_alumno jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.finales ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- 4. ENCUESTAS
-- --------------------------------------------------------

CREATE TABLE public.encuestas (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  titulo text NOT NULL,
  descripcion text,
  tipo text NOT NULL CHECK (tipo IN ('inicial', 'cuatrimestral', 'entrevista')),
  activa boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.encuestas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.encuesta_secciones (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  encuesta_id uuid REFERENCES public.encuestas(id) ON DELETE CASCADE NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  orden int NOT NULL
);
ALTER TABLE public.encuesta_secciones ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.preguntas (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  seccion_id uuid REFERENCES public.encuesta_secciones(id) ON DELETE CASCADE NOT NULL,
  texto text NOT NULL,
  descripcion text,
  tipo text NOT NULL CHECK (tipo IN ('texto', 'multiple', 'unica', 'escala', 'numerica')),
  opciones jsonb,
  escala_min int,
  escala_max int,
  orden int NOT NULL,
  es_obligatoria boolean DEFAULT true,
  aplica_por_materia boolean DEFAULT false,
  peso_defecto numeric(5,2) DEFAULT 0,
  categoria_id uuid,
  valor_minimo numeric,
  valor_maximo numeric,
  unidad text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.preguntas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sesiones_encuesta (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  encuesta_id uuid REFERENCES public.encuestas(id) ON DELETE CASCADE NOT NULL,
  estudiante_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  cuatrimestre int,
  anio int,
  estado text NOT NULL CHECK (estado IN ('en_progreso', 'completada')),
  iniciada_at timestamptz DEFAULT now(),
  completada_at timestamptz
);
ALTER TABLE public.sesiones_encuesta ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.respuestas (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  sesion_id uuid REFERENCES public.sesiones_encuesta(id) ON DELETE CASCADE NOT NULL,
  pregunta_id uuid REFERENCES public.preguntas(id) ON DELETE CASCADE NOT NULL,
  materia_id uuid REFERENCES public.materias(id) ON DELETE CASCADE,
  valor text NOT NULL,
  es_confiable boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sesion_id, pregunta_id, materia_id)
);
ALTER TABLE public.respuestas ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- 5. SCORES E INDICADORES
-- --------------------------------------------------------

CREATE TABLE public.indicadores (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text,
  activo boolean DEFAULT true,
  peso int NOT NULL
);
ALTER TABLE public.indicadores ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.indicador_componentes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  indicador_id uuid REFERENCES public.indicadores(id) ON DELETE CASCADE NOT NULL,
  nombre text NOT NULL,
  formula text,
  peso int NOT NULL
);
ALTER TABLE public.indicador_componentes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.scores (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  estudiante_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  valor numeric(5,2) NOT NULL,
  nivel_riesgo text NOT NULL CHECK (nivel_riesgo IN ('bajo', 'medio', 'alto', 'critico')),
  cuatrimestre int,
  anio int,
  componentes jsonb,
  calculado_at timestamptz DEFAULT now()
);
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- 6. ASIGNACIONES, ALERTAS E INTERVENCIONES
-- --------------------------------------------------------

CREATE TABLE public.asignaciones_tutor (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tutor_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  estudiante_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  rol_tutor text NOT NULL CHECK (rol_tutor IN ('tutor', 'asesor_par')),
  activa boolean DEFAULT true,
  asignado_at timestamptz DEFAULT now()
);
ALTER TABLE public.asignaciones_tutor ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.alertas (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  estudiante_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  tutor_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('score_critico', 'perfil_silencioso', 'encuesta_omitida', 'ralentizacion', 'solicitud_ayuda', 'cambio_plan')),
  origen text NOT NULL CHECK (origen IN ('automatica', 'solicitud_alumno')),
  descripcion text,
  estado text NOT NULL CHECK (estado IN ('pendiente', 'resuelta')),
  created_at timestamptz DEFAULT now(),
  resuelta_at timestamptz,
  resuelta_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL
);
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.intervenciones (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  estudiante_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  tutor_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrevista', 'contacto_email', 'contacto_telefono', 'reunion_grupal')),
  modalidad text NOT NULL CHECK (modalidad IN ('presencial', 'virtual', 'telefonica')),
  fecha_realizada timestamptz NOT NULL,
  motivo text NOT NULL,
  resumen text NOT NULL,
  compromisos text,
  proxima_accion text,
  estado text NOT NULL CHECK (estado IN ('planificada', 'realizada', 'cancelada')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.intervenciones ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.entrevistas (
  intervencion_id uuid REFERENCES public.intervenciones(id) ON DELETE CASCADE PRIMARY KEY,
  motivo_entrevista text NOT NULL,
  estado_alumno_percibido text NOT NULL CHECK (estado_alumno_percibido IN ('bien', 'regular', 'en_riesgo', 'critico')),
  factores_riesgo text[],
  acciones_acordadas text NOT NULL,
  derivaciones text,
  seguimiento_requerido boolean DEFAULT false,
  notas_adicionales text
);
ALTER TABLE public.entrevistas ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- TRIGGER: CREAR USUARIO AUTOMATICO EN PUBLIC.USUARIOS Y ROL
-- --------------------------------------------------------
-- Esto copia datos desde auth.users a public.usuarios al hacer SignUp

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nombre, apellido)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nombre', 'Usuario'),
    COALESCE(new.raw_user_meta_data->>'apellido', '')
  );
  
  -- Por defecto, asignar rol de admin si es el primer usuario, sino estudiante temporal
  -- En un entorno real se controla mediante panel de admin, aca le ponemos estudiante por defecto
  INSERT INTO public.usuario_roles (usuario_id, rol)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'rol', 'estudiante'));
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Para Realtime de Alertas (Dashboard Tutor)
-- Agregando alertas a la publicación de Supabase Realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE alertas;

-- GRANT permissions to authenticated role for all tables
-- Without this, RLS policies are active but the role lacks basic table access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carreras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estudiantes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_estudios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.correlativas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progreso_estudiante TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cursadas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.encuestas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.encuesta_secciones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preguntas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sesiones_encuesta TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.respuestas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicadores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicador_componentes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asignaciones_tutor TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervenciones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entrevistas TO authenticated;
