import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePerfil } from '../../hooks/usePerfil';
import { usePlan } from '../../hooks/usePlan';
import { BookOpen, CheckCircle, Circle, Clock } from 'lucide-react';

export const DashPlanEstudiante = () => {
  const { usuario } = useAuth();
  const { perfil } = usePerfil(usuario?.id);
  const { plan, progreso, loading } = usePlan(perfil?.estudiantes?.carrera_id, usuario?.id);

  if (loading) return <div className="text-white">Cargando plan de estudios...</div>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-blue-500" />
          Mi Plan de Estudios
        </h1>
        <p className="text-gray-400 mt-2">
          Progreso de cursada actual
        </p>
      </header>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
        <table className="table table-zebra table-pin-rows">
          <thead>
            <tr className="bg-gray-950 text-gray-300 border-b border-gray-800">
              <th>Estado</th>
              <th>Asignatura</th>
              <th>Año Teórico</th>
            </tr>
          </thead>
          <tbody>
            {plan.map(p => {
              const prog = progreso.find(pr => pr.materias.codigo === p.materias.codigo);
              const isPassed = prog?.estado === 'aprobada';
              const isCurrent = prog?.estado === 'cursando' || prog?.estado === 'recursando';
              const isFinal = prog?.estado === 'final_pendiente';

              return (
                <tr 
                  key={p.materias.id} 
                  className={`border-b border-gray-800 transition-colors ${isPassed ? 'bg-blue-900/10' : ''}`}
                >
                  <td className="w-16">
                    {isPassed ? (
                      <CheckCircle className="w-6 h-6 text-blue-500" />
                    ) : (isCurrent || isFinal) ? (
                      <Clock className="w-6 h-6 text-amber-500" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-600" />
                    )}
                  </td>
                  <td className={`font-medium ${isPassed ? 'text-blue-400' : 'text-gray-300'}`}>
                    <div>{p.materias.nombre}</div>
                    <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">
                      {prog?.estado ? prog.estado.replace('_', ' ') : 'no cursada'}
                    </div>
                  </td>
                  <td className="text-gray-400">
                    {p.anio_teorico}° Año<br/>
                    <span className="text-xs">C{p.cuatrimestre}</span>
                  </td>
                </tr>
              )
            })}
            {plan.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-6 text-gray-500">
                  No hay materias cargadas en el plan de estudios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
