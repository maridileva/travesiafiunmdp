import { supabase } from '../lib/supabase';

export const getPlanEstudios = async (carreraId: string) => {
  return await supabase
    .from('plan_estudios')
    .select(`
      id, anio_teorico, cuatrimestre, tipo, es_critica,
      materias (id, nombre, codigo, creditos)
    `)
    .eq('carrera_id', carreraId)
    .order('anio_teorico')
    .order('cuatrimestre');
};

export const getProgresoEstudiante = async (estudianteId: string) => {
  return await supabase
    .from('progreso_estudiante')
    .select(`
      estado, nota_final, updated_at,
      materias (id, nombre, codigo)
    `)
    .eq('estudiante_id', estudianteId);
};

export const getMateriasHabilitadas = async (
  estudianteId: string,
  carreraId: string
) => {
  return await supabase.rpc('get_materias_habilitadas', {
    p_estudiante_id: estudianteId,
    p_carrera_id: carreraId
  });
};

export const upsertMateriaPlan = async (materia: {
  materia_id?: string;
  carrera_id: string;
  nombre: string;
  codigo: string;
  anio_teorico: number;
  cuatrimestre: number;
  tipo: string;
  es_critica: boolean;
}) => {
  const materiaQuery = supabase.from('materias');
  
  let matId = materia.materia_id;

  if (matId) {
    const { error } = await materiaQuery.update({ nombre: materia.nombre, codigo: materia.codigo }).eq('id', matId);
    if (error) return { error };
  } else {
    const { data: mat, error: matError } = await materiaQuery.upsert(
      { nombre: materia.nombre, codigo: materia.codigo, carrera_id: materia.carrera_id },
      { onConflict: 'carrera_id,codigo' }
    ).select('id').single();
    if (matError) return { error: matError };
    matId = mat.id;
  }

  return await supabase
    .from('plan_estudios')
    .upsert({
      carrera_id: materia.carrera_id,
      materia_id: matId,
      anio_teorico: materia.anio_teorico,
      cuatrimestre: materia.cuatrimestre,
      tipo: materia.tipo,
      es_critica: materia.es_critica
    }, {
      onConflict: 'carrera_id,materia_id'
    });
};

export const getCorrelativas = async (materiaId: string) => {
  return await supabase
    .from('correlativas')
    .select(`
      tipo,
      materias!materia_requerida_id (id, nombre, codigo)
    `)
    .eq('materia_id', materiaId);
};

export const setCorrelativas = async (
  materiaId: string,
  correlativas: { materia_requerida_id: string; tipo: 'aprobada' | 'cursada' }[]
) => {
  await supabase.from('correlativas').delete().eq('materia_id', materiaId);

  if (correlativas.length === 0) return { error: null };
  return await supabase.from('correlativas').insert(
    correlativas.map(c => ({ materia_id: materiaId, ...c }))
  );
};
