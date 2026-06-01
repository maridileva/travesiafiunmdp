CREATE OR REPLACE FUNCTION get_materias_habilitadas(
  p_estudiante_id uuid,
  p_carrera_id    uuid
)
RETURNS TABLE (materia_id uuid, nombre text, codigo text, anio_teorico int)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT
    m.id        AS materia_id,
    m.nombre,
    m.codigo,
    pe.anio_teorico
  FROM plan_estudios pe
  JOIN materias m ON m.id = pe.materia_id
  WHERE pe.carrera_id = p_carrera_id
    -- Excluir materias ya aprobadas
    AND NOT EXISTS (
      SELECT 1 FROM progreso_estudiante pg
      WHERE pg.estudiante_id = p_estudiante_id
        AND pg.materia_id = m.id
        AND pg.estado = 'aprobada'
    )
    -- Incluir solo si todas las correlativas están aprobadas
    AND NOT EXISTS (
      SELECT 1 FROM correlativas c
      WHERE c.materia_id = m.id
        AND NOT EXISTS (
          SELECT 1 FROM progreso_estudiante pg2
          WHERE pg2.estudiante_id = p_estudiante_id
            AND pg2.materia_id = c.materia_requerida_id
            AND pg2.estado = 'aprobada'
        )
    )
  ORDER BY pe.anio_teorico;
$$;
