import { useEffect, useState } from 'react';
import { getPlanEstudios, getProgresoEstudiante, getMateriasHabilitadas } from '../services/planService';

export const usePlan = (carreraId?: string, estudianteId?: string) => {
  const [plan, setPlan] = useState<any[]>([]);
  const [progreso, setProgreso] = useState<any[]>([]);
  const [materiasHabilitadas, setMateriasHabilitadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(prev => prev + 1);

  useEffect(() => {
    async function fetchData() {
      try {
        if (refreshKey === 0) setLoading(true);
        if (carreraId) {
          const { data: planData } = await getPlanEstudios(carreraId);
          setPlan(planData ?? []);
        }
        
        if (estudianteId) {
          const { data: progData } = await getProgresoEstudiante(estudianteId);
          setProgreso(progData ?? []);
        }
        
        if (estudianteId && carreraId) {
          const { data: habData } = await getMateriasHabilitadas(estudianteId, carreraId);
          setMateriasHabilitadas(habData ?? []);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (carreraId || estudianteId) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [carreraId, estudianteId, refreshKey]);

  return { plan, progreso, materiasHabilitadas, loading, error, refresh };
};
