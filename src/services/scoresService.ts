import { supabase } from '../lib/supabase';
import { DistribucionCohorte } from '../types/database';

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
    .rpc('get_distribucion_cohorte', { p_carrera_id: carreraId })
    .single();
};

export const recalcularScore = async (estudianteId: string) => {
  return await supabase.functions.invoke('calcular-score', {
    body: { estudiante_id: estudianteId }
  });
};
