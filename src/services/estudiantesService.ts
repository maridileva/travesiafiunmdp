import { supabase } from '../lib/supabase';

export const getEstudiantesDelTutor = async (tutorId: string) => {
  return await supabase
    .from('asignaciones_tutor')
    .select(`
      estudiante_id,
      usuarios!asignaciones_tutor_estudiante_id_fkey (
  id, nombre, apellido, email, legajo
),
estudiantes (
  carrera_id, anio_ingreso
)
    .eq('tutor_id', tutorId)
    .eq('activa', true);
};

export const getEstudiantesPorCarrera = async (carreraId: string) => {
  return await supabase
    .from('estudiantes')
    .select(`
      usuario_id, anio_ingreso, carrera_id,
      usuarios!usuario_id (id, nombre, apellido, email, legajo)
    `)
    .eq('carrera_id', carreraId);
};

export const getPerfilEstudiante = async (estudianteId: string) => {
  return await supabase
    .from('usuarios')
    .select(`
      id, nombre, apellido, email, legajo,
      estudiantes (
        carrera_id, anio_ingreso,
        encuesta_inicial_completada
      )
    `)
    .eq('id', estudianteId)
    .single();
};

export const getMiPerfil = async (userId: string) => {
  return await supabase
    .from('usuarios')
    .select('id, nombre, apellido, email, legajo, estudiantes(*)')
    .eq('id', userId)
    .single();
};
