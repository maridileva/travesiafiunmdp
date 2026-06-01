import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getRolUsuario } from '../services/authService';
import { User, Session } from '@supabase/supabase-js';

// Use a simple module-level cache to share state immediately between hooks
let authState = {
  usuario: null as User | null,
  rol: null as string | null,
  isInitialized: false,
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

let isInitializing = false;
const initAuth = () => {
  if (isInitializing || authState.isInitialized) return;
  isInitializing = true;

  const resolveSession = async (session: Session | null) => {
    if (session?.user) {
      if (!authState.usuario || authState.usuario.id !== session.user.id) {
         authState.isInitialized = false;
         authState.rol = null;
      }
      authState.usuario = session.user;
      notify(); // Notify early so UI reacts
      
      try {
        const { data } = await getRolUsuario(session.user.id);
        authState.rol = data?.rol ?? null;
      } catch (e) {
        authState.rol = null;
      }
    } else {
      authState.usuario = null;
      authState.rol = null;
    }
    
    authState.isInitialized = true;
    notify();
  };

  supabase.auth.getSession().then(({ data: { session } }) => {
    resolveSession(session);
  });

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') return;
    if (event === 'SIGNED_OUT') {
       authState.usuario = null;
       authState.rol = null;
       authState.isInitialized = true;
       notify();
       return;
    }
    resolveSession(session);
  });
};

export const useAuth = () => {
  const [state, setState] = useState(authState);

  useEffect(() => {
    initAuth();
    
    const handler = () => setState({ ...authState });
    listeners.add(handler);
    handler(); // Sync immediately in case it changed
    
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    usuario: state.usuario,
    rol: state.rol,
    loading: !state.isInitialized
  };
};
