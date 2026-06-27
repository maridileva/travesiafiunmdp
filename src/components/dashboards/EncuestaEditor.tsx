import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, X, Save, Edit2, ChevronDown, ChevronUp, GripVertical, AlertTriangle, Loader2, ClipboardList, CheckCircle2, Circle, Type } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomSelect } from '../ui/CustomSelect';

export const EncuestaEditor = ({ encuesta, onClose }: { encuesta: any, onClose: () => void }) => {
  const [secciones, setSecciones] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchData();
  }, [encuesta.id]);

  const fetchData = async () => {
    setLoading(true);
    // Fetch categories
    const { data: cats } = await supabase.from('categorias_pregunta').select('*').order('created_at');
    if (cats) setCategorias(cats);

    // Fetch secciones
    const { data: secs, error: secError } = await supabase
      .from('encuesta_secciones')
      .select('*')
      .eq('encuesta_id', encuesta.id)
      .order('orden');
    
    if (secError) {
      console.error(secError);
      setLoading(false);
      return;
    }

    // Fetch preguntas for all these secs
    const secIds = secs.map((s: any) => s.id);
    const { data: pregs, error: pregError } = await supabase
      .from('preguntas')
      .select('*')
      .in('seccion_id', secIds.length > 0 ? secIds : ['00000000-0000-0000-0000-000000000000'])
      .order('orden');

    if (pregError) {
      console.error(pregError);
    }

    const { data: scoringOps } = await supabase.from('scoring_opciones').select('*').in('pregunta_id', (pregs || []).map((p: any) => p.id));
    const { data: scoringTramos } = await supabase.from('scoring_tramos').select('*').in('pregunta_id', (pregs || []).map((p: any) => p.id)).order('orden');

    const compiled = secs.map((s: any) => ({
      ...s,
      preguntas: (pregs || []).filter((p: any) => p.seccion_id === s.id).map(p => ({
         ...p,
         isNew: false,
         valor_minimo: p.valor_minimo,
         valor_maximo: p.valor_maximo,
         scoringOpciones: (scoringOps || []).filter((so: any) => so.pregunta_id === p.id),
         scoringTramos: (scoringTramos || []).filter((st: any) => st.pregunta_id === p.id)
      }))
    }));

    setSecciones(compiled);
    setLoading(false);
  };

  const ensureSeccion = (): string => {
    if (secciones.length > 0) {
      return secciones[0].id;
    }
    const newSeccion = {
      id: `temp-${Date.now()}`,
      encuesta_id: encuesta.id,
      titulo: 'Sección Principal',
      orden: 1,
      preguntas: [],
      isNew: true
    };
    setSecciones([newSeccion]);
    return newSeccion.id;
  };

  const addPregunta = () => {
    let targetSeccionId = '';
    if (secciones.length === 0) {
      const newSeccion = {
        id: `temp-sec-${Date.now()}`,
        encuesta_id: encuesta.id,
        titulo: 'Sección Principal',
        orden: 1,
        preguntas: [],
        isNew: true
      };
      setSecciones([newSeccion]);
      targetSeccionId = newSeccion.id;
    } else {
      targetSeccionId = secciones[0].id;
    }

    setSecciones(prev => prev.map(sec => {
      if (sec.id === targetSeccionId) {
        return {
          ...sec,
          preguntas: [
            ...sec.preguntas,
            {
              id: `temp-preg-${Date.now()}`,
              seccion_id: targetSeccionId,
              texto: '',
              tipo: 'unica', // 'texto', 'multiple', 'unica', 'escala', 'numerica'
              opciones: ['Opción 1'],
              es_obligatoria: true,
              categoria_id: null,
              scoringOpciones: [],
              scoringTramos: [],
              valor_minimo: null,
              valor_maximo: null,
              unidad: null,
              orden: sec.preguntas.length + 1,
              isNew: true
            }
          ]
        };
      }
      return sec;
    }));
  };

  const updatePregunta = (seccionId: string, preguntaId: string, changes: any) => {
    setSecciones(prev => prev.map(sec => {
      if (sec.id === seccionId) {
        return {
          ...sec,
          preguntas: sec.preguntas.map((p: any) => p.id === preguntaId ? { ...p, ...changes } : p)
        };
      }
      return sec;
    }));
  };

  const deletePregunta = (seccionId: string, preguntaId: string) => {
    setSecciones(prev => prev.map(sec => {
      if (sec.id === seccionId) {
        return {
          ...sec,
          preguntas: sec.preguntas.filter((p: any) => p.id !== preguntaId)
        };
      }
      return sec;
    }));
  };

  const handleSave = async () => {
    // Validaciones
    for (const sec of secciones) {
      for (const preg of sec.preguntas) {
        if (preg.tipo === 'escala' || preg.tipo === 'numerica') {
          for (const tramo of (preg.scoringTramos || [])) {
            if (!tramo.formula || tramo.formula.trim() === '') {
              setErrorMsg(`La pregunta "${preg.texto}" tiene un tramo con fórmula vacía.`);
              return;
            }
            if (tramo.condicion_tipo === 'entre') {
              if (tramo.condicion_valor_min == null || tramo.condicion_valor_max == null || tramo.condicion_valor_min >= tramo.condicion_valor_max) {
                setErrorMsg(`La pregunta "${preg.texto}" tiene un tramo "entre" donde el mínimo no es estrictamente menor al máximo.`);
                return;
              }
            }
          }
        }
      }
    }

    setSaving(true);
    setErrorMsg('');
    try {
      // 1. Obtener secciones actuales en db
      const { data: dbSecciones, error: dbSecErr } = await supabase
        .from('encuesta_secciones')
        .select('id')
        .eq('encuesta_id', encuesta.id);
      if (dbSecErr) throw dbSecErr;

      const currSecIds = secciones.filter(s => !s.isNew).map(s => s.id);
      const dbSecIds = (dbSecciones || []).map(s => s.id);
      const toDeleteSecs = dbSecIds.filter(id => !currSecIds.includes(id));

      if (toDeleteSecs.length > 0) {
        const { error: delSecErr } = await supabase.from('encuesta_secciones').delete().in('id', toDeleteSecs);
        if (delSecErr) throw delSecErr;
      }

      for (const [sIndex, sec] of secciones.entries()) {
        let sid = sec.id;
        const sPayload = {
          encuesta_id: encuesta.id,
          titulo: sec.titulo,
          orden: sIndex + 1
        };

        if (sec.isNew) {
          const { data: newS, error: nSErr } = await supabase
            .from('encuesta_secciones')
            .insert(sPayload)
            .select('id')
            .single();
          if (nSErr) throw nSErr;
          sid = newS.id;
        } else {
          const { error: uSErr } = await supabase
            .from('encuesta_secciones')
            .update(sPayload)
            .eq('id', sid);
          if (uSErr) throw uSErr;
        }

        // Obtener preguntas actuales de la sección en DB
        const { data: dbPregs, error: dbPErr } = await supabase
          .from('preguntas')
          .select('id')
          .eq('seccion_id', sid);
        if (dbPErr) throw dbPErr;

        const currPregsIds = sec.preguntas.filter((p: any) => !p.isNew).map((p: any) => p.id);
        const dbPregsIds = (dbPregs || []).map(p => p.id);
        const toDeletePregs = dbPregsIds.filter(id => !currPregsIds.includes(id));

        if (toDeletePregs.length > 0) {
          const { error: delPErr } = await supabase.from('preguntas').delete().in('id', toDeletePregs);
          if (delPErr) throw delPErr;
        }

        for (const [pIndex, preg] of sec.preguntas.entries()) {
          const pPayload: any = {
            seccion_id: sid,
            texto: preg.texto,
            tipo: preg.tipo,
            opciones: preg.opciones,
            es_obligatoria: preg.es_obligatoria ?? true,
            orden: pIndex + 1,
            categoria_id: preg.categoria_id || null
          };

          if (preg.valor_minimo !== undefined) pPayload.valor_minimo = preg.valor_minimo;
          if (preg.valor_maximo !== undefined) pPayload.valor_maximo = preg.valor_maximo;
          if (preg.unidad !== undefined) pPayload.unidad = preg.unidad;
          if (preg.descripcion !== undefined) pPayload.descripcion = preg.descripcion;

          let pid = preg.id;

          if (preg.isNew) {
            const { data: newP, error: npErr } = await supabase.from('preguntas').insert(pPayload).select('id').single();
            if (npErr) throw npErr;
            pid = newP.id;
          } else {
            const { error: upErr } = await supabase.from('preguntas').update(pPayload).eq('id', pid);
            if (upErr) throw upErr;
          }

          // Handle scoring_opciones
          if (preg.scoringOpciones && preg.scoringOpciones.length > 0) {
            const { error: delSoErr } = await supabase.from('scoring_opciones').delete().eq('pregunta_id', pid);
            if (delSoErr) throw delSoErr;
            const soPayload = preg.scoringOpciones.map((so: any) => ({
              pregunta_id: pid,
              opcion_valor: so.opcion_valor,
              score: so.score
            }));
            const { error: insSoErr } = await supabase.from('scoring_opciones').insert(soPayload);
            if (insSoErr) throw insSoErr;
          } else {
             const { error: delSoErr } = await supabase.from('scoring_opciones').delete().eq('pregunta_id', pid);
             if (delSoErr) throw delSoErr;
          }

          // Handle scoring_tramos
          if (preg.scoringTramos && preg.scoringTramos.length > 0) {
            const { error: delStErr } = await supabase.from('scoring_tramos').delete().eq('pregunta_id', pid);
            if (delStErr) throw delStErr;
            const stPayload = preg.scoringTramos.map((st: any, idx: number) => ({
              pregunta_id: pid,
              orden: idx + 1,
              condicion_tipo: st.condicion_tipo,
              condicion_valor: st.condicion_valor,
              condicion_valor_min: st.condicion_valor_min,
              condicion_valor_max: st.condicion_valor_max,
              formula: st.formula
            }));
            const { error: insStErr } = await supabase.from('scoring_tramos').insert(stPayload);
            if (insStErr) throw insStErr;
          } else {
             const { error: delStErr } = await supabase.from('scoring_tramos').delete().eq('pregunta_id', pid);
             if (delStErr) throw delStErr;
          }
        }
      }

      onClose(); // Exit on success
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Error guardando encuesta');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[5vh] pb-[100px] px-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="relative z-[101] bg-[#0F1B2D] border border-white/10 p-6 md:p-8 rounded-2xl shadow-[0_24px_48px_rgba(0,0,0,0.5)] w-full max-w-2xl h-[600px] flex flex-col"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* HEADER */}
        <div className="shrink-0 mb-0 pr-10 border-b border-white/[0.06] pb-4">
          <h2 className="text-xl font-display font-semibold text-white">
            Editor de Preguntas
          </h2>
          <p className="text-sm text-slate-500 font-sans mt-0.5">
            Modificando: <span className="font-medium text-slate-400">{encuesta.titulo}</span>
          </p>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 mt-4 pr-2 pb-4 space-y-6">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
              <p className="text-sm font-sans text-slate-500">Cargando preguntas...</p>
            </div>
          ) : secciones.reduce((acc, sec) => acc + (sec.preguntas?.length || 0), 0) === 0 ? (
            <div className="h-full flex flex-col items-center justify-center space-y-6">
              <div className="text-center flex flex-col items-center">
                <ClipboardList className="w-8 h-8 text-slate-700 mb-2" />
                <p className="text-sm text-slate-600">Todavía no hay preguntas en esta encuesta</p>
              </div>
              <button 
                onClick={addPregunta}
                className="w-full max-w-sm py-4 border border-dashed border-white/10 hover:border-teal-500/30 rounded-xl text-slate-400 hover:text-teal-400 transition-all duration-200 flex items-center justify-center gap-2 font-medium"
              >
                <Plus className="w-5 h-5" /> Añadir Nueva Pregunta
              </button>
            </div>
          ) : (
            <>
              <AnimatePresence>
                {secciones.map((sec, sIdx) => (
                  <div key={sec.id} className="space-y-3 px-1 py-2">
                    {sec.preguntas.map((preg: any, pIdx: number) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        key={preg.id}
                        className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 hover:border-white/[0.11] transition-all duration-200 flex flex-col"
                      >
                        {/* Zona 1: Fila superior */}
                        <div className="flex items-center gap-2 mb-3">
                          <input 
                            type="text" 
                            className="flex-1 bg-transparent border-b border-white/[0.08] focus:border-teal-500/50 pb-1 text-sm text-white placeholder:text-slate-600 font-sans outline-none"
                            placeholder="Escribe la pregunta..."
                            value={preg.texto}
                            onChange={(e) => updatePregunta(sec.id, preg.id, { texto: e.target.value })}
                          />
                          <CustomSelect
                            className="w-36 shrink-0"
                            value={preg.tipo}
                            onChange={(v) => updatePregunta(sec.id, preg.id, { tipo: v })}
                            options={[
                              { value: 'unica', label: 'Opción Única' },
                              { value: 'multiple', label: 'Opción Múltiple' },
                              { value: 'texto', label: 'Texto Libre' },
                              { value: 'escala', label: 'Escala (1-10)' },
                              { value: 'numerica', label: 'Numérica' }
                            ]}
                          />
                          <button 
                            onClick={() => deletePregunta(sec.id, preg.id)}
                            className="shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Zona 2: Metadatos */}
                        <div className="flex items-center gap-3 mb-4">
                          <CustomSelect
                            className="flex-1"
                            value={preg.categoria_id || ''}
                            onChange={(v) => updatePregunta(sec.id, preg.id, { categoria_id: v || null })}
                            options={[
                              { value: '', label: 'Sin categoría' },
                              ...categorias.map((cat: any) => ({
                                value: cat.id,
                                label: cat.nombre,
                                color: cat.color || '#3B82F6' // default if missing
                              }))
                            ]}
                          />
                          
                          <button
                            onClick={() => updatePregunta(sec.id, preg.id, { es_obligatoria: !preg.es_obligatoria })}
                            className={`rounded-full px-3 py-1 text-xs border cursor-pointer transition-all duration-200 flex items-center justify-center gap-1.5 shrink-0 ${
                              preg.es_obligatoria 
                                ? 'bg-teal-500/20 border-teal-500/30 text-teal-400' 
                                : 'bg-white/[0.04] border-white/[0.08] text-slate-600'
                            }`}
                          >
                            {preg.es_obligatoria ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                            {preg.es_obligatoria ? 'Obligatoria' : 'Opcional'}
                          </button>
                        </div>

                        {/* Zona 3: Opciones */}
                        {(preg.tipo === 'unica' || preg.tipo === 'multiple') && (
                          <div className="flex-1 w-full relative">
                            <div className="flex items-center w-full mb-2 pr-6">
                              <span className="text-xs uppercase tracking-wider text-slate-600 font-sans flex-1">OPCIONES</span>
                              <span className="text-xs uppercase tracking-wider text-slate-600 font-sans w-20 text-right mr-6">PTS</span>
                            </div>
                            <div className="space-y-2">
                              {preg.opciones?.map((opt: string, optIdx: number) => {
                                const currentScore = preg.scoringOpciones?.find((so:any) => so.opcion_valor === opt)?.score || 0;
                                return (
                                  <motion.div 
                                    key={optIdx} 
                                    initial={{ opacity: 0, y: 5 }} 
                                    animate={{ opacity: 1, y: 0 }} 
                                    transition={{ delay: optIdx * 0.04 }}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="text-xs text-slate-700 w-4 shrink-0 font-mono text-right">
                                      {optIdx + 1}.
                                    </span>
                                    <input
                                      type="text"
                                      className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500/40 font-sans outline-none"
                                      value={opt}
                                      onChange={(e) => {
                                        const nuevasOpciones = [...preg.opciones];
                                        nuevasOpciones[optIdx] = e.target.value;
                                        
                                        const oldOpt = preg.opciones[optIdx];
                                        const nuevasScoring = [...(preg.scoringOpciones || [])];
                                        const soIndex = nuevasScoring.findIndex(s => s.opcion_valor === oldOpt);
                                        if (soIndex !== -1) {
                                          nuevasScoring[soIndex] = { ...nuevasScoring[soIndex], opcion_valor: e.target.value };
                                        }

                                        updatePregunta(sec.id, preg.id, { opciones: nuevasOpciones, scoringOpciones: nuevasScoring });
                                      }}
                                    />
                                    <input 
                                      type="number"
                                      value={currentScore}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        const nuevasScoring = [...(preg.scoringOpciones || [])];
                                        const soIndex = nuevasScoring.findIndex(s => s.opcion_valor === opt);
                                        if (soIndex !== -1) {
                                          nuevasScoring[soIndex] = { ...nuevasScoring[soIndex], score: val };
                                        } else {
                                          nuevasScoring.push({ opcion_valor: opt, score: val });
                                        }
                                        updatePregunta(sec.id, preg.id, { scoringOpciones: nuevasScoring });
                                      }}
                                      className="w-16 shrink-0 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-teal-400 text-right font-mono focus:border-teal-500/40 outline-none"
                                      placeholder="0"
                                    />
                                    <span className="text-xs text-slate-600 w-6 shrink-0">pts</span>
                                    <button 
                                      onClick={() => {
                                        const oldOpt = preg.opciones[optIdx];
                                        const nuevasOpciones = [...preg.opciones];
                                        nuevasOpciones.splice(optIdx, 1);
                                        
                                        const nuevasScoring = (preg.scoringOpciones || []).filter((s:any) => s.opcion_valor !== oldOpt);
                                        
                                        updatePregunta(sec.id, preg.id, { opciones: nuevasOpciones, scoringOpciones: nuevasScoring });
                                      }}
                                      className="p-1 text-slate-700 hover:text-red-400 transition-colors shrink-0"
                                    ><X className="w-3 h-3" /></button>
                                  </motion.div>
                                )})}
                            </div>
                            <button
                              onClick={() => {
                                const nuevasOpciones = [...(preg.opciones || []), `Opción ${(preg.opciones?.length || 0) + 1}`];
                                updatePregunta(sec.id, preg.id, { opciones: nuevasOpciones });
                              }}
                              className="text-xs text-teal-500 hover:text-teal-400 mt-1 ml-6 flex items-center gap-1 transition-colors hover:bg-transparent"
                            >
                              <Plus className="w-3 h-3" /> Añadir opción
                            </button>
                            {preg.tipo === 'multiple' && (
                              <p className="text-xs text-slate-600 font-sans mt-2 ml-6">ⓘ El score total es la suma de las opciones seleccionadas</p>
                            )}
                          </div>
                        )}

                        {/* Zona 3 alternativa: Tramos y Numerica */}
                        {(preg.tipo === 'escala' || preg.tipo === 'numerica') && (
                          <div className="w-full">
                            <div className="flex justify-between items-center mb-2">
                               <span className="text-xs uppercase tracking-wider text-slate-600 font-sans">FÓRMULA POR TRAMOS</span>
                               <button onClick={() => {
                                 const st = [...(preg.scoringTramos || [])];
                                 st.push({
                                   id: `temp-t-${Date.now()}`,
                                   condicion_tipo: 'menor',
                                   condicion_valor: 0,
                                   condicion_valor_min: null,
                                   condicion_valor_max: null,
                                   formula: 'x'
                                 });
                                 updatePregunta(sec.id, preg.id, { scoringTramos: st });
                               }} className="text-xs text-teal-500 hover:text-teal-400 flex items-center gap-1 transition-colors hover:bg-transparent"><Plus className="w-3 h-3"/> Tramo</button>
                            </div>
                            <div className="space-y-2">
                              <AnimatePresence>
                              {preg.scoringTramos?.map((tramo: any, idx: number) => (
                                <motion.div 
                                  key={tramo.id || idx} 
                                  initial={{ opacity: 0, y: 5 }} 
                                  animate={{ opacity: 1, y: 0 }} 
                                  exit={{ opacity: 0, scale: 0.98 }}
                                  transition={{ delay: idx * 0.04 }}
                                  className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 flex flex-wrap gap-2 items-center"
                                >
                                  <CustomSelect
                                    className="w-28 shrink-0"
                                    value={tramo.condicion_tipo}
                                    onChange={(v) => {
                                      const st = [...preg.scoringTramos];
                                      st[idx] = { ...st[idx], condicion_tipo: v };
                                      updatePregunta(sec.id, preg.id, { scoringTramos: st });
                                    }}
                                    options={[
                                      { value: 'menor', label: 'x <' },
                                      { value: 'menor_igual', label: 'x <=' },
                                      { value: 'mayor', label: 'x >' },
                                      { value: 'mayor_igual', label: 'x >=' },
                                      { value: 'igual', label: 'x =' },
                                      { value: 'entre', label: 'entre' }
                                    ]}
                                  />
                                  
                                  {tramo.condicion_tipo === 'entre' ? (
                                    <div className="flex gap-2 items-center">
                                      <input type="number" value={tramo.condicion_valor_min ?? ''} onChange={e => {
                                        const st = [...preg.scoringTramos];
                                        st[idx] = { ...st[idx], condicion_valor_min: Number(e.target.value) };
                                        updatePregunta(sec.id, preg.id, { scoringTramos: st });
                                      }} className="bg-transparent border-b border-white/[0.08] text-xs text-slate-300 w-16 font-mono outline-none text-center px-1" placeholder="min" />
                                      <span className="text-slate-600 text-xs">y</span>
                                      <input type="number" value={tramo.condicion_valor_max ?? ''} onChange={e => {
                                        const st = [...preg.scoringTramos];
                                        st[idx] = { ...st[idx], condicion_valor_max: Number(e.target.value) };
                                        updatePregunta(sec.id, preg.id, { scoringTramos: st });
                                      }} className="bg-transparent border-b border-white/[0.08] text-xs text-slate-300 w-16 font-mono outline-none text-center px-1" placeholder="max" />
                                    </div>
                                  ) : (
                                    <input type="number" value={tramo.condicion_valor ?? ''} onChange={e => {
                                      const st = [...preg.scoringTramos];
                                      st[idx] = { ...st[idx], condicion_valor: Number(e.target.value) };
                                      updatePregunta(sec.id, preg.id, { scoringTramos: st });
                                    }} className="bg-transparent border-b border-white/[0.08] text-xs text-slate-300 w-16 font-mono outline-none text-center px-1" placeholder="valor" />
                                  )}
                                  
                                  <span className="text-slate-700 text-xs px-1">→</span>
                                  
                                  <input type="text" value={tramo.formula ?? ''} onChange={e => {
                                    const st = [...preg.scoringTramos];
                                    st[idx] = { ...st[idx], formula: e.target.value };
                                    updatePregunta(sec.id, preg.id, { scoringTramos: st });
                                  }} className="flex-1 min-w-0 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-amber-400 font-mono placeholder:text-slate-600 outline-none focus:border-amber-500/40 placeholder:font-mono" placeholder="ej: x * 2 + 5" />
                                  
                                  <button onClick={() => {
                                    const st = [...preg.scoringTramos];
                                    st.splice(idx, 1);
                                    updatePregunta(sec.id, preg.id, { scoringTramos: st });
                                  }} className="p-1 text-slate-700 hover:text-red-400 transition-colors shrink-0"><X className="w-3 h-3"/></button>
                                </motion.div>
                              ))}
                              </AnimatePresence>
                              {preg.scoringTramos?.length === 0 && <p className="text-xs text-slate-600 mt-2">No hay tramos configurados. Si no hay tramos, el score será 0.</p>}
                            </div>

                            {preg.tipo === 'numerica' && (
                              <div className="flex flex-wrap gap-3 mt-4">
                                <div>
                                   <label className="text-xs text-slate-600 mb-1 block font-mono">Mínimo</label>
                                   <input type="number" value={preg.valor_minimo ?? ''} onChange={e => updatePregunta(sec.id, preg.id, { valor_minimo: e.target.value === '' ? null : Number(e.target.value)})} className="w-20 font-mono text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 text-slate-300 outline-none" placeholder="Opt" />
                                </div>
                                <div>
                                   <label className="text-xs text-slate-600 mb-1 block font-mono">Máximo</label>
                                   <input type="number" value={preg.valor_maximo ?? ''} onChange={e => updatePregunta(sec.id, preg.id, { valor_maximo: e.target.value === '' ? null : Number(e.target.value)})} className="w-20 font-mono text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 text-slate-300 outline-none" placeholder="Opt" />
                                </div>
                                <div>
                                   <label className="text-xs text-slate-600 mb-1 block font-sans">Unidad</label>
                                   <input type="text" value={preg.unidad ?? ''} onChange={e => updatePregunta(sec.id, preg.id, { unidad: e.target.value === '' ? null : e.target.value})} className="w-24 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none placeholder:text-slate-600 font-sans" placeholder="ej: horas" />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Zona 4: Texto */}
                        {preg.tipo === 'texto' && (
                          <div className="border border-dashed border-white/[0.06] rounded-xl p-3 flex items-center justify-center gap-2 w-full mt-2">
                             <Type className="w-4 h-4 text-slate-700" />
                             <span className="text-xs text-slate-700 font-sans">Respuesta de texto libre — sin scoring</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ))}
              </AnimatePresence>
              
              <div className="pt-2 px-1">
                <button 
                  onClick={addPregunta}
                  className="w-full py-3 border border-dashed border-white/[0.08] hover:border-teal-500/20 hover:bg-teal-500/[0.02] rounded-xl text-slate-600 hover:text-teal-400 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-sans font-medium"
                >
                  <Plus className="w-4 h-4" /> Añadir Nueva Pregunta
                </button>
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="shrink-0 pt-4 mt-0 border-t border-white/[0.06] flex justify-between items-center">
          <div className="text-red-400 text-sm">{errorMsg}</div>
          <div className="flex gap-3 ml-auto">
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-[#0F1B2D] font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : <><Save className="w-4 h-4" /> Guardar Cambios</>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
