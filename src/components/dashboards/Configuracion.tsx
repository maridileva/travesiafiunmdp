import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Settings, Save, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/moving-border';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface Indicador {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  peso: number;
}

export const Configuracion = () => {
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchIndicadores();
  }, []);

  const fetchIndicadores = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('indicadores')
        .select('*')
        .order('id');
      
      if (error) throw error;
      setIndicadores(data || []);
    } catch (error: any) {
      console.error('Error fetching indicadores:', error);
      setMessage({ type: 'error', text: 'Error al cargar la configuración.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePesoChange = (id: string, value: string) => {
    const defaultPeso = 0;
    let numValue = parseInt(value, 10);
    if (isNaN(numValue)) numValue = defaultPeso;

    setIndicadores(prev => prev.map(ind => 
      ind.id === id ? { ...ind, peso: numValue } : ind
    ));
  };

  const handleSave = async () => {
    // Validar que sumen 100
    const sum = indicadores.reduce((acc, curr) => acc + (curr.activo ? curr.peso : 0), 0);
    if (sum !== 100 && indicadores.length > 0) {
      toast.error('La suma total de pesos debe ser 100%');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      for (const ind of indicadores) {
        const { error } = await supabase
          .from('indicadores')
          .update({ peso: ind.peso })
          .eq('id', ind.id);
        if (error) throw error;
      }
      toast.success('Configuración guardada correctamente.');
    } catch (error: any) {
      console.error('Error saving indicadores:', error);
      toast.error('Error al guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400 min-h-[50vh] flex items-center justify-center">Cargando...</div>;
  }

  const activeSum = indicadores.reduce((acc, curr) => acc + (curr.activo ? curr.peso : 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <Settings className="w-5 h-5 text-blue-400" />
            </div>
            Configuración del Sistema
          </h1>
          <p className="text-sm text-slate-500 font-sans mt-2">
            Ajustes globales y pesos del motor de scoring de riesgo.
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
           <Button 
              onClick={handleSave}
              disabled={saving}
              borderRadius="0.5rem"
              duration={2500}
              containerClassName="h-10 w-auto text-white flex items-center"
              className="px-4 py-2 text-sm font-medium text-white bg-[#0F1B2D]/90 flex items-center gap-2 whitespace-nowrap"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin text-teal-400" /> : <Save className="w-4 h-4 text-teal-400" />} Guardar Cambios
          </Button>
          {activeSum !== 100 && (
             <span className="text-xs text-amber-400 flex items-center gap-1">
                 <AlertCircle className="w-3 h-3" />
                 Los pesos activos suman {activeSum}%, deberían ser 100%.
             </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         {indicadores.length === 0 ? (
            <div className="col-span-full text-center text-slate-500 py-12 bg-white/[0.02] border border-white/[0.05] rounded-xl border-dashed">
                <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                No se encontraron indicadores en la base de datos.<br />
                Debe inicializar la base de datos con los valores base.
            </div>
         ) : indicadores.map((ind, i) => (
             <motion.div
               key={ind.id}
               initial={{ opacity: 0, y: 16 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.08 }}
               className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between"
             >
               <div className="flex justify-between items-start mb-4">
                  <div>
                      <h3 className="text-slate-200 font-display font-medium mb-1">{ind.nombre}</h3>
                      <p className="text-xs text-slate-500 font-sans leading-relaxed pr-4">{ind.descripcion}</p>
                  </div>
                  <div>
                      {ind.activo ? (
                          <span className="px-2 py-1 bg-teal-500/10 text-teal-400 rounded-md text-[10px] uppercase font-bold tracking-wider border border-teal-500/20 shrink-0">Activo</span>
                      ) : (
                          <span className="px-2 py-1 bg-slate-500/10 text-slate-400 rounded-md text-[10px] uppercase font-bold tracking-wider border border-slate-500/20 shrink-0">Inactivo</span>
                      )}
                  </div>
               </div>
               
               <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.05]">
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-600">Peso en Motor</span>
                  <div className="flex items-center gap-2">
                      <input 
                         type="number" 
                         min="0" 
                         max="100" 
                         value={ind.peso === 0 && !ind.activo ? '' : ind.peso} 
                         onChange={(e) => handlePesoChange(ind.id, e.target.value)}
                         className="w-16 bg-white/[0.03] border border-white/[0.1] rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500/50 text-right font-mono text-sm"
                      />
                      <span className="text-slate-500 font-mono text-sm">%</span>
                  </div>
               </div>
             </motion.div>
         ))}
      </div>

      {indicadores.length > 0 && (
         <div className="flex justify-end pr-4">
             <div className="flex items-center gap-4 text-sm bg-white/[0.04] border border-white/[0.07] px-6 py-3 rounded-xl">
                 <span className="text-slate-400 font-sans">Suma Total de Pesos:</span>
                 <span className={`font-mono font-bold text-lg ${activeSum === 100 ? 'text-teal-400' : 'text-amber-400'}`}>
                     {activeSum}%
                 </span>
             </div>
         </div>
      )}
    </div>
  );
};
