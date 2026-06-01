import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getEstudiantesDelTutor, getEstudiantesPorCarrera } from '../services/estudiantesService';

export const useEstudiantes = (userId: string, role: string, carreraId?: string) => {
  const [estudiantes, setEstudiantes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEstudiantes() {
      try {
        setLoading(true);
        if (role === 'tutor' || role === 'asesor_par') {
          const { data, error } = await getEstudiantesDelTutor(userId);
          if (error) throw error;
          setEstudiantes(data ?? []);
        } else if ((role === 'admin' || role === 'docente') && carreraId) {
          const { data, error } = await getEstudiantesPorCarrera(carreraId);
          if (error) throw error;
          setEstudiantes(data ?? []);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (userId && role) {
      fetchEstudiantes();
    }
  }, [userId, role, carreraId]);

  return { estudiantes, loading, error };
};
