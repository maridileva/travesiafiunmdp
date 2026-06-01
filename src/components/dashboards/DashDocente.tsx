import React from 'react';
import { Users, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

export const DashDocente = () => {
  // Mock radar data
  const radarData = [
    { subject: 'Rendimiento Académico', A: 70, fullMark: 100 },
    { subject: 'Asistencia', A: 85, fullMark: 100 },
    { subject: 'Participación', A: 60, fullMark: 100 },
    { subject: 'Entregas', A: 90, fullMark: 100 },
    { subject: 'Encuestas', A: 50, fullMark: 100 },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard Docente</h1>
        <p className="text-gray-400 mt-1">Vista global del comportamiento de tus alumnos en cursada.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Global info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 shadow-xl flex items-center gap-6">
            <div className="p-4 bg-blue-500/10 rounded-xl text-blue-500">
              <Users className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Alumnos Activos</h2>
              <p className="text-gray-400">Total en tu materia: 42</p>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 shadow-xl">
             <h3 className="font-bold text-white mb-4 flex items-center gap-2">
               <BarChart2 className="w-5 h-5 text-blue-500" />
               Indicadores promedio de la comisión
             </h3>
             <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1 text-gray-300">
                    <span>Aprobación de TP</span>
                    <span>72%</span>
                  </div>
                  <progress className="progress progress-primary w-full" value="72" max="100"></progress>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1 text-gray-300">
                    <span>Asistencia</span>
                    <span>88%</span>
                  </div>
                  <progress className="progress progress-success w-full" value="88" max="100"></progress>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1 text-gray-300">
                    <span>Finalización de Encuestas</span>
                    <span>45%</span>
                  </div>
                  <progress className="progress progress-warning w-full" value="45" max="100"></progress>
                </div>
             </div>
          </div>
        </div>

        {/* Radar profile */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4 text-center">Perfil de Salud de Comisión</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                <Radar name="Promedio" dataKey="A" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
