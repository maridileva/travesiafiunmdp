-- =========================================================================
-- Migration 009: Seed Carreras + Plan de Estudios (Informática Plan 2024)
-- =========================================================================
-- Idempotent: all INSERTs use ON CONFLICT DO NOTHING.
-- Source: supabase/docs/planesdeestudio.md
-- =========================================================================

-- 0. Ensure unique constraint for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS carreras_codigo_uniq ON public.carreras(codigo);

-- -------------------------------------------------------------------------
-- 1. CARRERAS (10 engineering degrees at FI-UNMdP)
-- -------------------------------------------------------------------------
INSERT INTO public.carreras (nombre, codigo) VALUES
  ('Ingeniería en Informática',     'INF'),
  ('Ingeniería en Computación',     'COM'),
  ('Ingeniería Electrónica',        'ELC'),
  ('Ingeniería Eléctrica',          'ELE'),
  ('Ingeniería Electromecánica',    'EME'),
  ('Ingeniería Industrial',         'IND'),
  ('Ingeniería Mecánica',           'MEC'),
  ('Ingeniería Química',            'QUI'),
  ('Ingeniería en Alimentos',       'ALI'),
  ('Ingeniería en Materiales',      'MAT')
ON CONFLICT (codigo) DO NOTHING;

-- -------------------------------------------------------------------------
-- 2. MATERIAS — Ingeniería en Informática Plan 2024 (~55 subjects)
-- -------------------------------------------------------------------------
INSERT INTO public.materias (carrera_id, nombre, codigo, creditos) VALUES

  -- Primer año, 1er cuatrimestre
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Introducción a la Ciencia y la Ingeniería', 'ING0000', NULL),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Informática Básica', 'ING6102', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Análisis Matemático I', 'INGM101', 6),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Álgebra I-B', 'INGM105', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Tecnologías Informáticas A', 'ING6301', 6),

  -- Primer año, 2do cuatrimestre
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Programación A', 'ING6201', 8),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Análisis Matemático II', 'INGM102', 5),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Álgebra II', 'INGM106', 5),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Introducción a la Matemática Discreta', 'INGM107', 4),

  -- Segundo año, 1er cuatrimestre
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Programación B', 'ING6202', 8),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Probabilidad y Estadística', 'INGM108', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Física A', 'INGF101', 6),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Tecnologías Informáticas B', 'ING6302', 6),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Inglés I', 'ING8408', 3),

  -- Segundo año, 2do cuatrimestre
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Programación C', 'ING6205', 8),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Teoría de la Información y la Comunicación', 'ING6203', 5),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Fundamentos de la Arquitectura de Computadoras', 'ING6204', 5),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Física B-II', 'INGF103', 6),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Inglés II', 'ING8409', 3),

  -- Tercer año, 1er cuatrimestre
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Fundamentos de los Lenguajes Formales', 'ING6208', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Estructura y Organización de Datos', 'ING6207', 5),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Fundamentos de Sistemas Operativos', 'ING6303', 6),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Investigación de Operaciones', 'ING8410', 4),

  -- Tercer año, 2do cuatrimestre
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Redes y Comunicación de Datos A', 'ING6305', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Calidad de Software A', 'ING6304', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Análisis y Diseño de Sistemas A', 'ING6306', 6),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Administración Empresarial en la Economía del Conocimiento', 'ING8401', 4),

  -- Cuarto año, 1er cuatrimestre
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Sistemas de Bases de Datos', 'ING6307', 6),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Introducción a la Inteligencia Artificial', 'ING6316', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Análisis y Diseño de Sistemas B', 'ING6310', 6),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Comportamiento Organizacional y Relaciones del Trabajo', 'ING8402', 4),

  -- Cuarto año, 2do cuatrimestre
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Redes y Comunicación de Datos B', 'ING6309', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Gestión de la Seguridad Informática', 'ING6312', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Diseño e Implementación de Sistemas Distribuidos', 'ING6313', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Calidad de Software B', 'ING6311', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Gestión de Proyectos Informáticos', 'ING6401', 4),

  -- Quinto año, 1er cuatrimestre
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Teoría de Modelos y Simulación', 'ING6209', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Trabajo Final Integrador', 'ING6314', 10),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Auditoría y Homologación', 'ING6315', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Ética, Legislación y Propiedad Intelectual en el Ejercicio Profesional', 'ING8405', 4),

  -- Quinto año, 2do cuatrimestre
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Seguridad y Salud Ocupacional', 'ING8412', 4),

  -- Optativas (todas 4 CG, 2do cuatrimestre)
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Internet de las Cosas', 'ING6324', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Software Libre', 'ING6317', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Computación en la Nube', 'ING6318', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Estimación de Costos de Productos de Software', 'ING6319', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Ingeniería de Videojuegos', 'ING6320', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Base de Datos Avanzada', 'ING6321', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Procesamiento Digital de Imágenes', 'ING4229', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Economía de la Innovación y del Conocimiento', 'ING8515', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Gestión de Patentes y de la Propiedad Industrial', 'ING8516', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Informática Médica', 'ING6325', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Técnicas de la Creatividad Aplicada', 'ING1404', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Gestión y Automatización de Procesos de Negocios', 'ING6322', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Tecnologías BlockChain', 'ING6323', 4),
  ((SELECT id FROM public.carreras WHERE codigo = 'INF'), 'Exploración de Datos para Inteligencia Competitiva', 'ING8520', 4)

ON CONFLICT (carrera_id, codigo) DO NOTHING;

-- -------------------------------------------------------------------------
-- 3. PLAN DE ESTUDIOS — link materias to carrera with year/semester
-- -------------------------------------------------------------------------
-- Helper: we reference materias by codigo within carrera INF
-- anio_teorico = academic year, cuatrimestre = semester

INSERT INTO public.plan_estudios (carrera_id, materia_id, anio_teorico, cuatrimestre, tipo, es_critica)
SELECT c.id, m.id, v.anio, v.cuat, v.tipo, false
FROM public.carreras c
CROSS JOIN (VALUES
  -- 1er año, 1er cuat
  ('ING0000', 1, 1, 'obligatoria'),
  ('ING6102', 1, 1, 'obligatoria'),
  ('INGM101', 1, 1, 'obligatoria'),
  ('INGM105', 1, 1, 'obligatoria'),
  ('ING6301', 1, 1, 'obligatoria'),
  -- 1er año, 2do cuat
  ('ING6201', 1, 2, 'obligatoria'),
  ('INGM102', 1, 2, 'obligatoria'),
  ('INGM106', 1, 2, 'obligatoria'),
  ('INGM107', 1, 2, 'obligatoria'),
  -- 2do año, 1er cuat
  ('ING6202', 2, 1, 'obligatoria'),
  ('INGM108', 2, 1, 'obligatoria'),
  ('INGF101', 2, 1, 'obligatoria'),
  ('ING6302', 2, 1, 'obligatoria'),
  ('ING8408', 2, 1, 'obligatoria'),
  -- 2do año, 2do cuat
  ('ING6205', 2, 2, 'obligatoria'),
  ('ING6203', 2, 2, 'obligatoria'),
  ('ING6204', 2, 2, 'obligatoria'),
  ('INGF103', 2, 2, 'obligatoria'),
  ('ING8409', 2, 2, 'obligatoria'),
  -- 3er año, 1er cuat
  ('ING6208', 3, 1, 'obligatoria'),
  ('ING6207', 3, 1, 'obligatoria'),
  ('ING6303', 3, 1, 'obligatoria'),
  ('ING8410', 3, 1, 'obligatoria'),
  -- 3er año, 2do cuat
  ('ING6305', 3, 2, 'obligatoria'),
  ('ING6304', 3, 2, 'obligatoria'),
  ('ING6306', 3, 2, 'obligatoria'),
  ('ING8401', 3, 2, 'obligatoria'),
  -- 4to año, 1er cuat
  ('ING6307', 4, 1, 'obligatoria'),
  ('ING6316', 4, 1, 'obligatoria'),
  ('ING6310', 4, 1, 'obligatoria'),
  ('ING8402', 4, 1, 'obligatoria'),
  -- 4to año, 2do cuat
  ('ING6309', 4, 2, 'obligatoria'),
  ('ING6312', 4, 2, 'obligatoria'),
  ('ING6313', 4, 2, 'obligatoria'),
  ('ING6311', 4, 2, 'obligatoria'),
  ('ING6401', 4, 2, 'obligatoria'),
  -- 5to año, 1er cuat
  ('ING6209', 5, 1, 'obligatoria'),
  ('ING6314', 5, 1, 'obligatoria'),
  ('ING6315', 5, 1, 'obligatoria'),
  ('ING8405', 5, 1, 'obligatoria'),
  -- 5to año, 2do cuat
  ('ING8412', 5, 2, 'obligatoria'),
  -- Optativas
  ('ING6324', 5, 2, 'optativa'),
  ('ING6317', 5, 2, 'optativa'),
  ('ING6318', 5, 2, 'optativa'),
  ('ING6319', 5, 2, 'optativa'),
  ('ING6320', 5, 2, 'optativa'),
  ('ING6321', 5, 2, 'optativa'),
  ('ING4229', 5, 2, 'optativa'),
  ('ING8515', 5, 2, 'optativa'),
  ('ING8516', 5, 2, 'optativa'),
  ('ING6325', 5, 2, 'optativa'),
  ('ING1404', 5, 2, 'optativa'),
  ('ING6322', 5, 2, 'optativa'),
  ('ING6323', 5, 2, 'optativa'),
  ('ING8520', 5, 2, 'optativa')
) AS v(codigo, anio, cuat, tipo)
JOIN public.materias m ON m.codigo = v.codigo AND m.carrera_id = c.id
WHERE c.codigo = 'INF'
ON CONFLICT (carrera_id, materia_id) DO NOTHING;

-- -------------------------------------------------------------------------
-- 4. CORRELATIVAS — subject dependencies
-- -------------------------------------------------------------------------
-- sub(id, codigo, deps[]) helper via LATERAL subquery
INSERT INTO public.correlativas (materia_id, materia_requerida_id, tipo)
SELECT m1.id, m2.id, 'aprobada'
FROM public.carreras c
JOIN public.materias m1 ON m1.carrera_id = c.id
JOIN public.materias m2 ON m2.carrera_id = c.id
WHERE c.codigo = 'INF'
  AND (
    -- 1er año: todas las de 1er cuat requieren Introducción (ING0000)
    (m1.codigo IN ('ING6102','INGM101','INGM105','ING6301') AND m2.codigo = 'ING0000')
    -- 1er año, 2do cuat
    OR (m1.codigo = 'ING6201' AND m2.codigo IN ('INGM101','INGM105','ING6102'))
    OR (m1.codigo = 'INGM102' AND m2.codigo = 'INGM101')
    OR (m1.codigo = 'INGM106' AND m2.codigo = 'INGM105')
    OR (m1.codigo = 'INGM107' AND m2.codigo IN ('INGM105','ING6102'))
    -- 2do año, 1er cuat
    OR (m1.codigo = 'ING6202' AND m2.codigo IN ('ING6201','INGM107'))
    OR (m1.codigo = 'INGM108' AND m2.codigo = 'INGM102')
    OR (m1.codigo = 'INGF101' AND m2.codigo IN ('INGM101','INGM105'))
    OR (m1.codigo = 'ING6302' AND m2.codigo IN ('ING6301','ING6201'))
    -- 2do año, 2do cuat
    OR (m1.codigo = 'ING6205' AND m2.codigo IN ('ING6202','ING6302'))
    OR (m1.codigo = 'ING6203' AND m2.codigo IN ('INGM108','ING6202'))
    OR (m1.codigo = 'ING6204' AND m2.codigo IN ('INGF101','ING6202'))
    OR (m1.codigo = 'INGF103' AND m2.codigo IN ('INGM102','INGM106','INGF101'))
    OR (m1.codigo = 'ING8409' AND m2.codigo = 'ING8408')
    -- 3er año, 1er cuat
    OR (m1.codigo = 'ING6208' AND m2.codigo IN ('ING6202','ING6204'))
    OR (m1.codigo = 'ING6207' AND m2.codigo IN ('ING6202','ING6203'))
    OR (m1.codigo = 'ING6303' AND m2.codigo IN ('ING6204','ING6205'))
    OR (m1.codigo = 'ING8410' AND m2.codigo = 'INGM108')
    -- 3er año, 2do cuat
    OR (m1.codigo = 'ING6305' AND m2.codigo IN ('INGF103','ING6303'))
    OR (m1.codigo = 'ING6304' AND m2.codigo = 'ING6205')
    OR (m1.codigo = 'ING6306' AND m2.codigo = 'ING6205')
    OR (m1.codigo = 'ING8401' AND m2.codigo = 'ING8410')
    -- 4to año, 1er cuat
    OR (m1.codigo = 'ING6307' AND m2.codigo IN ('ING6205','ING6306','ING6303'))
    OR (m1.codigo = 'ING6316' AND m2.codigo = 'ING6205')
    OR (m1.codigo = 'ING6310' AND m2.codigo IN ('ING6306','ING8401'))
    -- 4to año, 2do cuat
    OR (m1.codigo = 'ING6309' AND m2.codigo = 'ING6305')
    OR (m1.codigo = 'ING6312' AND m2.codigo = 'ING6305')
    OR (m1.codigo = 'ING6313' AND m2.codigo IN ('ING6309','ING6310'))
    OR (m1.codigo = 'ING6311' AND m2.codigo IN ('ING6304','ING6307','ING6309'))
    OR (m1.codigo = 'ING6401' AND m2.codigo = 'ING6310')
    -- 5to año, 1er cuat
    OR (m1.codigo = 'ING6209' AND m2.codigo IN ('INGM108','ING6313'))
    OR (m1.codigo = 'ING6314' AND m2.codigo = 'ING6401')
    OR (m1.codigo = 'ING6315' AND m2.codigo IN ('ING6304','ING6312','ING6401'))
    OR (m1.codigo = 'ING8405' AND m2.codigo = 'ING8401')
    -- 5to año, 2do cuat
    OR (m1.codigo = 'ING8412' AND m2.codigo = 'ING8402')
  )
ON CONFLICT (materia_id, materia_requerida_id) DO NOTHING;
