import React, { useState, useEffect } from 'react';
import { usePlan } from '../../hooks/usePlan';
import { Plus, BookOpen, Trash2, Edit } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { upsertMateriaPlan } from '../../services/planService';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/moving-border';
import { CustomSelect } from '../ui/CustomSelect';

export const DashPlanAdmin = () => {
  const [carreras, setCarreras] = useState<any[]>([]);
  const [selectedCarreraId, setSelectedCarreraId] = useState<string>('');
  
  const { plan, loading, refresh } = usePlan(selectedCarreraId || undefined);

  const [isAdding, setIsAdding] = useState(false);
  const [editingMateriaId, setEditingMateriaId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    anio_teorico: 1,
    cuatrimestre: 1,
    tipo: 'obligatoria',
    es_critica: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAddingCarrera, setIsAddingCarrera] = useState(false);
  const [editingCarreraId, setEditingCarreraId] = useState<string | null>(null);
  const [carreraForm, setCarreraForm] = useState({ nombre: '', codigo: '' });
  const [isSubmittingCarrera, setIsSubmittingCarrera] = useState(false);

  const fetchCarreras = async (selectId?: string) => {
    const { data } = await supabase.from('carreras').select('*');
    if (data && data.length > 0) {
      setCarreras(data);
      if (selectId) setSelectedCarreraId(selectId);
      else if (!selectedCarreraId) setSelectedCarreraId(data[0].id);
    } else {
      setCarreras([]);
      setSelectedCarreraId('');
    }
  };

  useEffect(() => {
    fetchCarreras();
  }, []);

  const handleCarreraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingCarrera(true);
    let data, error;
    if (editingCarreraId) {
      ({ data, error } = await supabase.from('carreras').update(carreraForm).eq('id', editingCarreraId).select());
    } else {
      ({ data, error } = await supabase.from('carreras').insert([carreraForm]).select());
    }
    setIsSubmittingCarrera(false);
    
    if (!error && data) {
      setIsAddingCarrera(false);
      setEditingCarreraId(null);
      setCarreraForm({ nombre: '', codigo: '' });
      await fetchCarreras(data[0].id);
    } else {
      alert("Error al guardar carrera: " + (error?.message || "Desconocido"));
    }
  };

  const handleEditCarrera = (carrera: any) => {
    setCarreraForm({ nombre: carrera.nombre, codigo: carrera.codigo || '' });
    setEditingCarreraId(carrera.id);
    setIsAddingCarrera(true);
  };

  const handleDeleteCarrera = async (carreraId: string) => {
    if (window.confirm("¿Estás seguro de que querés borrar esta carrera y todo su plan de estudios?")) {
      const { error } = await supabase.from('carreras').delete().eq('id', carreraId);
      if (error) alert("Error al borrar: " + error.message);
      else await fetchCarreras();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCarreraId) return;
    
    setIsSubmitting(true);
    const { error } = await upsertMateriaPlan({
      materia_id: editingMateriaId || undefined,
      carrera_id: selectedCarreraId,
      ...formData
    });
    setIsSubmitting(false);

    if (!error) {
      setIsAdding(false);
      setEditingMateriaId(null);
      setFormData({
        nombre: '', codigo: '', anio_teorico: 1, cuatrimestre: 1, tipo: 'obligatoria', es_critica: false
      });
      refresh();
    } else {
      alert("Error al guardar: " + error.message);
    }
  };

  const handleEditMateria = (p: any) => {
    setFormData({
      nombre: p.materias.nombre,
      codigo: p.materias.codigo,
      anio_teorico: p.anio_teorico,
      cuatrimestre: p.cuatrimestre,
      tipo: p.tipo,
      es_critica: p.es_critica
    });
    setEditingMateriaId(p.materias.id);
    setIsAdding(true);
  };

  const handleDeleteMateria = async (materiaId: string) => {
    if (window.confirm("¿Estás seguro de que querés borrar esta asignatura?")) {
      const { error } = await supabase.from('materias').delete().eq('id', materiaId);
      if (error) alert("Error al borrar: " + error.message);
      else refresh();
    }
  };

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div 
      variants={container} 
      initial="hidden" 
      animate="show"
      className="max-w-5xl mx-auto space-y-4 pb-10 text-left px-4 md:px-8 mt-6"
    >
      <motion.header variants={item} className="mb-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-100 flex items-center gap-3">
          <div className="p-2 bg-teal-500/10 rounded-lg border border-teal-500/20 shadow-[0_0_15px_rgba(20,184,166,0.3)]">
            <BookOpen className="w-6 h-6 text-teal-400" />
          </div>
          Gestión del Plan de Estudios
        </h1>
        <p className="text-slate-500 mt-2">Agregá y modificá asignaturas del plan de estudios de cada carrera.</p>
      </motion.header>

      {/* Select carrera panel */}
      <motion.div 
        variants={item}
        className="bg-white/[0.04] backdrop-blur-md border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl p-6 flex flex-col gap-2 mt-4"
      >
        <label className="font-display text-[10px] font-medium text-slate-500 tracking-widest uppercase">Carrera seleccionada</label>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full">
          <div className="w-full md:w-72 shrink-0">
            <CustomSelect
              className="w-full"
              value={selectedCarreraId}
              onChange={(v) => setSelectedCarreraId(v)}
              options={carreras.map(c => ({ value: c.id, label: c.nombre }))}
            />
          </div>

          <div className="flex items-center border border-white/[0.08] rounded-lg divide-x divide-white/[0.06] shrink-0">
            {selectedCarreraId && (
              <>
                <button 
                  onClick={() => handleEditCarrera(carreras.find(c => c.id === selectedCarreraId))}
                  className="px-3 py-3 text-slate-400 hover:bg-blue-500/10 hover:text-blue-400 hover:shadow-[0_0_12px_rgba(59,130,246,0.3)] transition-all duration-200 rounded-l-lg"
                  title="Editar Carrera"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteCarrera(selectedCarreraId)}
                  className="px-3 py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:shadow-[0_0_12px_rgba(239,68,68,0.3)] transition-all duration-200"
                  title="Borrar Carrera"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button 
              onClick={() => {
                setEditingCarreraId(null);
                setCarreraForm({ nombre: '', codigo: '' });
                setIsAddingCarrera(!isAddingCarrera);
              }}
              className={`px-3 py-3 text-slate-400 hover:bg-teal-500/10 hover:text-teal-400 hover:shadow-[0_0_12px_rgba(20,184,166,0.3)] transition-all duration-200 ${!selectedCarreraId ? "rounded-lg" : "rounded-r-lg"}`}
              title="Añadir Carrera"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 hidden md:block"></div>

          <div className="w-full md:w-auto shrink-0 mt-4 md:mt-0">
            <Button 
              onClick={() => {
                setEditingMateriaId(null);
                setFormData({ nombre: '', codigo: '', anio_teorico: 1, cuatrimestre: 1, tipo: 'obligatoria', es_critica: false });
                setIsAdding(!isAdding);
              }}
              borderRadius="0.5rem"
              duration={3000}
              containerClassName="h-10 w-full md:w-auto"
              borderClassName="bg-[radial-gradient(#14B8A6_40%,#3B82F6_60%,transparent_80%)]"
              className="px-4 py-2 text-sm font-medium text-white bg-[#0F1B2D]/80 flex items-center gap-2"
            >
              <Plus className="w-5 h-5 text-teal-400" /> Nueva Asignatura
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Forms */}
      <AnimatePresence>
        {isAddingCarrera && (
          <motion.div 
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            className="overflow-hidden"
          >
            <div className="bg-white/[0.02] backdrop-blur-md border border-teal-500/30 rounded-2xl p-6 shadow-2xl mt-4">
              <h2 className="text-xl font-semibold text-slate-100 mb-4 tracking-tight">
                {editingCarreraId ? "Editar Carrera" : "Añadir Carrera"}
              </h2>
              <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleCarreraSubmit}>
                <div>
                  <label className="label text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre de la Carrera</label>
                  <input required value={carreraForm.nombre} onChange={e => setCarreraForm({...carreraForm, nombre: e.target.value})} type="text" className="input w-full bg-black/20 border-white/[0.08] text-slate-100 focus:border-teal-500/50" placeholder="Ej: Ingeniería Industrial" />
                </div>
                <div>
                  <label className="label text-xs font-medium text-slate-500 uppercase tracking-wider">Código</label>
                  <input value={carreraForm.codigo} onChange={e => setCarreraForm({...carreraForm, codigo: e.target.value})} type="text" className="input w-full bg-black/20 border-white/[0.08] text-slate-100 focus:border-teal-500/50" placeholder="Ej: IND" />
                </div>
                <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                  <button type="button" onClick={() => setIsAddingCarrera(false)} className="btn btn-ghost hover:bg-white/[0.05] text-slate-300">Cancelar</button>
                  <button disabled={isSubmittingCarrera} type="submit" className="btn bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/30">
                    {isSubmittingCarrera ? 'Guardando...' : 'Guardar Carrera'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}

        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            className="overflow-hidden"
          >
            <div className="bg-white/[0.02] backdrop-blur-md border border-blue-500/30 rounded-2xl p-6 shadow-2xl mt-4">
              <h2 className="text-xl font-semibold text-slate-100 mb-4 tracking-tight">
                {editingMateriaId ? "Editar Asignatura" : "Añadir Asignatura"}
              </h2>
              <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
                <div>
                  <label className="label text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</label>
                  <input required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} type="text" className="input w-full bg-black/20 border-white/[0.08] text-slate-100 focus:border-blue-500/50" placeholder="Ej: Análisis Matemático I" />
                </div>
                <div>
                  <label className="label text-xs font-medium text-slate-500 uppercase tracking-wider">Código</label>
                  <input required value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value})} type="text" className="input w-full bg-black/20 border-white/[0.08] text-slate-100 focus:border-blue-500/50" placeholder="Ej: AM1" />
                </div>
                
                <div>
                  <label className="label text-xs font-medium text-slate-500 uppercase tracking-wider">Año Teórico</label>
                  <input required min="1" max="6" value={formData.anio_teorico} onChange={e => setFormData({...formData, anio_teorico: parseInt(e.target.value)})} type="number" className="input w-full bg-black/20 border-white/[0.08] text-slate-100 focus:border-blue-500/50" />
                </div>
                <div>
                  <label className="label text-xs font-medium text-slate-500 uppercase tracking-wider">Cuatrimestre</label>
                  <CustomSelect
                    className="w-full"
                    value={formData.cuatrimestre.toString()}
                    onChange={v => setFormData({...formData, cuatrimestre: parseInt(v)})}
                    options={[
                      { value: '1', label: '1° Cuatrimestre' },
                      { value: '2', label: '2° Cuatrimestre' },
                      { value: '0', label: 'Anual' }
                    ]}
                  />
                </div>

                <div>
                  <label className="label text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</label>
                  <CustomSelect
                    className="w-full"
                    value={formData.tipo}
                    onChange={v => setFormData({...formData, tipo: v})}
                    options={[
                      { value: 'obligatoria', label: 'Obligatoria' },
                      { value: 'electiva', label: 'Electiva' }
                    ]}
                  />
                </div>
                <div className="flex items-center mt-6">
                  <label className="cursor-pointer flex items-center gap-3 p-2 hover:bg-white/[0.02] rounded-lg transition-colors">
                    <input type="checkbox" checked={formData.es_critica} onChange={e => setFormData({...formData, es_critica: e.target.checked})} className="checkbox checkbox-error border-white/[0.2]" />
                    <span className="text-sm font-medium text-slate-300">Es materia crítica (filtro)</span>
                  </label>
                </div>

                <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                  <button type="button" onClick={() => setIsAdding(false)} className="btn btn-ghost hover:bg-white/[0.05] text-slate-300">Cancelar</button>
                  <button disabled={isSubmitting} type="submit" className="btn bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30">
                    {isSubmitting ? 'Guardando...' : 'Guardar Asignatura'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plan list view */}
      <motion.div variants={item} className="mt-8">
        {!loading && plan.length > 0 && selectedCarreraId && (
           <div className="flex justify-between items-end mb-2 px-6">
             <span className="font-display text-[10px] font-medium text-slate-500 tracking-widest uppercase">LISTA DE ASIGNATURAS</span>
             <span className="bg-white/5 border border-white/10 rounded-full px-2.5 py-0.5 text-xs text-slate-400">{plan.length} {plan.length === 1 ? 'asignatura' : 'asignaturas'}</span>
           </div>
        )}
        <div className="hidden md:flex px-6 py-3 border-b border-white/[0.08] items-center">
            <div className="flex-1 text-[10px] font-medium text-slate-500 tracking-widest uppercase">Asignatura</div>
            <div className="w-24 text-[10px] font-medium text-slate-500 tracking-widest uppercase">Código</div>
            <div className="w-40 text-[10px] font-medium text-slate-500 tracking-widest uppercase">Ubicación</div>
            <div className="w-32 text-[10px] font-medium text-slate-500 tracking-widest uppercase">Tipo</div>
            <div className="w-24 text-[10px] font-medium text-slate-500 tracking-widest uppercase">Crítica</div>
            <div className="w-20 text-right text-[10px] font-medium text-slate-500 tracking-widest uppercase">Acciones</div>
        </div>
        
        {loading && plan.length === 0 ? (
          <div className="p-12 text-center text-slate-500 animate-pulse">Cargando plan de estudios...</div>
        ) : (
          <div className="flex flex-col gap-[1px]">
            <AnimatePresence>
              {plan.map((p) => (
                <motion.div 
                  key={p.materias.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col md:flex-row md:items-center px-6 py-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-150 group gap-3 md:gap-0"
                >
                  <div className="flex-1 text-slate-100 font-medium pr-4">{p.materias.nombre}</div>
                  
                  <div className="md:w-24 flex items-center shrink-0">
                    <span className="md:hidden text-xs text-slate-500 w-24">Código:</span>
                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md px-2 py-1 text-xs font-mono">{p.materias.codigo}</span>
                  </div>
                  
                  <div className="md:w-40 flex items-center shrink-0">
                    <span className="md:hidden text-xs text-slate-500 w-24">Ubicación:</span>
                    <span className="text-teal-400 font-semibold">{p.anio_teorico}° Año</span>
                    <span className="text-slate-500 ml-1">· {p.cuatrimestre === 0 ? 'Anual' : `${p.cuatrimestre}° Cuat.`}</span>
                  </div>
                  
                  <div className="md:w-32 flex items-center shrink-0">
                    <span className="md:hidden text-xs text-slate-500 w-24">Tipo:</span>
                    {p.tipo === 'obligatoria' ? (
                       <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-xs px-2 py-0.5 font-medium">Obligatoria</span>
                    ) : (
                       <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-md text-xs px-2 py-0.5 font-medium">Electiva</span>
                    )}
                  </div>
                  
                  <div className="md:w-24 flex items-center shrink-0">
                    <span className="md:hidden text-xs text-slate-500 w-24">Filtro:</span>
                    {p.es_critica && (
                       <div className="flex items-center gap-1.5">
                         <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                         <span className="text-xs text-red-400">Crítica</span>
                       </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end gap-2 mt-2 md:mt-0 md:w-20 shrink-0">
                      <button onClick={() => handleEditMateria(p)} className="p-2 rounded hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 hover:shadow-[0_0_10px_rgba(59,130,246,0.3)] transition-all" title="Editar Asignatura">
                         <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteMateria(p.materias.id)} className="p-2 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 hover:shadow-[0_0_10px_rgba(239,68,68,0.3)] transition-all" title="Borrar Asignatura">
                         <Trash2 className="w-4 h-4" />
                      </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {plan.length === 0 && selectedCarreraId && !loading && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="py-16 flex flex-col items-center justify-center text-center px-4"
              >
                <BookOpen className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-300">Todavía no hay asignaturas en este plan</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm">Usá el botón Nueva Asignatura para empezar a estructurar la carrera.</p>
                <button 
                  onClick={() => {
                    setEditingMateriaId(null);
                    setFormData({ nombre: '', codigo: '', anio_teorico: 1, cuatrimestre: 1, tipo: 'obligatoria', es_critica: false });
                    setIsAdding(true);
                  }}
                  className="mt-6 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-teal-400 hover:border-teal-500/30 transition-colors shadow-sm"
                >
                  Añadir Primera Asignatura
                </button>
              </motion.div>
            )}
            {carreras.length === 0 && !loading && (
              <div className="py-16 text-center">
                <p className="text-slate-500">Añadí una carrera nueva para empezar a organizar los planes de estudio.</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
