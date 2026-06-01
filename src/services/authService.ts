import { supabase } from '../lib/supabase';

export const signIn = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({ email, password });
};

export const signOut = async () => {
  return await supabase.auth.signOut();
};

export const getSession = async () => {
  return await supabase.auth.getSession();
};

export const getRolUsuario = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuario_roles')
    .select('rol, carrera_id')
    .eq('usuario_id', userId)
    .eq('activo', true)
    .limit(1);

  if (error) {
    console.error('Error getting rol:', error);
    return { data: null, error };
  }

  return { data: data && data.length > 0 ? data[0] : null, error: null };
};
