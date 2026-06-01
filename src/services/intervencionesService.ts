import { supabase } from '../lib/supabase';

export const crearIntervencion = async (intervencion: {
  estudiante_id: string;
  tutor_id: string;
  tipo: 'entrevista' | 'contacto_email' | 'contacto_telefono' | 'reunion_grupal';
  modalidad: 'presencial' | 'virtual' | 'telefonica';
  fecha_realizada: string;
  motivo: string;
  resumen: string;
  compromisos: string;
  proxima_accion: string;
}) => {
  return await supabase
    .from('intervenciones')
    .insert({ ...intervencion, estado: 'realizada' })
    .select()
    .single();
};

export const crearEntrevista = async (entrevista: {
  intervencion_id: string;
  motivo_entrevista: string;
  estado_alumno_percibido: 'bien' | 'regular' | 'en_riesgo' | 'critico';
  factores_riesgo: string[];
  acciones_acordadas: string;
  derivaciones?: string;
  seguimiento_requerido: boolean;
  notas_adicionales?: string;
}) => {
  return await supabase
    .from('entrevistas')
    .insert(entrevista);
};

export const getIntervencionesEstudiante = async (estudianteId: string) => {
  return await supabase
    .from('intervenciones')
    .select(`
      id, tipo, modalidad, fecha_realizada, estado,
      motivo, resumen, compromisos, proxima_accion,
      usuarios!tutor_id (nombre, apellido),
      entrevistas (estado_alumno_percibido, factores_riesgo)
    `)
    .eq('estudiante_id', estudianteId)
    .order('fecha_realizada', { ascending: false });
};
