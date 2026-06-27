-- =========================================================================
-- Migration 010: Seed Indicadores + Encuestas Templates + Categorías + Scoring
-- =========================================================================
-- Idempotent: all INSERTs use ON CONFLICT DO NOTHING.
-- Indicador names MUST match Edge Function substr keywords:
--   "Académico", "Emocional"/"Encuesta", "Ralentización", "Aislamiento"
-- =========================================================================

-- 0. Unique constraints for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS indicadores_nombre_uniq ON public.indicadores(nombre);
CREATE UNIQUE INDEX IF NOT EXISTS encuestas_tipo_activa_uniq ON public.encuestas(tipo) WHERE activa = true;

-- -------------------------------------------------------------------------
-- 1. INDICADORES — Motor de Scoring de Riesgo (0-100)
-- -------------------------------------------------------------------------
INSERT INTO public.indicadores (nombre, descripcion, peso, activo) VALUES
  ('Rendimiento Académico',
   'Mide qué tan rezagado está el estudiante: materias aprobadas vs plan ideal, castigos por recursadas y aplazos.',
   40, true),
  ('Encuestas y Bienestar Emocional',
   'Evalúa el estado emocional e intenciones basadas en las respuestas de los formularios del alumno.',
   35, true),
  ('Desempeño / Ralentización',
   'Evalúa la brecha general de lentitud a lo largo de los años. Penalización acelerada si faltan más del 20% de materias.',
   15, true),
  ('Alerta de Aislamiento',
   'Detecta alumnos desconectados: sin encuestas en 60+ días, sin intervenciones en 90+ días, encuesta inicial pendiente, alerta silenciosa previa.',
   10, true)
ON CONFLICT (nombre) DO NOTHING;

-- -------------------------------------------------------------------------
-- 2. INDICADOR COMPONENTES — Sub-factores de cada indicador
-- -------------------------------------------------------------------------
INSERT INTO public.indicador_componentes (indicador_id, nombre, formula, peso)
SELECT i.id, v.nombre, v.formula, v.peso
FROM (VALUES
  ('Rendimiento Académico', 'Progreso Real vs Ideal', 'progreso', 50),
  ('Rendimiento Académico', 'Castigos por Recursadas', 'recursadas', 50),
  ('Encuestas y Bienestar Emocional', 'Respuestas de Encuesta', 'puntaje_encuesta', 60),
  ('Encuestas y Bienestar Emocional', 'Topes por Categoría', 'topes_categoria', 40),
  ('Desempeño / Ralentización', 'Brecha de Lentitud', 'brecha_lentitud', 100),
  ('Alerta de Aislamiento', 'Sin Encuestas 60+ días', 'sin_encuestas', 30),
  ('Alerta de Aislamiento', 'Sin Intervenciones 90+ días', 'sin_intervenciones', 30),
  ('Alerta de Aislamiento', 'Encuesta Inicial Pendiente', 'encuesta_inicial', 20),
  ('Alerta de Aislamiento', 'Alerta Silenciosa Previa', 'alerta_silenciosa', 20)
) AS v(nombre_ind, nombre, formula, peso)
JOIN public.indicadores i ON i.nombre = v.nombre_ind
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------
-- 3. CATEGORÍAS DE PREGUNTA — Para agrupar y puntuar preguntas de encuesta
-- -------------------------------------------------------------------------
INSERT INTO public.categorias_pregunta (nombre, descripcion, score_maximo, color, activa) VALUES
  ('Bienestar General', 'Estado anímico, motivación y salud emocional del estudiante.', 30, '#14B8A6', true),
  ('Rendimiento Académico', 'Percepción del estudiante sobre su desempeño en materias.', 40, '#3B82F6', true),
  ('Factores de Riesgo', 'Condiciones que aumentan la probabilidad de abandono.', 30, '#F59E0B', true),
  ('Compromiso', 'Nivel de involucramiento con la carrera y la facultad.', 25, '#8B5CF6', true),
  ('Contexto Personal', 'Situación laboral, familiar y económica del estudiante.', 20, '#EC4899', true)
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------
-- 4. ENCUESTAS — Templates base
-- -------------------------------------------------------------------------
INSERT INTO public.encuestas (titulo, descripcion, tipo, activa) VALUES
  ('Encuesta Inicial', 'Evaluación inicial del estudiante al ingresar a la carrera. Permite conocer su perfil, contexto y estado emocional de partida.', 'inicial', true),
  ('Encuesta Cuatrimestral', 'Seguimiento periódico del progreso académico y bienestar del estudiante durante el cuatrimestre.', 'cuatrimestral', true),
  ('Guía de Entrevista', 'Preguntas guía para las entrevistas de tutoría. Diseñada para ser completada por el tutor durante o después de la entrevista con el estudiante.', 'entrevista', false)
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------
-- 5. SECCIONES Y PREGUNTAS
-- -------------------------------------------------------------------------

-- 5.1 ENCUESTA INICIAL (2 secciones, 6 preguntas)
DO $$
DECLARE
  enc_id uuid;
  sec_id uuid;
  cat_bienestar uuid;
  cat_contexto uuid;
  cat_compromiso uuid;
BEGIN
  SELECT id INTO enc_id FROM public.encuestas WHERE tipo = 'inicial' AND activa = true;
  IF enc_id IS NULL THEN RETURN; END IF;
  SELECT id INTO cat_bienestar FROM public.categorias_pregunta WHERE nombre = 'Bienestar General' LIMIT 1;
  SELECT id INTO cat_contexto  FROM public.categorias_pregunta WHERE nombre = 'Contexto Personal' LIMIT 1;
  SELECT id INTO cat_compromiso FROM public.categorias_pregunta WHERE nombre = 'Compromiso' LIMIT 1;

  -- Sección 1: Estado general
  INSERT INTO public.encuesta_secciones (encuesta_id, titulo, descripcion, orden) VALUES
    (enc_id, 'Estado General', 'Percepción inicial sobre la carrera y estado emocional', 1)
  ON CONFLICT DO NOTHING;
  SELECT id INTO sec_id FROM public.encuesta_secciones WHERE encuesta_id = enc_id AND orden = 1;

  INSERT INTO public.preguntas (seccion_id, texto, tipo, opciones, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, '¿Cómo te sentís con la carrera hasta ahora?', 'unica',
     '["Muy motivado/a", "Bastante bien", "Todavía no sé", "Un poco inseguro/a", "No me gusta / Quiero cambiarme"]',
     1, true, cat_bienestar, 10);

  INSERT INTO public.preguntas (seccion_id, texto, tipo, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, '¿Cuántas horas semanales dedicás al estudio fuera de clase?', 'numerica',
     2, true, cat_compromiso, 8);

  INSERT INTO public.preguntas (seccion_id, texto, tipo, opciones, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, '¿Contás con un espacio adecuado para estudiar en tu casa?', 'unica',
     '["Sí, tengo un espacio tranquilo", "Más o menos, a veces me cuesta concentrarme", "No, es difícil estudiar donde vivo"]',
     3, true, cat_contexto, 6);

  -- Sección 2: Contexto personal
  INSERT INTO public.encuesta_secciones (encuesta_id, titulo, descripcion, orden) VALUES
    (enc_id, 'Contexto Personal', 'Situación laboral y familiar', 2)
  ON CONFLICT DO NOTHING;
  SELECT id INTO sec_id FROM public.encuesta_secciones WHERE encuesta_id = enc_id AND orden = 2;

  INSERT INTO public.preguntas (seccion_id, texto, tipo, opciones, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, '¿Trabajás actualmente?', 'unica',
     '["No trabajo", "Trabajo medio tiempo (hasta 20 h/sem)", "Trabajo tiempo parcial (20-35 h/sem)", "Trabajo tiempo completo (35+ h/sem)"]',
     1, true, cat_contexto, 12);

  INSERT INTO public.preguntas (seccion_id, texto, tipo, valor_minimo, valor_maximo, unidad, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, 'Del 1 al 10, ¿cuánto apoyo sentís de tu familia para estudiar?',
     'escala', 1, 10, 'escala', 2, true, cat_contexto, 5);

  INSERT INTO public.preguntas (seccion_id, texto, tipo, opciones, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, '¿Tenés personas a cargo (hijos, hermanos, padres)?', 'unica',
     '["No", "Sí, y afecta mi disponibilidad horaria", "Sí, pero no interfiere con el estudio"]',
     3, true, cat_contexto, 8);

END $$;

-- 5.2 ENCUESTA CUATRIMESTRAL (2 secciones, 8 preguntas)
DO $$
DECLARE
  enc_id uuid;
  sec_id uuid;
  cat_rendimiento uuid;
  cat_bienestar uuid;
  cat_riesgo uuid;
BEGIN
  SELECT id INTO enc_id FROM public.encuestas WHERE tipo = 'cuatrimestral' AND activa = true;
  IF enc_id IS NULL THEN RETURN; END IF;
  SELECT id INTO cat_rendimiento FROM public.categorias_pregunta WHERE nombre = 'Rendimiento Académico' LIMIT 1;
  SELECT id INTO cat_bienestar   FROM public.categorias_pregunta WHERE nombre = 'Bienestar General' LIMIT 1;
  SELECT id INTO cat_riesgo      FROM public.categorias_pregunta WHERE nombre = 'Factores de Riesgo' LIMIT 1;

  -- Sección 1: Rendimiento
  INSERT INTO public.encuesta_secciones (encuesta_id, titulo, descripcion, orden) VALUES
    (enc_id, 'Rendimiento del Cuatrimestre', 'Autoevaluación del desempeño académico', 1)
  ON CONFLICT DO NOTHING;
  SELECT id INTO sec_id FROM public.encuesta_secciones WHERE encuesta_id = enc_id AND orden = 1;

  INSERT INTO public.preguntas (seccion_id, texto, tipo, valor_minimo, valor_maximo, unidad, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, 'Del 1 al 10, ¿cómo evaluás tu rendimiento académico este cuatrimestre?',
     'escala', 1, 10, 'escala', 1, true, cat_rendimiento, 15);

  INSERT INTO public.preguntas (seccion_id, texto, tipo, opciones, orden, es_obligatoria, categoria_id, peso_defecto, aplica_por_materia) VALUES
    (sec_id, '¿Cómo te fue en cada materia que estás cursando?', 'unica',
     '["Promoví / Aprobé", "Regularicé / Habilité", "Desaprobé / Abandoné", "Todavía estoy cursando"]',
     2, true, cat_rendimiento, 20, true);

  INSERT INTO public.preguntas (seccion_id, texto, tipo, opciones, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, '¿Tuviste dificultades para seguir el ritmo de las clases?', 'unica',
     '["No, pude seguir sin problemas", "En algunas materias me costó", "En la mayoría me costó seguir", "Sí, me sentí muy perdido/a"]',
     3, true, cat_rendimiento, 12);

  INSERT INTO public.preguntas (seccion_id, texto, tipo, opciones, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, '¿Cuánto tiempo semanal dedicaste al estudio fuera de clase?', 'unica',
     '["Más de 20 horas", "Entre 10 y 20 horas", "Entre 5 y 10 horas", "Menos de 5 horas"]',
     4, true, cat_rendimiento, 8);

  -- Sección 2: Bienestar
  INSERT INTO public.encuesta_secciones (encuesta_id, titulo, descripcion, orden) VALUES
    (enc_id, 'Bienestar y Motivación', 'Estado emocional y factores de riesgo', 2)
  ON CONFLICT DO NOTHING;
  SELECT id INTO sec_id FROM public.encuesta_secciones WHERE encuesta_id = enc_id AND orden = 2;

  INSERT INTO public.preguntas (seccion_id, texto, tipo, valor_minimo, valor_maximo, unidad, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, 'Del 1 al 10, ¿qué tan motivado/a te sentís para continuar la carrera?',
     'escala', 1, 10, 'escala', 1, true, cat_bienestar, 12);

  INSERT INTO public.preguntas (seccion_id, texto, tipo, opciones, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, '¿Sentís que necesitás apoyo adicional (tutoría, clases de consulta, ayuda psicológica)?', 'unica',
     '["No, estoy bien", "Tal vez me servirían las clases de consulta", "Creo que necesitaría una tutoría", "Sí, necesito ayuda urgente"]',
     2, true, cat_riesgo, 15);

  INSERT INTO public.preguntas (seccion_id, texto, tipo, opciones, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, '¿Consideraste dejar la carrera en algún momento de este cuatrimestre?', 'unica',
     '["No, nunca lo pensé", "Lo pensé pero fue pasajero", "Lo consideré seriamente", "Ya decidí cambiarme de carrera"]',
     3, true, cat_riesgo, 18);

  INSERT INTO public.preguntas (seccion_id, texto, tipo, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, '¿Hay algo más que quieras contarnos sobre tu experiencia este cuatrimestre?', 'texto',
     4, false, cat_bienestar, 0);

END $$;

-- 5.3 GUÍA DE ENTREVISTA (1 sección, 5 preguntas, inactiva)
DO $$
DECLARE
  enc_id uuid;
  sec_id uuid;
  cat_riesgo uuid;
  cat_bienestar uuid;
BEGIN
  SELECT id INTO enc_id FROM public.encuestas WHERE tipo = 'entrevista';
  IF enc_id IS NULL THEN RETURN; END IF;
  SELECT id INTO cat_riesgo    FROM public.categorias_pregunta WHERE nombre = 'Factores de Riesgo' LIMIT 1;
  SELECT id INTO cat_bienestar FROM public.categorias_pregunta WHERE nombre = 'Bienestar General' LIMIT 1;

  INSERT INTO public.encuesta_secciones (encuesta_id, titulo, descripcion, orden) VALUES
    (enc_id, 'Entrevista de Tutoría', 'Preguntas guía para la entrevista personal con el estudiante', 1)
  ON CONFLICT DO NOTHING;
  SELECT id INTO sec_id FROM public.encuesta_secciones WHERE encuesta_id = enc_id AND orden = 1;

  INSERT INTO public.preguntas (seccion_id, texto, tipo, opciones, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, '¿Cómo percibe el tutor el estado general del alumno?', 'unica',
     '["Muy buen estado, motivado y sin señales de riesgo", "Buen estado general, algunas áreas a seguir", "Estado preocupante, muestra señales de agotamiento o desinterés", "Estado crítico, se recomienda intervención inmediata"]',
     1, true, cat_bienestar, 10);

  INSERT INTO public.preguntas (seccion_id, texto, tipo, opciones, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, '¿Se detectaron factores de riesgo significativos?', 'multiple',
     '["Dificultades económicas", "Problemas de salud", "Problemas familiares", "Falta de motivación", "Dificultades académicas severas", "Aislamiento social", "Problemas laborales", "Ninguno"]',
     2, true, cat_riesgo, 20);

  INSERT INTO public.preguntas (seccion_id, texto, tipo, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, 'Resumen de la entrevista y principales puntos tratados', 'texto',
     3, true, cat_bienestar, 0);

  INSERT INTO public.preguntas (seccion_id, texto, tipo, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, 'Compromisos y acuerdos establecidos con el alumno', 'texto',
     4, true, cat_bienestar, 0);

  INSERT INTO public.preguntas (seccion_id, texto, tipo, opciones, orden, es_obligatoria, categoria_id, peso_defecto) VALUES
    (sec_id, '¿Se requiere seguimiento adicional?', 'unica',
     '["No, el alumno está en buen camino", "Sí, programar otra entrevista en 1 mes", "Sí, seguimiento cercano (cada 15 días)", "Sí, derivar a contención psicológica o académica urgente"]',
     5, true, cat_riesgo, 15);

END $$;

-- -------------------------------------------------------------------------
-- 6. SCORING OPCIONES — Puntaje de riesgo por respuesta
--    Valores más altos = más riesgo
-- -------------------------------------------------------------------------
INSERT INTO public.scoring_opciones (pregunta_id, opcion_valor, score)
SELECT p.id, v.opcion, v.score
FROM (VALUES
  -- Encuesta Inicial: ¿Cómo te sentís con la carrera?
  ('¿Cómo te sentís con la carrera hasta ahora?', 'Muy motivado/a', 0),
  ('¿Cómo te sentís con la carrera hasta ahora?', 'Bastante bien', 5),
  ('¿Cómo te sentís con la carrera hasta ahora?', 'Todavía no sé', 15),
  ('¿Cómo te sentís con la carrera hasta ahora?', 'Un poco inseguro/a', 25),
  ('¿Cómo te sentís con la carrera hasta ahora?', 'No me gusta / Quiero cambiarme', 40),
  -- Encuesta Inicial: espacio de estudio
  ('¿Contás con un espacio adecuado para estudiar en tu casa?', 'Sí, tengo un espacio tranquilo', 0),
  ('¿Contás con un espacio adecuado para estudiar en tu casa?', 'Más o menos, a veces me cuesta concentrarme', 10),
  ('¿Contás con un espacio adecuado para estudiar en tu casa?', 'No, es difícil estudiar donde vivo', 25),
  -- Encuesta Inicial: trabajás
  ('¿Trabajás actualmente?', 'No trabajo', 0),
  ('¿Trabajás actualmente?', 'Trabajo medio tiempo (hasta 20 h/sem)', 10),
  ('¿Trabajás actualmente?', 'Trabajo tiempo parcial (20-35 h/sem)', 20),
  ('¿Trabajás actualmente?', 'Trabajo tiempo completo (35+ h/sem)', 35),
  -- Encuesta Inicial: personas a cargo
  ('¿Tenés personas a cargo (hijos, hermanos, padres)?', 'No', 0),
  ('¿Tenés personas a cargo (hijos, hermanos, padres)?', 'Sí, pero no interfiere con el estudio', 10),
  ('¿Tenés personas a cargo (hijos, hermanos, padres)?', 'Sí, y afecta mi disponibilidad horaria', 25),
  -- Encuesta Cuatrimestral: ritmo de clases
  ('¿Tuviste dificultades para seguir el ritmo de las clases?', 'No, pude seguir sin problemas', 0),
  ('¿Tuviste dificultades para seguir el ritmo de las clases?', 'En algunas materias me costó', 10),
  ('¿Tuviste dificultades para seguir el ritmo de las clases?', 'En la mayoría me costó seguir', 25),
  ('¿Tuviste dificultades para seguir el ritmo de las clases?', 'Sí, me sentí muy perdido/a', 40),
  -- Encuesta Cuatrimestral: tiempo de estudio
  ('¿Cuánto tiempo semanal dedicaste al estudio fuera de clase?', 'Más de 20 horas', 0),
  ('¿Cuánto tiempo semanal dedicaste al estudio fuera de clase?', 'Entre 10 y 20 horas', 5),
  ('¿Cuánto tiempo semanal dedicaste al estudio fuera de clase?', 'Entre 5 y 10 horas', 15),
  ('¿Cuánto tiempo semanal dedicaste al estudio fuera de clase?', 'Menos de 5 horas', 30),
  -- Encuesta Cuatrimestral: necesitás apoyo
  ('¿Sentís que necesitás apoyo adicional?', 'No, estoy bien', 0),
  ('¿Sentís que necesitás apoyo adicional?', 'Tal vez me servirían las clases de consulta', 5),
  ('¿Sentís que necesitás apoyo adicional?', 'Creo que necesitaría una tutoría', 15),
  ('¿Sentís que necesitás apoyo adicional?', 'Sí, necesito ayuda urgente', 30),
  -- Encuesta Cuatrimestral: consideraste dejar
  ('¿Consideraste dejar la carrera en algún momento de este cuatrimestre?', 'No, nunca lo pensé', 0),
  ('¿Consideraste dejar la carrera en algún momento de este cuatrimestre?', 'Lo pensé pero fue pasajero', 10),
  ('¿Consideraste dejar la carrera en algún momento de este cuatrimestre?', 'Lo consideré seriamente', 30),
  ('¿Consideraste dejar la carrera en algún momento de este cuatrimestre?', 'Ya decidí cambiarme de carrera', 50),
  -- Guía Entrevista: estado del alumno
  ('¿Cómo percibe el tutor el estado general del alumno?', 'Muy buen estado, motivado y sin señales de riesgo', 0),
  ('¿Cómo percibe el tutor el estado general del alumno?', 'Buen estado general, algunas áreas a seguir', 10),
  ('¿Cómo percibe el tutor el estado general del alumno?', 'Estado preocupante, muestra señales de agotamiento o desinterés', 30),
  ('¿Cómo percibe el tutor el estado general del alumno?', 'Estado crítico, se recomienda intervención inmediata', 50),
  -- Guía Entrevista: seguimiento
  ('¿Se requiere seguimiento adicional?', 'No, el alumno está en buen camino', 0),
  ('¿Se requiere seguimiento adicional?', 'Sí, programar otra entrevista en 1 mes', 10),
  ('¿Se requiere seguimiento adicional?', 'Sí, seguimiento cercano (cada 15 días)', 25),
  ('¿Se requiere seguimiento adicional?', 'Sí, derivar a contención psicológica o académica urgente', 45)
) AS v(texto_pregunta, opcion, score)
JOIN public.preguntas p ON p.texto = v.texto_pregunta
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------
-- 7. SCORING TRAMOS — Rangos numéricos con fórmulas de puntaje
-- -------------------------------------------------------------------------
INSERT INTO public.scoring_tramos (pregunta_id, orden, condicion_tipo, condicion_valor, condicion_valor_min, condicion_valor_max, formula)
SELECT p.id, v.orden, v.condicion_tipo::text, v.condicion_valor, v.condicion_valor_min, v.condicion_valor_max, v.formula
FROM (VALUES
  -- Horas de estudio semanales (a más horas, menos riesgo)
  ('¿Cuántas horas semanales dedicás al estudio fuera de clase?', 1, 'menor', NULL, NULL, 5, '40'),
  ('¿Cuántas horas semanales dedicás al estudio fuera de clase?', 2, 'entre', NULL, 5, 10, '25'),
  ('¿Cuántas horas semanales dedicás al estudio fuera de clase?', 3, 'entre', NULL, 10, 15, '10'),
  ('¿Cuántas horas semanales dedicás al estudio fuera de clase?', 4, 'mayor', NULL, 15, NULL, '0'),
  -- Apoyo familiar (1-10, a mayor puntaje menos riesgo)
  ('Del 1 al 10, ¿cuánto apoyo sentís de tu familia para estudiar?', 1, 'menor_igual', 3, NULL, NULL, '35'),
  ('Del 1 al 10, ¿cuánto apoyo sentís de tu familia para estudiar?', 2, 'entre', NULL, 4, 6, '20'),
  ('Del 1 al 10, ¿cuánto apoyo sentís de tu familia para estudiar?', 3, 'entre', NULL, 7, 8, '5'),
  ('Del 1 al 10, ¿cuánto apoyo sentís de tu familia para estudiar?', 4, 'mayor', NULL, 8, NULL, '0'),
  -- Rendimiento cuatrimestral (1-10, a mayor puntaje menos riesgo)
  ('Del 1 al 10, ¿cómo evaluás tu rendimiento académico este cuatrimestre?', 1, 'menor_igual', 3, NULL, NULL, '45'),
  ('Del 1 al 10, ¿cómo evaluás tu rendimiento académico este cuatrimestre?', 2, 'entre', NULL, 4, 5, '30'),
  ('Del 1 al 10, ¿cómo evaluás tu rendimiento académico este cuatrimestre?', 3, 'entre', NULL, 6, 7, '15'),
  ('Del 1 al 10, ¿cómo evaluás tu rendimiento académico este cuatrimestre?', 4, 'entre', NULL, 8, 9, '5'),
  ('Del 1 al 10, ¿cómo evaluás tu rendimiento académico este cuatrimestre?', 5, 'mayor', NULL, 9, NULL, '0'),
  -- Motivación (1-10, a mayor puntaje menos riesgo)
  ('Del 1 al 10, ¿qué tan motivado/a te sentís para continuar la carrera?', 1, 'menor_igual', 3, NULL, NULL, '40'),
  ('Del 1 al 10, ¿qué tan motivado/a te sentís para continuar la carrera?', 2, 'entre', NULL, 4, 5, '25'),
  ('Del 1 al 10, ¿qué tan motivado/a te sentís para continuar la carrera?', 3, 'entre', NULL, 6, 7, '10'),
  ('Del 1 al 10, ¿qué tan motivado/a te sentís para continuar la carrera?', 4, 'mayor', NULL, 7, NULL, '0')
) AS v(texto_pregunta, orden, condicion_tipo, condicion_valor, condicion_valor_min, condicion_valor_max, formula)
JOIN public.preguntas p ON p.texto = v.texto_pregunta
ON CONFLICT DO NOTHING;
