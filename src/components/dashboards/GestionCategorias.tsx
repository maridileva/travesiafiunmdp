import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { X, Plus, Pencil, Trash2, Info } from 'lucide-react';
import type { CategoriaPregunta } from '../../types/database';
import { getCategorias, createCategoria, updateCategoria, deleteCategoria } from '../../services/categoriasService';

export const GestionCategorias = ({ onClose }: { onClose: () => void }) => {
  const [categorias, setCategorias] = useState<CategoriaPregunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    score_maximo: 100,
    color: '#3B82F6',
    activa: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const cats = await getCategorias();
      setCategorias(cats);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await createCategoria(formData);
      setCategorias([data, ...categorias]);
      setIsAdding(false);
      resetForm();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      const data = await updateCategoria(editingId, formData);
      setCategorias(categorias.map(c => c.id === editingId ? data : c));
      setEditingId(null);
      resetForm();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseás eliminar esta categoría?')) return;
    try {
      await deleteCategoria(id);
      setCategorias(categorias.filter(c => c.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openEdit = (cat: CategoriaPregunta) => {
    setFormData({
      nombre: cat.nombre,
      descripcion: cat.descripcion || '',
      score_maximo: cat.score_maximo,
      color: cat.color,
      activa: cat.activa
    });
    setEditingId(cat.id);
    setIsAdding(false);
  };

  const resetForm = () => {
    setFormData({ nombre: '', descripcion: '', score_maximo: 100, color: '#3B82F6', activa: true });
    setIsAdding(false);
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        className="w-full max-w-md bg-[#0F1B2D] border-l border-white/[0.08] h-full overflow-y-auto shadow-2xl flex flex-col"
      >
        <div className="p-6 border-b border-white/[0.08] flex justify-between items-center sticky top-0 bg-[#0F1B2D]/90 backdrop-blur z-10">
          <h2 className="text-xl font-display font-semibold text-white">Categorías de Preguntas</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 space-y-6">
          {!isAdding && !editingId && (
             <button 
             onClick={() => setIsAdding(true)}
             className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-teal-500/50 rounded-xl text-teal-400 hover:bg-teal-500/10 transition-colors text-sm font-medium font-sans"
           >
             <Plus className="w-4 h-4" /> Agregar Categoría
           </button>
          )}

          {(isAdding || editingId) && (
            <div className="bg-white/[0.03] p-5 rounded-2xl border border-white/[0.08]">
              <h3 className="text-white font-medium mb-4">{editingId ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
              <form onSubmit={editingId ? handleUpdate : handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider font-sans mb-1.5 block">Nombre</label>
                  <input required maxLength={60} type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full bg-black/20 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500/50 focus:outline-none transition-colors" placeholder="Ej: Económico, Académico..." />
                </div>
                
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider font-sans mb-1.5 block">Descripción (Opcional)</label>
                  <textarea maxLength={200} value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} className="w-full bg-black/20 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500/50 focus:outline-none transition-colors" placeholder="Breve descripción..." rows={2} />
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 uppercase tracking-wider font-sans mb-1.5 block">Score Máximo</label>
                    <input required min={1} max={1000} type="number" value={formData.score_maximo} onChange={e => setFormData({...formData, score_maximo: Number(e.target.value)})} className="w-full bg-black/20 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500/50 focus:outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider font-sans mb-1.5 block">Color</label>
                    <div className="relative flex items-center w-24 h-[38px] bg-black/20 border border-white/[0.08] rounded-lg overflow-hidden">
                      <input type="color" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} className="absolute -inset-2 w-32 h-16 cursor-pointer opacity-0" />
                      <div className="w-4 h-4 rounded-full ml-3 shadow-inner pointer-events-none" style={{ backgroundColor: formData.color }} />
                      <span className="ml-2 text-xs font-mono text-slate-300 pointer-events-none">{formData.color}</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-600 font-sans flex items-start gap-1.5 bg-black/20 p-2.5 rounded-lg border border-white/[0.04]">
                    <Info className="w-4 h-4 shrink-0 text-slate-500" />
                    <span>El score del alumno en esta categoría nunca superará este valor máximo, aunque la suma de sus respuestas sea mayor. Permite ponderar su influencia en el riesgo.</span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-[#0F1B2D] font-medium rounded-lg text-sm transition-colors">{editingId ? 'Guardar' : 'Crear'}</button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
             <div className="text-center py-8 text-slate-500">Cargando...</div>
          ) : (
            <div className="space-y-3">
              {categorias.map(cat => (
                <div key={cat.id} className="bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors rounded-xl p-4 flex gap-4 group">
                  <div className="w-3 h-3 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: cat.color }} />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-medium text-white">{cat.nombre}</h4>
                      <span className="bg-white/5 text-slate-400 text-[10px] px-2 py-0.5 rounded-md whitespace-nowrap">Hasta {cat.score_maximo} pts</span>
                    </div>
                    {cat.descripcion && <p className="text-xs text-slate-500 mt-1">{cat.descripcion}</p>}
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(cat)} className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(cat.id)} className="p-1.5 hover:bg-red-500/20 rounded-md text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
