import { supabase } from '../lib/supabase';

export const getUltimoScore = async (estudianteId: string) => {
  return await supabase
    .from('scores')
    .select('valor, nivel_riesgo, calculado_at, componentes')
    .eq('estudiante_id', estudianteId)
    .order('calculado_at', { ascending: false })
    .limit(1)
    .single();
};

export const getHistorialScores = async (estudianteId: string) => {
  return await supabase
    .from('scores')
    .select('valor, nivel_riesgo, calculado_at, cuatrimestre, anio')
    .eq('estudiante_id', estudianteId)
    .order('calculado_at', { ascending: true });
};

export const getDistribucionCohorte = async (carreraId: string) => {
  return await supabase
    .from('scores')
    .select(`
      nivel_riesgo,
      estudiantes!inner (carrera_id)
    `)
    .eq('estudiantes.carrera_id', carreraId);
};

export const recalcularScore = async (estudianteId: string) => {
  return await supabase.functions.invoke('calcular-score', {
    body: { estudiante_id: estudianteId }
  });
};
