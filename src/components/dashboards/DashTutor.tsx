import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useEstudiantes } from '../../hooks/useEstudiantes';
import { useAlertas } from '../../hooks/useAlertas';
import { supabase } from '../../lib/supabase';
import { Users, AlertTriangle, MessageCircle, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface ScoreMap {
  [estudianteId: string]: {
    valor: number;
    nivel_riesgo: 'bajo' | 'medio' | 'alto' | 'critico';
    calculado_at: string;
  };
}

interface EntrevistaForm {
  // Señales de riesgo (con scoring)
  motivo_duda: string;
  a_quien_recurre: string;
  probabilidad_aprobar: number | null;
  // Observaciones (texto libre, sin scoring)
  obs_si_dejara: string;
  obs_motivacion: string;
  obs_adicionales: string;
  // Valoración global del tutor
  valoracion_global: number | null;
}

const FORM_INICIAL: EntrevistaForm = {
  motivo_duda: '',
  a_quien_recurre: '',
  probabilidad_aprobar: null,
  obs_si_dejara: '',
  obs_motivacion: '',
  obs_adicionales: '',
  valoracion_global: null,
};

// ── Helpers visuales ─────────────────────────────────────────────────────────

const BadgeRiesgo = ({ nivel, valor }: { nivel: string; valor: number }) => {
  const map: Record<string, string> = {
    bajo:    'badge-success text-white',
    medio:   'badge-warning',
    alto:    'badge-error text-white',
    critico: 'bg-gray-900 text-white border border-red-900',
  };
  const label: Record<string, string> = {
    bajo: 'Vigoroso', medio: 'Moderado', alto: 'Alto Riesgo', critico: 'Crítico',
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`badge ${map[nivel] ?? 'badge-ghost'}`}>
        {label[nivel] ?? nivel}
      </span>
      <span className="text-xs font-mono bg-gray-800 px-2 py-1 rounded">
        {valor}/100
      </span>
    </div>
  );
};

const ScaleInput = ({
  label, value, onChange, min = 1, max = 10
}: {
  label: string; value: number | null; onChange: (v: number) => void; min?: number; max?: number;
}) => (
  <div>
    <label className="label text-sm text-gray-400">{label}</label>
    <div className="flex gap-1 flex-wrap">
      {Array.from({ length: max - min + 1 }, (_, i) => i + min).map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-9 h-9 rounded text-sm font-bold transition-colors
            ${value === n
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
        >
          {n}
        </button>
      ))}
    </div>
    {value !== null && (
      <p className="text-xs text-gray-500 mt-1">Seleccionado: {value}</p>
    )}
  </div>
);

// ── Componente principal ─────────────────────────────────────────────────────

export const DashTutor = () => {
  const { usuario, rol } = useAuth();
  const { estudiantes: myStudents, loading: estLoading } = useEstudiantes(usuario?.id || '', rol || '');
  const { alertas } = useAlertas(usuario?.id || '');

  // Scores reales traídos de la BD
  const [scores, setScores] = useState<ScoreMap>({});
  const [loadingScores, setLoadingScores] = useState(false);

  // Modal
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EntrevistaForm>(FORM_INICIAL);
  const [saving, setSaving] = useState(false);

  // Ordenamiento
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ── Cargar scores reales ────────────────────────────────────────────────────
  useEffect(() => {
    if (!myStudents.length) return;

    const ids = myStudents.map((s: any) => s.estudiante_id);
    setLoadingScores(true);

    // Traemos el último score de cada alumno
    supabase
      .from('scores')
      .select('estudiante_id, valor, nivel_riesgo, calculado_at')
      .in('estudiante_id', ids)
      .order('calculado_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        // Nos quedamos con el más reciente por alumno
        const map: ScoreMap = {};
        data.forEach((s: any) => {
          if (!map[s.estudiante_id]) {
            map[s.estudiante_id] = {
              valor: Math.round(s.valor),
              nivel_riesgo: s.nivel_riesgo,
              calculado_at: s.calculado_at,
            };
          }
        });
        setScores(map);
        setLoadingScores(false);
      });
  }, [myStudents]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const getScore = (estudianteId: string) =>
    scores[estudianteId] ?? { valor: 0, nivel_riesgo: 'bajo', calculado_at: null };

  const isSilentProfile = (estudianteId: string) =>
    alertas.some((a: any) =>
      a.estudiante_id === estudianteId && a.tipo === 'perfil_silencioso' && a.estado === 'pendiente'
    );

  const needsHelp = (estudianteId: string) =>
    alertas.some((a: any) =>
      a.estudiante_id === estudianteId && a.tipo === 'solicitud_ayuda' && a.estado !== 'resuelta'
    );

  // Alumnos ordenados por score
  const studentsSorted = [...myStudents].sort((a: any, b: any) => {
    const sa = getScore(a.estudiante_id).valor;
    const sb = getScore(b.estudiante_id).valor;
    return sortDir === 'desc' ? sb - sa : sa - sb;
  });

  // ── Guardar entrevista ───────────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !usuario) return;

    if (!form.valoracion_global) {
      toast.error('La valoración global del tutor es obligatoria.');
      return;
    }

    setSaving(true);
    try {
      // 1. Creamos la intervención
      const { data: interv, error: intervError } = await supabase
        .from('intervenciones')
        .insert({
          estudiante_id:  selectedStudent.estudiante_id,
          tutor_id:       usuario.id,
          tipo:           'entrevista',
          modalidad:      'presencial',
          fecha_realizada: new Date().toISOString(),
          motivo:         'Seguimiento tutoral',
          // Guardamos el formulario completo en el campo resumen (JSON)
          resumen: JSON.stringify({
            motivo_duda:          form.motivo_duda,
            a_quien_recurre:      form.a_quien_recurre,
            probabilidad_aprobar: form.probabilidad_aprobar,
            valoracion_global:    form.valoracion_global,
          }),
          compromisos:    form.obs_motivacion,
          proxima_accion: form.obs_adicionales,
        })
        .select('id')
        .single();

      if (intervError) throw intervError;

      // 2. Buscamos la encuesta de entrevista activa
      const { data: encuesta } = await supabase
        .from('encuestas')
        .select('id')
        .eq('tipo', 'entrevista')
        .eq('activa', true)
        .single();

      // 3. Si existe la encuesta, creamos una sesión y guardamos respuestas
      if (encuesta) {
        const { data: sesion } = await supabase
          .from('sesiones_encuesta')
          .insert({
            encuesta_id:    encuesta.id,
            estudiante_id:  selectedStudent.estudiante_id,
            cuatrimestre:   new Date().getMonth() < 7 ? 1 : 2,
            anio:           new Date().getFullYear(),
            estado:         'completada',
            completada_at:  new Date().toISOString(),
          })
          .select('id')
          .single();

        if (sesion) {
          // Traemos las preguntas de la encuesta de entrevista
          const { data: preguntas } = await supabase
            .from('preguntas')
            .select('id, texto')
            .in('seccion_id', await supabase
              .from('encuesta_secciones')
              .select('id')
              .eq('encuesta_id', encuesta.id)
              .then(({ data }) => (data ?? []).map((s: any) => s.id))
            );

          // Mapeamos respuestas por texto de pregunta
          const respuestas: { sesion_id: string; pregunta_id: string; valor: string }[] = [];
          (preguntas ?? []).forEach((p: any) => {
            const txt = p.texto.toLowerCase();
            let valor = '';

            if (txt.includes('dudar')) valor = form.motivo_duda;
            else if (txt.includes('recurre') || txt.includes('recurrir')) valor = form.a_quien_recurre;
            else if (txt.includes('posible') || txt.includes('aprobar')) valor = String(form.probabilidad_aprobar ?? '');
            else if (txt.includes('dejara') || txt.includes('lugar de estudiar')) valor = form.obs_si_dejara;
            else if (txt.includes('motiva') || txt.includes('inscrito')) valor = form.obs_motivacion;
            else if (txt.includes('riesgo de abandonar') || txt.includes('valoración')) valor = String(form.valoracion_global ?? '');
            else if (txt.includes('adicionales') || txt.includes('observaciones')) valor = form.obs_adicionales;

            if (valor) {
              respuestas.push({ sesion_id: sesion.id, pregunta_id: p.id, valor });
            }
          });

          if (respuestas.length > 0) {
            await supabase.from('respuestas').insert(respuestas);
          }
        }
      }

      // 4. Recalcular score del alumno con la nueva info
      await supabase.functions.invoke('calcular-score', {
        body: { estudiante_id: selectedStudent.estudiante_id }
      });

      // 5. Marcar alertas de solicitud de ayuda como resueltas
      await supabase
        .from('alertas')
        .update({ estado: 'resuelta', resuelta_at: new Date().toISOString(), resuelta_por: usuario.id })
        .eq('estudiante_id', selectedStudent.estudiante_id)
        .eq('tipo', 'solicitud_ayuda')
        .eq('estado', 'pendiente');

      toast.success('Entrevista registrada. Score recalculado.');
      setModalOpen(false);
      setSelectedStudent(null);
      setForm(FORM_INICIAL);

      // Refrescar scores
      const { data: newScore } = await supabase
        .from('scores')
        .select('estudiante_id, valor, nivel_riesgo, calculado_at')
        .eq('estudiante_id', selectedStudent.estudiante_id)
        .order('calculado_at', { ascending: false })
        .limit(1)
        .single();

      if (newScore) {
        setScores(prev => ({
          ...prev,
          [newScore.estudiante_id]: {
            valor: Math.round(newScore.valor),
            nivel_riesgo: newScore.nivel_riesgo,
            calculado_at: newScore.calculado_at,
          }
        }));
      }

    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (estLoading) return (
    <div className="flex items-center justify-center min-h-[40vh] text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando alumnos...
    </div>
  );

  const criticos  = myStudents.filter((s: any) => getScore(s.estudiante_id).nivel_riesgo === 'critico').length;
  const sinScore  = myStudents.filter((s: any) => !scores[s.estudiante_id]).length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">

      {/* Header con métricas */}
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Mis Alumnos a Cargo</h1>
          <p className="text-gray-400 mt-1">Monitoreo y seguimiento de cohortes asignadas.</p>
        </div>
        <div className="stats shadow bg-gray-900 border border-gray-800">
          <div className="stat px-6 py-2">
            <div className="stat-title text-gray-400">Total</div>
            <div className="stat-value text-blue-500 text-2xl">{myStudents.length}</div>
          </div>
          <div className="stat px-6 py-2">
            <div className="stat-title text-gray-400">Críticos</div>
            <div className="stat-value text-red-500 text-2xl">{criticos}</div>
          </div>
          {sinScore > 0 && (
            <div className="stat px-6 py-2">
              <div className="stat-title text-gray-400">Sin score</div>
              <div className="stat-value text-amber-500 text-2xl">{sinScore}</div>
            </div>
          )}
        </div>
      </header>

      {/* Tabla de alumnos */}
      <div className="overflow-x-auto bg-gray-900 rounded-2xl border border-gray-800 shadow-xl">
        <table className="table table-zebra table-pin-rows w-full">
          <thead>
            <tr className="bg-gray-950 text-gray-300 border-b border-gray-800">
              <th>Alumno</th>
              <th>
                <button
                  className="flex items-center gap-1 hover:text-white transition-colors"
                  onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                >
                  Score (Riesgo)
                  {sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                </button>
              </th>
              <th>Perfil Silencioso</th>
              <th>Solicitud Ayuda</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {studentsSorted.map((student: any) => {
              const u     = student.usuarios;
              const sc    = getScore(student.estudiante_id);
              const silent = isSilentProfile(student.estudiante_id);
              const help   = needsHelp(student.estudiante_id);

              return (
                <tr
                  key={student.estudiante_id}
                  className={`border-b border-gray-800 transition-colors
                    ${sc.nivel_riesgo === 'critico' ? 'bg-red-950/20' : ''}
                    ${silent ? 'bg-amber-950/10' : ''}`}
                >
                  <td>
                    <div className="font-bold">{u?.nombre} {u?.apellido}</div>
                    <div className="text-xs text-gray-500">{u?.legajo || 'Sin legajo'}</div>
                  </td>
                  <td>
                    {loadingScores && !scores[student.estudiante_id]
                      ? <span className="loading loading-dots loading-xs" />
                      : scores[student.estudiante_id]
                        ? <BadgeRiesgo nivel={sc.nivel_riesgo} valor={sc.valor} />
                        : <span className="text-xs text-gray-500 italic">Sin calcular</span>
                    }
                  </td>
                  <td>
                    {silent
                      ? <span className="flex items-center text-amber-400 gap-1 text-xs font-medium">
                          <AlertTriangle className="w-4 h-4" /> Sí
                        </span>
                      : <span className="text-gray-600 text-xs">No</span>
                    }
                  </td>
                  <td>
                    {help
                      ? <span className="badge badge-error badge-outline gap-1 animate-pulse">
                          <MessageCircle className="w-3 h-3" /> Solicitó ayuda
                        </span>
                      : <span className="text-gray-600 text-xs">—</span>
                    }
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-ghost text-blue-400 hover:bg-gray-800"
                      onClick={() => { setSelectedStudent(student); setForm(FORM_INICIAL); setModalOpen(true); }}
                    >
                      <FileText className="w-4 h-4 mr-1" /> Entrevista
                    </button>
                  </td>
                </tr>
              );
            })}
            {myStudents.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">
                  No tenés alumnos asignados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de entrevista */}
      <AnimatePresence>
        {modalOpen && selectedStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              {/* Título */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-2xl text-white">
                    Registro de Entrevista
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    {selectedStudent.usuarios?.nombre} {selectedStudent.usuarios?.apellido}
                    {' · '}
                    <span className="font-mono">{selectedStudent.usuarios?.legajo}</span>
                  </p>
                </div>
                {scores[selectedStudent.estudiante_id] && (
                  <BadgeRiesgo
                    nivel={getScore(selectedStudent.estudiante_id).nivel_riesgo}
                    valor={getScore(selectedStudent.estudiante_id).valor}
                  />
                )}
              </div>

              <form onSubmit={handleSave} className="space-y-6">

                {/* SECCIÓN 1: Señales de riesgo */}
                <div className="bg-gray-800/60 rounded-xl p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    Señales de Riesgo
                  </h4>

                  {/* Motivo de duda */}
                  <div>
                    <label className="label text-sm text-gray-400">
                      ¿Qué es lo que más hace dudar al alumno sobre seguir adelante? *
                    </label>
                    <select
                      required
                      className="select select-bordered w-full bg-gray-950 border-gray-700 text-white"
                      value={form.motivo_duda}
                      onChange={e => setForm({ ...form, motivo_duda: e.target.value })}
                    >
                      <option value="">Seleccioná una opción</option>
                      <option>No expresa dudas</option>
                      <option>Desinterés por los contenidos de la carrera</option>
                      <option>Exceso de presión o estrés académico</option>
                      <option>Problemas personales o familiares</option>
                      <option>Dificultades económicas</option>
                      <option>Siente que no está aprendiendo ni avanzando</option>
                    </select>
                  </div>

                  {/* A quién recurre */}
                  <div>
                    <label className="label text-sm text-gray-400">
                      ¿A quién recurre el alumno cuando tiene un problema? *
                    </label>
                    <select
                      required
                      className="select select-bordered w-full bg-gray-950 border-gray-700 text-white"
                      value={form.a_quien_recurre}
                      onChange={e => setForm({ ...form, a_quien_recurre: e.target.value })}
                    >
                      <option value="">Seleccioná una opción</option>
                      <option>A su tutor o docente</option>
                      <option>A compañeros de estudio</option>
                      <option>A su familia</option>
                      <option>A nadie, intenta resolverlo solo/a</option>
                      <option>A nadie, se rinde y deja la materia</option>
                    </select>
                  </div>

                  {/* Probabilidad de aprobar */}
                  <ScaleInput
                    label="Mirando el próximo mes, ¿qué tan posible ve el alumno aprobar al menos una instancia? (1=imposible, 10=muy seguro) *"
                    value={form.probabilidad_aprobar}
                    onChange={v => setForm({ ...form, probabilidad_aprobar: v })}
                  />
                </div>

                {/* SECCIÓN 2: Observaciones (texto libre, no afectan score) */}
                <div className="bg-gray-800/60 rounded-xl p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    Observaciones <span className="text-gray-500 font-normal normal-case">(no afectan el score)</span>
                  </h4>

                  <div>
                    <label className="label text-sm text-gray-400">
                      Si no pudiera continuar este cuatrimestre, ¿qué estaría haciendo en lugar de estudiar?
                    </label>
                    <textarea
                      className="textarea textarea-bordered w-full bg-gray-950 border-gray-700 text-white"
                      rows={2}
                      placeholder="Ej: Buscaría trabajo, se cambiaría de carrera..."
                      value={form.obs_si_dejara}
                      onChange={e => setForm({ ...form, obs_si_dejara: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label text-sm text-gray-400">
                      ¿Qué mantiene al alumno inscrito en la carrera? ¿Qué lo motiva a seguir?
                    </label>
                    <textarea
                      className="textarea textarea-bordered w-full bg-gray-950 border-gray-700 text-white"
                      rows={2}
                      placeholder="Ej: Su grupo de amigos, la carrera en sí..."
                      value={form.obs_motivacion}
                      onChange={e => setForm({ ...form, obs_motivacion: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label text-sm text-gray-400">
                      Observaciones adicionales
                    </label>
                    <textarea
                      className="textarea textarea-bordered w-full bg-gray-950 border-gray-700 text-white"
                      rows={2}
                      placeholder="Cualquier otra cosa relevante de la entrevista..."
                      value={form.obs_adicionales}
                      onChange={e => setForm({ ...form, obs_adicionales: e.target.value })}
                    />
                  </div>
                </div>

                {/* SECCIÓN 3: Valoración global del tutor */}
                <div className="bg-blue-950/30 border border-blue-900/40 rounded-xl p-4">
                  <ScaleInput
                    label="¿Qué tan en riesgo de abandonar ves a este alumno? (1=sin riesgo, 10=riesgo crítico) *"
                    value={form.valoracion_global}
                    onChange={v => setForm({ ...form, valoracion_global: v })}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Esta valoración tiene el mayor peso en el recálculo del score.
                  </p>
                </div>

                {/* Acciones */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={saving}
                    className="btn btn-ghost text-gray-400"
                    onClick={() => { setModalOpen(false); setSelectedStudent(null); }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !form.probabilidad_aprobar || !form.valoracion_global}
                    className="btn bg-blue-600 border-none text-white hover:bg-blue-700"
                  >
                    {saving
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando...</>
                      : 'Guardar y Recalcular Score'
                    }
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
