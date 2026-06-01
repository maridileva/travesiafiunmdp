import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useEncuesta } from '../../hooks/useEncuesta';
import { guardarRespuesta, completarEncuesta, crearSesionEncuesta } from '../../services/encuestasService';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CustomSelect } from '../ui/CustomSelect';

export const EncuestaInicial = () => {
  const { usuario } = useAuth();
  const { encuesta, loading: encLoading } = useEncuesta(usuario?.id, 'inicial');
  
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    horas_trabajo: '0',
    expectativa: '',
    dificultad: 'ninguna',
    computadora: 'si'
  });

  if (encLoading) return <div className="text-white text-center py-8">Cargando encuesta inicial...</div>;

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900 rounded-2xl border border-gray-800 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-16 h-16 bg-teal-500/20 text-teal-400 rounded-full flex items-center justify-center mb-4">
          <Send className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">¡Gracias por la información!</h2>
        <p className="text-gray-400 mb-6">Hemos registrado tu perfil de ingreso.</p>
        <button className="btn btn-primary" onClick={() => navigate('/encuestas')}>
          Ir a Encuesta Cuatrimestral
        </button>
      </div>
    );
  }

  const handleNext = () => setStep(step + 1);
  const handlePrev = () => setStep(step - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!encuesta || !usuario) return;
    
    setIsSubmitting(true);
    try {
      // Create session manually since useEncuesta creates 'cuatrimestral' session
      const { data: newSession, error: createErr } = await crearSesionEncuesta(
        encuesta.id,
        usuario.id,
        1,
        new Date().getFullYear()
      );

      if (createErr) throw createErr;
      const sessionId = newSession.id;

      // Guardar respuestas
      await guardarRespuesta(sessionId, 'horas_trabajo', formData.horas_trabajo);
      await guardarRespuesta(sessionId, 'expectativa', formData.expectativa);
      await guardarRespuesta(sessionId, 'dificultad', formData.dificultad);
      await guardarRespuesta(sessionId, 'computadora', formData.computadora);

      // Completar
      await completarEncuesta(sessionId, usuario.id, true);
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
          {encuesta?.titulo || "Encuesta de Ingreso"}
        </h1>
        <p className="text-gray-400 mb-6">{encuesta?.descripcion || "Conocerte mejor."}</p>
        <ul className="steps w-full mb-8">
          <li className="step step-primary text-blue-500">Perfil</li>
          <li className={step >= 2 ? "step step-primary text-blue-500" : "step text-gray-600"}>Expectativas</li>
        </ul>
      </header>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 md:p-8 shadow-xl">
        <form onSubmit={step === 2 ? handleSubmit : (e)=>{e.preventDefault(); handleNext();}}>
          
          <AnimatePresence mode="wait">
            
            {step === 1 && (
              <motion.div key="s1" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xl text-white font-semibold">Horas de Trabajo Semanal</h3>
                  <CustomSelect
                    className="w-full"
                    value={formData.horas_trabajo}
                    onChange={v => setFormData({...formData, horas_trabajo: v})}
                    options={[
                      { value: '0', label: 'No trabajo' },
                      { value: '10', label: 'Hasta 10 horas' },
                      { value: '20', label: '10 a 20 horas' },
                      { value: '40', label: 'Más de 20 horas / Full time' }
                    ]}
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-800">
                  <h3 className="text-xl text-white font-semibold">Acceso a Computadora Propia</h3>
                  <CustomSelect
                    className="w-full"
                    value={formData.computadora}
                    onChange={v => setFormData({...formData, computadora: v})}
                    options={[
                      { value: 'si', label: 'Sí, tengo' },
                      { value: 'no', label: 'No, comparto o uso de la facu' }
                    ]}
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xl text-white font-semibold">Principal dificultad esperada</h3>
                  <CustomSelect
                    className="w-full"
                    value={formData.dificultad}
                    onChange={v => setFormData({...formData, dificultad: v})}
                    options={[
                      { value: 'ninguna', label: 'Ninguna' },
                      { value: 'tiempo', label: 'Falta de tiempo' },
                      { value: 'base', label: 'Falta de base matemática/física' },
                      { value: 'economica', label: 'Dificultad económica' }
                    ]}
                  />
                </div>
                
                <div className="space-y-4 pt-4 border-t border-gray-800">
                  <h3 className="text-xl text-white font-semibold">Expectativas</h3>
                  <textarea 
                    className="textarea bg-gray-950 border-gray-700 w-full text-white" 
                    placeholder="¿Qué esperás de la carrera?" 
                    rows={3}
                    value={formData.expectativa}
                    onChange={e => setFormData({...formData, expectativa: e.target.value})}
                  ></textarea>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <footer className="mt-8 pt-6 border-t border-gray-800 flex justify-between">
            {step > 1 ? (
              <button type="button" disabled={isSubmitting} onClick={handlePrev} className="btn bg-gray-800 border-gray-700 text-white hover:bg-gray-700">Atrás</button>
            ) : <div></div>}
            
            {step < 2 ? (
              <button type="submit" className="btn btn-primary bg-blue-600 border-none text-white hover:bg-blue-700">Siguiente</button>
            ) : (
              <button type="submit" disabled={isSubmitting} className="btn btn-primary bg-teal-600 border-none text-white hover:bg-teal-700">
                {isSubmitting ? 'Enviando...' : 'Finalizar'}
              </button>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
}
