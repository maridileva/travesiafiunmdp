import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePerfil } from '../../hooks/usePerfil';
import { useEncuesta } from '../../hooks/useEncuesta';
import { usePlan } from '../../hooks/usePlan';
import { guardarRespuesta, guardarCursada, guardarFinal, completarEncuesta } from '../../services/encuestasService';
import { supabase } from '../../lib/supabase';
import { Send, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CustomSelect } from '../ui/CustomSelect';

export const Encuestas = () => {
  const { usuario } = useAuth();
  const { perfil } = usePerfil(usuario?.id);
  const { encuesta, sesion, requiereInicial, loading: encLoading } = useEncuesta(usuario?.id, 'cuatrimestral');
  const { materiasHabilitadas } = usePlan(perfil?.estudiantes?.carrera_id, usuario?.id);
  
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    satisfaction: 5,
    situacion: '',
    notas: {} as any
  });

  if (encLoading) return <div className="text-white text-center py-8">Cargando encuesta...</div>;

  if (requiereInicial) {
    return (
      <div className="text-white p-8 bg-gray-900 rounded-2xl">
        <h2 className="text-2xl font-bold mb-4">Aviso Importante</h2>
        <p className="mb-4">Debes completar la Encuesta Inicial antes de poder realizar la Encuesta Cuatrimestral.</p>
        <button onClick={() => navigate('/encuesta-inicial')} className="btn btn-primary bg-blue-600 border-none text-white hover:bg-blue-700">Ir a Encuesta Inicial</button>
      </div>
    );
  }

  // Si ya está completada
  if (sesion?.estado === 'completada' || submitted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900 rounded-2xl border border-gray-800 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-16 h-16 bg-teal-500/20 text-teal-400 rounded-full flex items-center justify-center mb-4">
          <Send className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">¡Gracias por completar la encuesta!</h2>
        <p className="text-gray-400 mb-6">Tus respuestas nos ayudan a acompañarte mejor.</p>
        <button className="btn btn-outline border-gray-700 text-gray-300" onClick={() => navigate('/dashboard')}>
          Volver al Inicio
        </button>
      </div>
    );
  }

  const handleNext = async () => {
    // Save partial answers here ideally
    setStep(step + 1);
  };

  const handlePrev = () => setStep(step - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sesion || !usuario) return;
    
    setIsSubmitting(true);
    try {
      // 1. Guardar respuestas generales
      await guardarRespuesta(sesion.id, 'satisfaction', formData.satisfaction.toString());
      if (formData.situacion) {
        await guardarRespuesta(sesion.id, 'situacion', formData.situacion);
      }

      // 2. Guardar materias cursadas
      const currentYear = new Date().getFullYear();
      const cuatr = new Date().getMonth() < 6 ? 1 : 2;

      for (const [materiaId, data] of Object.entries(formData.notas)) {
        const d = data as any;
        if (d.estado !== 'no_cursada') {
          if (d.estado === 'aprobada' || d.estado === 'desaprobada') {
            // Split flow: aprobada/desaprobada route to finales + progreso_estudiante
            // Insert cursadas row with situacion='desaprobo' as FK anchor for finales.cursada_id
            const cData = {
              estudiante_id: usuario.id,
              materia_id: materiaId,
              cuatrimestre: cuatr,
              anio: currentYear,
              situacion: 'desaprobo' as const,
            };
            const { data: cResp } = await guardarCursada(cData);

            if (cResp) {
              await guardarFinal({
                cursada_id: cResp.id,
                estudiante_id: usuario.id,
                materia_id: materiaId,
                resultado: d.estado === 'aprobada' ? 'aprobado' : 'desaprobado'
              });
            }

            // Upsert progreso_estudiante
            await supabase.from('progreso_estudiante').upsert({
              estudiante_id: usuario.id,
              materia_id: materiaId,
              estado: d.estado === 'aprobada' ? 'aprobada' : 'final_pendiente'
            }, { onConflict: 'estudiante_id,materia_id' });
          } else {
            // Normal cursada flow: promovio/habilito/desaprobo/abandono
            await guardarCursada({
              estudiante_id: usuario.id,
              materia_id: materiaId,
              cuatrimestre: cuatr,
              anio: currentYear,
              situacion: d.estado,
            });
          }
        }
      }

      // 3. Completar
      await completarEncuesta(sesion.id, usuario.id, false);
      setSubmitted(true);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-white mb-2">
          {encuesta?.titulo || "Encuesta Cuatrimestral"}
        </h1>
        <p className="text-gray-400 mb-6">{encuesta?.descripcion}</p>
        <ul className="steps w-full mb-8">
          <li className="step step-primary text-blue-500">Bienestar</li>
          <li className={step >= 2 ? "step step-primary text-blue-500" : "step text-gray-600"}>Rendimiento</li>
          <li className={step >= 3 ? "step step-primary text-blue-500" : "step text-gray-600"}>Confirmación</li>
        </ul>
      </header>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 md:p-8 shadow-xl">
        <form onSubmit={step === 3 ? handleSubmit : (e)=>{e.preventDefault(); handleNext();}}>
          
          <AnimatePresence mode="wait">
            
            {step === 1 && (
              <motion.div key="s1" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xl text-white font-semibold">1. Satisfacción general</h3>
                  <label className="block text-gray-400 text-sm">
                    En una escala del 1 al 10, ¿cómo evaluarías tu satisfacción con tu rendimiento y estado emocional en este cuatrimestre?
                  </label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min={1} max={10} 
                      className="range range-primary" 
                      value={formData.satisfaction}
                      onChange={e => setFormData({...formData, satisfaction: parseInt(e.target.value)})}
                    />
                    <span className="text-2xl font-bold font-mono text-white w-8">{formData.satisfaction}</span>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-gray-800">
                  <h3 className="text-xl text-white font-semibold">2. Situación de vida</h3>
                  <label className="block text-gray-400 text-sm">¿Ha habido algún cambio significativo en tu vida personal o laboral recientemente?</label>
                  <textarea 
                    className="textarea bg-gray-950 border-gray-700 w-full text-white" 
                    placeholder="Ej: Comencé a trabajar full-time..." 
                    rows={3}
                    value={formData.situacion}
                    onChange={e => setFormData({...formData, situacion: e.target.value})}
                  ></textarea>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="space-y-6">
                <div className="alert bg-gray-800 border-amber-500/30 text-amber-200 text-sm mb-6 flex-row flex">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>Seleccioná el estado actual de las materias que cursaste. Módulo simplificado para la FASE 2 de integración.</span>
                </div>

                <div className="space-y-4">
                  {materiasHabilitadas?.map(sub => (
                    <div key={sub.materia_id} className="p-4 rounded-xl border border-gray-800 bg-gray-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="font-medium text-white">{sub.nombre}</div>
                      <CustomSelect
                        className="w-full md:w-48"
                        value={formData.notas[sub.materia_id]?.estado || 'no_cursada'}
                        onChange={(v) => setFormData(p => ({
                          ...p, 
                          notas: { 
                            ...p.notas, 
                            [sub.materia_id]: { estado: v } 
                          }
                        }))}
                        options={[
                          { value: 'no_cursada', label: 'No la cursé' },
                          { value: 'habilito', label: 'Habilitó' },
                          { value: 'promovio', label: 'Promovió' },
                          { value: 'aprobada', label: 'Aprobada (Final)' },
                          { value: 'desaprobada', label: 'Desaprobada' },
                          { value: 'abandono', label: 'Abandonó' }
                        ]}
                      />
                    </div>
                  ))}
                  {materiasHabilitadas?.length === 0 && (
                    <div className="text-gray-500 text-center py-4">No hay materias disponibles para cursar.</div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="space-y-6 text-center py-8">
                <h3 className="text-2xl text-white font-semibold mb-2">¡Todo listo!</h3>
                <p className="text-gray-400 mb-8 max-w-md mx-auto">Tus respuestas serán enviadas de forma segura. Tu tutor podrá revisar esta información para apoyarte de la mejor forma.</p>
                <div className="bg-gray-950 border border-gray-800 p-4 rounded-lg inline-block w-full max-w-sm text-left mx-auto">
                  <h4 className="font-bold text-gray-300 mb-2">Resumen de captura</h4>
                  <ul className="text-sm text-gray-500 space-y-1">
                    <li>• Nivel de Satisfacción: {formData.satisfaction}/10</li>
                    <li>• Materias Cursadas: {Object.values(formData.notas).filter((n:any) => n.estado !== 'no_cursada').length}</li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <footer className="mt-8 pt-6 border-t border-gray-800 flex justify-between">
            {step > 1 ? (
              <button type="button" disabled={isSubmitting} onClick={handlePrev} className="btn bg-gray-800 border-gray-700 text-white hover:bg-gray-700">Atrás</button>
            ) : <div></div>}
            
            {step < 3 ? (
              <button type="submit" className="btn btn-primary bg-blue-600 border-none text-white hover:bg-blue-700">Siguiente</button>
            ) : (
              <button type="submit" disabled={isSubmitting} className="btn btn-primary bg-teal-600 border-none text-white hover:bg-teal-700">
                {isSubmitting ? 'Finalizando...' : 'Finalizar Encuesta'}
              </button>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
}
