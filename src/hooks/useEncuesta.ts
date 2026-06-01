import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  getEncuestaActiva, 
  verificarEncuestaInicial, 
  getSesionExistente, 
  crearSesionEncuesta 
} from '../services/encuestasService';

export const useEncuesta = (estudianteId?: string, tipo: 'inicial' | 'cuatrimestral' = 'cuatrimestral') => {
  const [encuesta, setEncuesta] = useState<any>(null);
  const [sesion, setSesion] = useState<any>(null);
  const [requiereInicial, setRequiereInicial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        if (!estudianteId) return;

        // Verificar si necesita la inicial primero
        if (tipo === 'cuatrimestral') {
          const completoInicial = await verificarEncuestaInicial(estudianteId);
          if (!completoInicial) {
            setRequiereInicial(true);
            setLoading(false);
            return;
          }
        }

        // Obtener la estructura
        const { data: encData, error: encError } = await getEncuestaActiva(tipo);
        if (encError) throw encError;
        setEncuesta(encData);

        // Current term logic
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const cuatrimestre = currentMonth < 6 ? 1 : 2;

        if (encData) {
          // Verificar o crear sesión
          const { data: existingSession } = await getSesionExistente(
            encData.id, 
            estudianteId, 
            cuatrimestre, 
            currentYear
          );

          if (existingSession) {
            setSesion(existingSession);
          } else {
            const { data: newSession, error: createErr } = await crearSesionEncuesta(
              encData.id,
              estudianteId,
              cuatrimestre,
              currentYear
            );
            if (createErr) throw createErr;
            setSesion(newSession);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [estudianteId, tipo]);

  return { encuesta, sesion, requiereInicial, loading, error };
};
