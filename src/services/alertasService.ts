import { supabase } from '../lib/supabase';

export const getAlertasPendientes = async (tutorId: string) => {
  return await supabase
    .from('alertas')
    .select(`
      id, tipo, descripcion, created_at, origen,
      usuarios!estudiante_id (id, nombre, apellido, legajo)
    `)
    .eq('tutor_id', tutorId)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false });
};

export const crearAlertaAyuda = async (estudianteId: string) => {
  const { data: asignacion } = await supabase
    .from('asignaciones_tutor')
    .select('tutor_id')
    .eq('estudiante_id', estudianteId)
    .eq('activa', true)
    .single();

  return await supabase
    .from('alertas')
    .insert({
      estudiante_id: estudianteId,
      tutor_id: asignacion?.tutor_id ?? null,
      tipo: 'solicitud_ayuda',
      origen: 'solicitud_alumno',
      estado: 'pendiente'
    });
};

export const resolverAlerta = async (alertaId: string, resueltaPor: string) => {
  return await supabase
    .from('alertas')
    .update({
      estado: 'resuelta',
      resuelta_at: new Date().toISOString(),
      resuelta_por: resueltaPor
    })
    .eq('id', alertaId);
};
