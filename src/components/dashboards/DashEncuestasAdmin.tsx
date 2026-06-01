import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, FileText, CheckCircle, Clock, Trash2, X, Settings2, ClipboardX, SlidersHorizontal, HelpCircle, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/moving-border';
import { EncuestaEditor } from './EncuestaEditor';
import { GestionCategorias } from './GestionCategorias';
import { CustomSelect } from '../ui/CustomSelect';

export const DashEncuestasAdmin = () => {
  const [encuestas, setEncuestas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showCategorias, setShowCategorias] = useState(false);
  const [editingEncuesta, setEditingEncuesta] = useState<any>(null);
  const [filter, setFilter] = useState('todas');
  
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    tipo: 'cuatrimestral',
    activa: false
  });

  useEffect(() => {
    fetchEncuestas();
  }, []);

  const fetchEncuestas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('encuestas')
      .select(`*`)
      .order('created_at', { ascending: false });
    
    if (data) {
      setEncuestas(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data, error } = await supabase
      .from('encuestas')
      .insert([
        {
          titulo: formData.titulo,
          descripcion: formData.descripcion,
          tipo: formData.tipo,
          activa: false
        }
      ])
      .select();

    if (!error && data) {
      setEncuestas([data[0], ...encuestas]);
      setIsAdding(false);
      setFormData({ titulo: '', descripcion: '', tipo: 'cuatrimestral', activa: false });
    }
  };

  const handleToggleActiva = async (id: string, currentStatus: boolean, tipo: string) => {
    const { error } = await supabase
      .from('encuestas')
      .update({ activa: !currentStatus })
      .eq('id', id);
      
    if (!error) {
      setEncuestas(encuestas.map(e => e.id === id ? { ...e, activa: !currentStatus } : e));
    }
  };

  const handleDelete = async (id: string) => {
    const confirm = window.confirm('¿Eliminar esta encuesta? Se borrarán también sus secciones y preguntas.');
    if (!confirm) return;

    const { error } = await supabase
      .from('encuestas')
      .delete()
      .eq('id', id);

    if (!error) {
      setEncuestas(encuestas.filter(e => e.id !== id));
    } else {
      alert('Error eliminando: ' + error.message);
    }
  };

  const filteredEncuestas = encuestas.filter(enc => {
    if (filter === 'activas') return enc.activa === true;
    if (filter === 'templates') return enc.activa === false;
    return true;
  });

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-4 pb-10 text-left px-4 md:px-8 mt-6">
        <AnimatePresence>
          {showCategorias && <GestionCategorias onClose={() => setShowCategorias(false)} />}
        </AnimatePresence>
        <motion.header 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-start mb-6"
        >
          <div>
            <h1 className="font-display text-2xl font-semibold text-white tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <ClipboardList className="w-5 h-5 text-blue-400" />
              </div>
              Gestión de Encuestas
            </h1>
            <p className="text-sm text-slate-500 font-sans max-w-lg mt-2">
              Crea encuestas, define sus preguntas y guárdalas como borradores (templates) o ponlas activas.
            </p>
          </div>
          
          <div className="shrink-0 flex items-center gap-3">
              <button 
                onClick={() => setShowCategorias(true)}
                className="px-4 py-2 font-sans text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors flex items-center gap-2"
              >
                <Layers className="w-4 h-4" /> Categorías
              </button>
              <Button 
                  onClick={() => setIsAdding(!isAdding)}
                  borderRadius="0.5rem"
                  duration={2500}
                  containerClassName="h-10 w-auto"
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0F1B2D]/90 flex items-center gap-2 whitespace-nowrap"
              >
                  <Plus className="w-4 h-4 text-teal-400" /> Nueva Encuesta
              </Button>
          </div>
        </motion.header>

        <div className="flex justify-between items-center mb-6">
          <div className="bg-white/5 border border-white/10 rounded-full px-2.5 py-0.5 text-xs text-slate-400 font-sans">
            {filteredEncuestas.length} encuestas
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setFilter('todas')}
              className={`text-xs font-sans px-3 py-1 rounded-md transition-all duration-150 ${filter === 'todas' ? 'bg-white/[0.06] text-slate-200' : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-400'}`}
            >
              Todas
            </button>
            <button 
              onClick={() => setFilter('activas')}
               className={`text-xs font-sans px-3 py-1 rounded-md transition-all duration-150 ${filter === 'activas' ? 'bg-white/[0.06] text-slate-200' : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-400'}`}
            >
              Activas
            </button>
             <button 
              onClick={() => setFilter('templates')}
               className={`text-xs font-sans px-3 py-1 rounded-md transition-all duration-150 ${filter === 'templates' ? 'bg-white/[0.06] text-slate-200' : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-400'}`}
            >
              Templates
            </button>
          </div>
        </div>

        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/[0.02] backdrop-blur-md border border-white/[0.08] rounded-2xl p-6 shadow-xl"
          >
            <h2 className="text-xl font-bold text-white mb-4 font-display">Nueva Encuesta</h2>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
              <div className="md:col-span-2">
                <label className="label text-sm text-gray-400 font-sans">Título de la Encuesta</label>
                <input 
                  required 
                  value={formData.titulo} 
                  onChange={e => setFormData({...formData, titulo: e.target.value})} 
                  type="text" 
                  className="input input-bordered w-full bg-black/20 border-white/[0.08] text-white font-sans" 
                  placeholder="Ej: Encuesta de Medio Término 2026" 
                />
              </div>
              <div className="md:col-span-2">
                <label className="label text-sm text-gray-400 font-sans">Descripción (Opcional)</label>
                <textarea 
                  value={formData.descripcion} 
                  onChange={e => setFormData({...formData, descripcion: e.target.value})} 
                  className="textarea textarea-bordered w-full bg-black/20 border-white/[0.08] text-white font-sans" 
                  placeholder="Explicación para el alumno..." 
                  rows={2}
                ></textarea>
              </div>
              
              <div>
                <label className="label text-sm text-gray-400 font-sans">Tipo de Encuesta</label>
                <CustomSelect 
                  value={formData.tipo}
                  onChange={v => setFormData({...formData, tipo: v})}
                  options={[
                    { value: 'inicial', label: 'Inicial / Ingreso', color: '#3B82F6' },
                    { value: 'cuatrimestral', label: 'Cuatrimestral', color: '#10B981' },
                    { value: 'entrevista', label: 'Entrevista', color: '#8B5CF6' }
                  ]}
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 rounded-lg font-sans text-gray-300 hover:bg-white/5 transition-colors text-sm font-medium">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-lg font-sans bg-teal-500 text-[#0F1B2D] hover:bg-teal-400 transition-colors text-sm font-medium">Guardar Encuesta</button>
              </div>
            </form>
          </motion.div>
        )}

        {loading ? (
          <div className="text-center py-10 text-gray-400">Cargando encuestas...</div>
        ) : (
          <motion.div 
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.07 } }
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-28"
          >
            <AnimatePresence>
              {filteredEncuestas.map((enc) => (
                <motion.div 
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, scale: 0.96, y: -8 }}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                  key={enc.id} 
                  className="bg-white/[0.04] border border-white/[0.07] hover:border-white/[0.12] transition-all duration-200 p-5 rounded-2xl flex flex-col gap-3 shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:shadow-lg backdrop-blur-[12px]"
                >
                  {/* ZONA SUPERIOR */}
                  <div className="flex justify-between items-start">
                    <h3 className="font-display text-base font-semibold text-white leading-tight">{enc.titulo}</h3>
                    {enc.activa ? (
                      <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-md text-xs px-2 py-0.5 font-medium font-sans flex items-center gap-1 shrink-0"><CheckCircle className="w-3 h-3"/> Activa</span>
                    ) : (
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-xs px-2 py-0.5 font-medium font-sans flex items-center gap-1 shrink-0"><Clock className="w-3 h-3"/> Template</span>
                    )}
                  </div>
                  
                  {/* DESCRIPCIÓN */}
                  <p className="font-sans text-sm text-slate-500 line-clamp-2">
                    {enc.descripcion || 'Sin descripción'}
                  </p>

                  {/* BADGE DE TIPO */}
                  <div>
                    <span className={`rounded-md text-xs px-2 py-0.5 border font-medium uppercase tracking-wider font-sans ${
                        enc.tipo === 'inicial' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        enc.tipo === 'cuatrimestral' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        'bg-teal-500/10 text-teal-400 border-teal-500/20'
                    }`}>
                        {enc.tipo}
                    </span>
                  </div>

                  {/* SEPARADOR */}
                  <div className="border-t border-white/[0.05] mt-1"></div>

                  {/* ZONA DE ACCIONES */}
                  <div className="flex justify-between items-center mt-auto">
                    {/* Lado izquierdo — metadata sutil */}
                    <div className="flex items-center gap-1">
                      <HelpCircle className="w-3 h-3 text-slate-600" />
                      <span className="text-xs text-slate-600 font-sans">Configurable</span>
                    </div>
                    
                    {/* Lado derecho — botones de acción */}
                    <div className="flex gap-2">
                        <button 
                          onClick={() => handleToggleActiva(enc.id, enc.activa, enc.tipo)}
                          className="border border-blue-500/30 text-blue-400 text-xs px-3 py-1.5 rounded-lg hover:bg-blue-500/10 hover:border-blue-500/50 hover:shadow-[0_0_10px_rgba(59,130,246,0.2)] transition-all duration-200 font-sans"
                        >
                          {enc.activa ? 'Desactivar' : 'Marcar Activa'}
                        </button>
                        <button 
                          onClick={() => setEditingEncuesta(enc)}
                          className="border border-white/10 text-slate-400 text-xs px-3 py-1.5 rounded-lg hover:bg-white/[0.05] hover:text-slate-200 hover:border-white/20 transition-all duration-200 flex items-center gap-1 font-sans"
                        >
                          <SlidersHorizontal className="w-3 h-3" /> Preguntas
                        </button>
                        <button 
                          onClick={() => handleDelete(enc.id)}
                          className="text-slate-600 hover:text-red-400 hover:bg-red-500/10 hover:shadow-[0_0_10px_rgba(239,68,68,0.15)] p-1.5 rounded-lg transition-all duration-200"
                          title="Borrar Encuesta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredEncuestas.length === 0 && encuestas.length > 0 && (
                <div className="col-span-full py-16 text-center text-slate-500 font-sans">
                  No hay encuestas con el filtro seleccionado.
                </div>
            )}
            
            {encuestas.length === 0 && (
              <div className="col-span-full py-16 flex flex-col items-center justify-center">
                  <ClipboardX className="w-12 h-12 text-slate-700 mb-4" />
                  <h3 className="text-slate-500 font-display font-medium text-lg mb-1">No hay encuestas todavía</h3>
                  <p className="text-slate-600 font-sans text-sm mb-6">Creá la primera usando el botón de arriba</p>
                  <button
                      onClick={() => setIsAdding(true)}
                      className="text-teal-400 hover:text-teal-300 hover:bg-teal-400/10 px-4 py-2 rounded-lg font-sans text-sm transition-colors border border-transparent hover:border-teal-500/30"
                  >
                      + Nueva Encuesta
                  </button>
              </div>
            )}
          </motion.div>
        )}

        <AnimatePresence>
          {editingEncuesta && (
            <EncuestaEditor 
              encuesta={editingEncuesta} 
              onClose={() => setEditingEncuesta(null)} 
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

