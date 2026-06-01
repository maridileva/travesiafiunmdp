import { useEffect, useState } from 'react';
import { getUltimoScore, getHistorialScores, getDistribucionCohorte } from '../services/scoresService';

export const useScore = (estudianteId?: string, carreraId?: string) => {
  const [ultimoScore, setUltimoScore] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [distribucion, setDistribucion] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchScores() {
      try {
        setLoading(true);
        if (estudianteId) {
          const { data: ultimoData } = await getUltimoScore(estudianteId);
          setUltimoScore(ultimoData);
          
          const { data: historialData } = await getHistorialScores(estudianteId);
          setHistorial(historialData ?? []);
        }
        
        if (carreraId) {
          const { data: distData } = await getDistribucionCohorte(carreraId);
          setDistribucion(distData ?? []);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (estudianteId || carreraId) {
      fetchScores();
    } else {
      setLoading(false);
    }
  }, [estudianteId, carreraId]);

  return { ultimoScore, historial, distribucion, loading, error };
};
