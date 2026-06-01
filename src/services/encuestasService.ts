import { supabase } from '../lib/supabase';

export const getEncuestaActiva = async (
  tipo: 'inicial' | 'cuatrimestral' | 'entrevista'
) => {
  return await supabase
    .from('encuestas')
    .select(`
      id, titulo, descripcion, tipo,
      encuesta_secciones (
        id, titulo, descripcion, orden,
        preguntas (
          id, texto, tipo, orden, obligatoria,
          opciones, escala_min, escala_max,
          aplica_por_materia, peso_defecto
        )
      )
    `)
    .eq('tipo', tipo)
    .eq('activa', true)
    .order('orden', { referencedTable: 'encuesta_secciones' })
    .order('orden', { referencedTable: 'encuesta_secciones.preguntas' })
    .single();
};

export const verificarEncuestaInicial = async (estudianteId: string) => {
  const { data } = await supabase
    .from('estudiantes')
    .select('encuesta_inicial_completada')
    .eq('usuario_id', estudianteId)
    .single();
  return data?.encuesta_inicial_completada ?? false;
};

export const getSesionExistente = async (
  encuestaId: string,
  estudianteId: string,
  cuatrimestre: number,
  anio: number
) => {
  return await supabase
    .from('sesiones_encuesta')
    .select('id, estado')
    .eq('encuesta_id', encuestaId)
    .eq('estudiante_id', estudianteId)
    .eq('cuatrimestre', cuatrimestre)
    .eq('anio', anio)
    .maybeSingle();
};

export const crearSesionEncuesta = async (
  encuestaId: string,
  estudianteId: string,
  cuatrimestre: number,
  anio: number
) => {
  return await supabase
    .from('sesiones_encuesta')
    .insert({
      encuesta_id: encuestaId,
      estudiante_id: estudianteId,
      cuatrimestre,
      anio,
      estado: 'en_progreso',
      iniciada_at: new Date().toISOString()
    })
    .select()
    .single();
};

export const guardarRespuesta = async (
  sesionId: string,
  preguntaId: string,
  valor: string,
  materiaId?: string | null
) => {
  return await supabase
    .from('respuestas')
    .upsert({
      sesion_id: sesionId,
      pregunta_id: preguntaId,
      materia_id: materiaId ?? null,
      valor,
      es_confiable: false
    }, {
      onConflict: 'sesion_id,pregunta_id,materia_id'
    });
};

export const guardarCursada = async (cursada: {
  estudiante_id: string;
  materia_id: string;
  cuatrimestre: number;
  anio: number;
  situacion: 'promovio' | 'habilito' | 'desaprobo' | 'abandono';
  nota_cursada?: number;
  como_se_sintio?: string;
  dificultades?: string[];
  dedicacion?: string;
  ritmo_estudio?: string;
  tiene_materiales?: boolean;
}) => {
  const { count } = await supabase
    .from('cursadas')
    .select('id', { count: 'exact', head: true })
    .eq('estudiante_id', cursada.estudiante_id)
    .eq('materia_id', cursada.materia_id);

  return await supabase
    .from('cursadas')
    .insert({
      ...cursada,
      numero_cursada: (count ?? 0) + 1,
      es_confiable: false
    })
    .select()
    .single();
};

export const guardarFinal = async (final: {
  cursada_id: string;
  estudiante_id: string;
  materia_id: string;
  nota?: number;
  resultado: 'aprobado' | 'desaprobado' | 'ausente';
  fecha_intento?: string;
}) => {
  const { count } = await supabase
    .from('finales')
    .select('id', { count: 'exact', head: true })
    .eq('estudiante_id', final.estudiante_id)
    .eq('materia_id', final.materia_id);

  return await supabase
    .from('finales')
    .insert({
      ...final,
      numero_intento: (count ?? 0) + 1,
      es_confiable: false
    });
};

export const completarEncuesta = async (
  sesionId: string,
  estudianteId: string,
  esInicial: boolean
) => {
  await supabase
    .from('sesiones_encuesta')
    .update({
      estado: 'completada',
      completada_at: new Date().toISOString()
    })
    .eq('id', sesionId);

  if (esInicial) {
    await supabase
      .from('estudiantes')
      .update({ encuesta_inicial_completada: true })
      .eq('usuario_id', estudianteId);
  }

  return await supabase.functions.invoke('calcular-score', {
    body: { estudiante_id: estudianteId }
  });
};
