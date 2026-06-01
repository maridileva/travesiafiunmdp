import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useEstudiantes } from '../../hooks/useEstudiantes';
import { useAlertas } from '../../hooks/useAlertas';
import { crearIntervencion } from '../../services/intervencionesService';
import { Users, AlertTriangle, MessageCircle, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export const DashTutor = () => {
  const { usuario, rol } = useAuth();
  const { estudiantes: myStudents, loading: estLoading } = useEstudiantes(usuario?.id || '', rol || '');
  const { alertas } = useAlertas(usuario?.id || '');
  
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  const formatScore = (riskLevel: string) => {
    switch(riskLevel) {
      case 'bajo': return <span className="badge badge-success text-white">Vigoroso</span>;
      case 'medio': return <span className="badge badge-warning">Moderado</span>;
      case 'alto': return <span className="badge badge-error text-white">Alto Riesgo</span>;
      case 'critico': return <span className="badge bg-gray-900 text-white">Crítico</span>;
      default: return null;
    }
  }

  // Intervencion modal
  const [modalOpen, setModalOpen] = useState(false);
  const [intervData, setIntervData] = useState({ summary: '', agreements: '', nextAction: '' });
  const [savingInterv, setSavingInterv] = useState(false);

  const handleSaveIntervention = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudent && usuario) {
      setSavingInterv(true);
      try {
        await crearIntervencion({
          estudiante_id: selectedStudent.estudiante_id,
          tutor_id: usuario.id,
          tipo: 'entrevista',
          modalidad: 'virtual',
          fecha_realizada: new Date().toISOString(),
          motivo: 'Seguimiento programado',
          resumen: intervData.summary,
          compromisos: intervData.agreements,
          proxima_accion: intervData.nextAction
        });
        setModalOpen(false);
        setSelectedStudent(null);
        setIntervData({ summary: '', agreements: '', nextAction: '' });
        alert("Intervención registrada correctamente.");
      } catch (err: any) {
        alert("Error al guardar: " + err.message);
      } finally {
        setSavingInterv(false);
      }
    }
  }

  if (estLoading) return <div className="text-white">Cargando alumnos...</div>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Mis Alumnos a Cargo</h1>
          <p className="text-gray-400 mt-1">Monitoreo y seguimiento de cohortes asignadas.</p>
        </div>
        <div className="stats shadow bg-gray-900 border border-gray-800">
          <div className="stat px-6 py-2">
            <div className="stat-title text-gray-400">Total Alumnos</div>
            <div className="stat-value text-blue-500 text-2xl">{myStudents.length}</div>
          </div>
        </div>
      </header>

      {/* Tabla de Alumnos */}
      <div className="overflow-x-auto bg-gray-900 rounded-2xl border border-gray-800 shadow-xl">
        <table className="table table-zebra table-pin-rows table-pin-cols w-full">
          <thead>
            <tr className="bg-gray-950 text-gray-300 border-b border-gray-800">
              <th>Alumno</th>
              <th>Score (Riesgo)</th>
              <th>Perfil Silencioso</th>
              <th>Ayuda</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {myStudents.map(student => {
              const u = student.usuarios;
              // Fake properties since we need to fetch scores explicitly for each, 
              // but assuming we'd use the backend data eventually.
              const score = student.score || 50; 
              const riskLevel = student.riskLevel || 'medio';
              const needsHelp = alertas.some((a: any) => a.estudiante_id === student.estudiante_id && a.tipo === 'solicitud_ayuda');

              return (
              <tr key={student.estudiante_id} className="border-b border-gray-800">
                <td>
                  <div className="font-bold">{u?.nombre} {u?.apellido}</div>
                  <div className="text-sm opacity-50">{u?.legajo || 'Sin Legajo'}</div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    {formatScore(riskLevel)}
                    <span className="text-xs font-mono bg-gray-800 px-2 py-1 rounded">{score}/100</span>
                  </div>
                </td>
                <td>
                  {student.isSilentProfile ? (
                    <span className="flex items-center text-amber-500 gap-1 text-xs">
                      <AlertTriangle className="w-4 h-4" /> Sí
                    </span>
                  ) : <span className="text-gray-500 text-xs">No</span>}
                </td>
                <td>
                  {needsHelp ? (
                    <span className="badge badge-error badge-outline gap-1 animate-pulse">
                      <MessageCircle className="w-3 h-3" /> Solicitó
                    </span>
                  ) : '-'}
                </td>
                <td>
                  <button 
                    className="btn btn-sm btn-ghost text-blue-400 hover:bg-gray-800"
                    onClick={() => { setSelectedStudent(student); setModalOpen(true); }}
                  >
                    Detalles / Intervención
                  </button>
                </td>
              </tr>
            )})}
            {myStudents.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">No tienes alumnos asignados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {modalOpen && selectedStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <h3 className="font-bold text-2xl mb-4 text-white">
                Intervención: {selectedStudent.usuarios?.nombre} {selectedStudent.usuarios?.apellido}
              </h3>
              
              <div className="bg-gray-800 p-4 rounded-xl mb-6">
                <h4 className="font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Síntesis y Métricas Recientes
                </h4>
                <p className="text-sm text-gray-400">
                  El estudiante presenta un nivel de riesgo {selectedStudent.riskLevel || 'medio'} según los indicadores determinísticos de su actividad, notas y respuestas manuales de encuesta. Revise individualmente las métricas en su expediente (o charle directamente con él).
                </p>
              </div>

              <form onSubmit={handleSaveIntervention} className="space-y-4">
                <div>
                  <label className="label text-sm text-gray-400">Resumen de la entrevista</label>
                  <textarea 
                    required
                    className="textarea textarea-bordered w-full bg-gray-950 border-gray-700 text-white" 
                    rows={3}
                    value={intervData.summary}
                    onChange={e => setIntervData({...intervData, summary: e.target.value})}
                  ></textarea>
                </div>
                <div>
                  <label className="label text-sm text-gray-400">Compromisos acordados</label>
                  <textarea 
                    required
                    className="textarea textarea-bordered w-full bg-gray-950 border-gray-700 text-white" 
                    rows={2}
                    value={intervData.agreements}
                    onChange={e => setIntervData({...intervData, agreements: e.target.value})}
                  ></textarea>
                </div>
                <div>
                  <label className="label text-sm text-gray-400">Próxima acción planificada</label>
                  <input 
                    type="text" required
                    className="input input-bordered w-full bg-gray-950 border-gray-700 text-white" 
                    value={intervData.nextAction}
                    onChange={e => setIntervData({...intervData, nextAction: e.target.value})}
                  />
                </div>
                <div className="modal-action">
                  <button type="button" disabled={savingInterv} className="btn btn-ghost text-gray-400" onClick={() => setModalOpen(false)}>Cancelar</button>
                  <button type="submit" disabled={savingInterv} className="btn btn-primary bg-blue-600 border-none text-white">{savingInterv ? 'Guardando...' : 'Guardar Intervención'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

