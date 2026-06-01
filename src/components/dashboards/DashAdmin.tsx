import React, { useEffect, useRef } from 'react';
import { useScore } from '../../hooks/useScore';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { AlertTriangle, LayoutDashboard, Upload, GraduationCap, VolumeX, MessageSquare, PieChart as PieChartIcon, ArrowUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, animate } from 'framer-motion';
import { Button } from '../ui/moving-border';

function AnimatedNumber({ value }: { value: number }) {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (node) {
      const controls = animate(0, value, {
        duration: 1,
        ease: "easeOut",
        onUpdate(v) {
          node.textContent = Math.round(v).toString();
        },
      });
      return () => controls.stop();
    }
  }, [value]);

  return <span ref={nodeRef}>{value}</span>;
}

export const DashAdmin = () => {
  const navigate = useNavigate();
  // Simulamos carrera ID por ahora
  const { distribucion, loading } = useScore(undefined, '1fded8a2-a8c6-4d04-8b5e-0498b5fa0b94');

  if (loading) return <div className="text-white min-h-screen flex items-center justify-center">Cargando distribución...</div>;

  // Format dataset from Supabase
  let totalEstudiantes = 0;
  let riskDistribution: any[] = [];
  let numEnRiesgo = 0;

  if (distribucion && distribucion.length > 0) {
    const dataRow = distribucion[0];
    totalEstudiantes = dataRow.bajo + dataRow.medio + dataRow.alto + dataRow.critico;
    numEnRiesgo = dataRow.alto + dataRow.critico;
    
    riskDistribution = [
      { name: 'Vigoroso', value: dataRow.bajo, color: '#14B8A6' },
      { name: 'Moderado', value: dataRow.medio, color: '#3B82F6' },
      { name: 'Alto Riesgo', value: dataRow.alto, color: '#F59E0B' },
      { name: 'Crítico', value: dataRow.critico, color: '#EF4444' },
    ].filter(d => d.value > 0);
  }

  const perfilesSilenciosos = 12; // MOCK
  const intervencionesMes = 24; // MOCK

  // Data for BarChart (tasa abandono mock por ahora)
  const abandonoData = [
    { name: 'Análisis Mat. I', abandono: 35 },
    { name: 'Física I', abandono: 28 },
    { name: 'Álgebra', abandono: 15 },
    { name: 'Química', abandono: 10 },
  ];

  const cards = [
    { label: 'Total Estudiantes', value: totalEstudiantes, icon: GraduationCap, color: 'text-blue-400', bgIcon: 'bg-blue-400/10', subtitle: 'Cohorte Actual' },
    { label: 'En Riesgo', value: numEnRiesgo, icon: AlertTriangle, color: 'text-red-400', bgIcon: 'bg-red-400/10', isRisk: true },
    { label: 'Perfiles Silenciosos', value: perfilesSilenciosos, icon: VolumeX, color: 'text-amber-400', bgIcon: 'bg-amber-400/10', isSilent: true },
    { label: 'Intervenciones', value: intervencionesMes, icon: MessageSquare, color: 'text-teal-400', bgIcon: 'bg-teal-400/10', subtitle: 'Este mes' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <LayoutDashboard className="w-5 h-5 text-blue-400" />
            </div>
            Panel de Administración
          </h1>
          <p className="text-sm text-slate-500 font-sans mt-2">
            Visión global de la cohorte e indicadores clave.
          </p>
        </div>
        
        <div className="shrink-0">
            <Button 
                onClick={() => navigate('/importar-alumnos')}
                borderRadius="0.5rem"
                duration={2500}
                containerClassName="h-10 w-auto text-white flex items-center"
                className="px-4 py-2 text-sm font-semibold text-white bg-[#0F1B2D]/90 flex items-center gap-2 whitespace-nowrap"
            >
                <Upload className="w-4 h-4 text-teal-400" /> Importar Alumnos
            </Button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ y: -2 }}
            className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-5 backdrop-blur-md hover:border-white/[0.12] transition-all duration-200"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider font-sans">
                {card.label}
              </span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${card.bgIcon}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            
            <div className="font-display text-3xl font-bold text-white mb-2">
              <AnimatedNumber value={card.value} />
            </div>
            
            <div className="text-xs font-sans">
              {card.isRisk ? (
                card.value > 0 ? (
                  <span className="text-red-400 flex items-center gap-1 font-medium"><ArrowUp className="w-3 h-3" /> Requieren intervención urgente</span>
                ) : (
                  <span className="text-slate-600">Ninguno en riesgo alto</span>
                )
              ) : card.isSilent ? (
                card.value > 0 ? (
                  <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md font-medium"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Requiere atención</span>
                ) : (
                  <span className="text-slate-600">Sin perfiles silenciosos</span>
                )
              ) : (
                <span className="text-slate-600">{card.subtitle}</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 pb-28">
        
        {/* Gráfico 1: Distribución */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white/[0.04] rounded-2xl border border-white/[0.07] p-6 backdrop-blur-md"
        >
          <h2 className="font-display text-base font-semibold text-white mb-4">Distribución de Niveles de Riesgo</h2>
          <p className="text-xs text-slate-500 font-sans mb-4 hidden md:block">Porcentaje de estudiantes en cada nivel basado en score.</p>
          <div className="h-48 md:h-64">
            {riskDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {riskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15,27,45,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px' }}
                    itemStyle={{ color: '#2dd4bf', fontWeight: 600, fontFamily: 'IBM Plex Sans', fontSize: '12px' }}
                    labelStyle={{ display: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center">
                <PieChartIcon className="w-8 h-8 text-slate-700 mb-2" />
                <span className="text-slate-600 text-sm font-sans">Sin datos suficientes</span>
              </div>
            )}
          </div>
          {/* Leyenda manual */}
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {riskDistribution.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-400 font-sans">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                {d.name} <span className="text-slate-300 font-medium ml-0.5">{d.value}</span> <span className="opacity-50">({Math.round((d.value/totalEstudiantes)*100)}%)</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Gráfico 2: Ranking Materias */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white/[0.04] rounded-2xl border border-white/[0.07] p-6 backdrop-blur-md"
        >
          <h2 className="font-display text-base font-semibold text-white mb-4">Materias Críticas (Tasa de Abandono %)</h2>
          <p className="text-xs text-slate-500 font-sans mb-4 hidden md:block">Proporción de inactividad respecto al cuatrimestre anterior.</p>
          <div className="h-48 md:h-64 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={abandonoData} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" horizontal={false} vertical={true} />
                <XAxis type="number" stroke="#475569" tick={{ fill: '#475569', fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: '#1E293B' }} tickLine={{ stroke: '#1E293B' }} />
                <YAxis dataKey="name" type="category" stroke="#475569" tick={{ fill: '#475569', fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: '#1E293B' }} tickLine={{ stroke: '#1E293B' }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }} 
                  contentStyle={{ backgroundColor: 'rgba(15,27,45,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px' }} 
                  labelStyle={{ color: '#e2e8f0', fontFamily: 'IBM Plex Sans', fontSize: '12px', marginBottom: '4px' }}
                  itemStyle={{ color: '#2dd4bf', fontWeight: 600, fontFamily: 'IBM Plex Sans', fontSize: '12px' }}
                  formatter={(value: number) => [`${value}%`, 'Abandono']}
                />
                <Bar dataKey="abandono" fill="url(#barGradient)" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

      </div>
    </div>
  );
};
