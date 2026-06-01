import { useEffect, useState } from 'react';
import { getMiPerfil } from '../services/estudiantesService';

export const usePerfil = (userId?: string) => {
  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPerfil() {
      try {
        setLoading(true);
        if (userId) {
          const { data, error } = await getMiPerfil(userId);
          if (error) throw error;
          setPerfil(data);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchPerfil();
    } else {
      setLoading(false);
    }
  }, [userId]);

  return { perfil, loading, error };
};
