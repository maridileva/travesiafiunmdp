import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePerfil } from '../../hooks/usePerfil';
import { useScore } from '../../hooks/useScore';
import { motion } from 'framer-motion';
import { HelpCircle, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { crearAlertaAyuda } from '../../services/alertasService';

export const DashEstudiante = () => {
  const { usuario } = useAuth();
  const { perfil, loading: perfilLoading } = usePerfil(usuario?.id);
  const { ultimoScore, loading: scoreLoading } = useScore(usuario?.id);
  const navigate = useNavigate();
  
  const handleHelp = async () => {
    if (usuario) {
      await crearAlertaAyuda(usuario.id);
      alert("Se ha notificado a tu tutor asignado. Pronto se pondrán en contacto con vos.");
    }
  };

  if (perfilLoading || scoreLoading) {
    return <div className="text-white">Cargando...</div>;
  }

  const scoreMap: Record<string, { label: string, color: string, badge: string, msg: string }> = {
    bajo: { label: 'Vigoroso', color: '#14B8A6', badge: 'badge-success text-white', msg: '¡Excelente ritmo! Seguí así, estás avanzando muy bien en la carrera.' },
    medio: { label: 'Moderado', color: '#F59E0B', badge: 'badge-warning', msg: 'Vas bien, pero es importante que te organices para mantener el ritmo.' },
    alto: { label: 'Alto Riesgo', color: '#EF4444', badge: 'badge-error text-white', msg: 'Parece que estás teniendo algunas dificultades. Te sugerimos hablar con tu tutor.' },
    critico: { label: 'Crítico', color: '#111827', badge: 'bg-gray-900 text-white', msg: 'Queremos ayudarte a seguir. Por favor, contactate con tu tutor lo antes posible.' }
  };

  const riskLevel = ultimoScore?.nivel_riesgo || 'bajo';
  const levelInfo = scoreMap[riskLevel];

  // Radial chart data pseudo random since this hasn't been fully migrated
  const scoreValor = ultimoScore?.valor ? Math.round(ultimoScore.valor) : 0;
  const data = [{ name: 'Riesgo', value: scoreValor, fill: levelInfo.color }];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Hola, {perfil?.nombre?.split(' ')[0] || 'Estudiante'} 👋</h1>
        <p className="text-gray-400 mt-1">Este es el resumen de tu proceso en Travesía.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Score Card */}
        <div className="lg:col-span-2 rounded-2xl bg-gray-900 border border-gray-800 p-6 flex flex-col md:flex-row items-center gap-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CheckCircle className="w-32 h-32 text-white" />
          </div>
          
          <div className="w-32 h-32 md:w-40 md:h-40 shrink-0 relative">
             <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart 
                cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" 
                barSize={12} data={data} startAngle={90} endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar background={{ fill: '#374151' }} dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white">{scoreValor}</span>
              <span className="text-xs text-gray-400 mt-1">score</span>
            </div>
          </div>

          <div className="flex-1 text-center md:text-left z-10">
            <h2 className="text-xl font-semibold text-white mb-2">Tu Estado Actual</h2>
            <span className={cn("badge px-4 py-3 font-semibold mb-4 gap-2", levelInfo.badge)}>
              Nivel de Ritmo: {levelInfo.label}
            </span>
            <p className="text-gray-300 leading-relaxed text-sm">
              {levelInfo.msg}
            </p>
          </div>
        </div>

        {/* Encuestas y Ayuda */}
        <div className="space-y-6 flex flex-col">
          <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6 flex-1 flex flex-col shadow-xl">
            <h3 className="text-lg font-semibold text-white flex items-center mb-4">
              <FileText className="w-5 h-5 text-blue-500 mr-2" />
              Tareas Pendientes
            </h3>
            
            {!perfil?.estudiantes?.encuesta_inicial_completada && (
              <div className="alert bg-gray-800 border border-gray-700 text-gray-200 mb-4 flex-1">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <div className="flex-1">
                  <h3 className="font-bold">Encuesta Inicial</h3>
                  <div className="text-xs">Requerida para iniciar.</div>
                </div>
                <button 
                  className="btn btn-sm btn-primary border-none bg-blue-600 text-white" 
                  onClick={() => navigate('/encuestas')}
                >
                  Completar
                </button>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleHelp}
            className="btn h-auto py-4 rounded-xl border-none outline-none group relative overflow-hidden bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 w-full transition-all text-left flex items-start gap-4 ring-1 ring-teal-500/30"
          >
            <div className="bg-teal-500/20 p-3 rounded-full shrink-0 group-hover:scale-110 transition-transform">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-lg mb-1">Pedir Ayuda</div>
              <div className="text-sm font-normal text-teal-500/80">
                Notificar a tu tutor que necesitás contactarte.
              </div>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
};
