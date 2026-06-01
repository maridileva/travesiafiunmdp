import { supabase } from '../lib/supabase';
import type { CategoriaPregunta } from '../types/database';

export const getCategorias = async () => {
  const { data, error } = await supabase
    .from('categorias_pregunta')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as CategoriaPregunta[];
};

export const createCategoria = async (categoria: Omit<CategoriaPregunta, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('categorias_pregunta')
    .insert(categoria)
    .select()
    .single();

  if (error) throw error;
  return data as CategoriaPregunta;
};

export const updateCategoria = async (id: string, categoria: Partial<Omit<CategoriaPregunta, 'id' | 'created_at'>>) => {
  const { data, error } = await supabase
    .from('categorias_pregunta')
    .update(categoria)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as CategoriaPregunta;
};

export const deleteCategoria = async (id: string) => {
  // First check if there are associated questions
  const { count, error: countError } = await supabase
    .from('preguntas')
    .select('id', { count: 'exact', head: true })
    .eq('categoria_id', id);

  if (countError) throw countError;
  
  if (count && count > 0) {
    throw new Error(`Esta categoría tiene ${count} preguntas asociadas. Reasignálas antes de eliminarla.`);
  }

  const { error } = await supabase
    .from('categorias_pregunta')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
