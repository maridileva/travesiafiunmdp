import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getAlertasPendientes } from '../services/alertasService';

export const useAlertas = (tutorId: string) => {
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAlertasPendientes(tutorId)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setAlertas(data ?? []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`alertas-tutor-${tutorId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'alertas',
        filter: `tutor_id=eq.${tutorId}`
      }, (payload) => {
        setAlertas(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tutorId]);

  return { alertas, loading, error };
};
