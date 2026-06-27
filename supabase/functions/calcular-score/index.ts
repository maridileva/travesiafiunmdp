import { serve } from 'https://deno.land/std/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

serve(async (req) => {
  const { estudiante_id } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ============================================================================
  // PASO 1: TRAEMOS LA INFORMACIÓN DEL ESTUDIANTE DE LA BASE DE DATOS
  // ============================================================================
  // Buscamos cuánto pesa cada categoría actual (estos valores se editan en el panel)
  const { data: indicadores } = await supabase
    .from('indicadores')
    .select('*, indicador_componentes(*)')
    .eq('activo', true)

  // Historial académico: traemos todas las veces que cursó o rindió finales un estudiante.
  const { data: cursadas } = await supabase
    .from('cursadas')
    .select('*, finales(*)')
    .eq('estudiante_id', estudiante_id)
    .order('created_at', { ascending: false })

  // Traemos su última encuesta de bienestar para analizarla
  const { data: sesion } = await supabase
    .from('sesiones_encuesta')
    .select('id')
    .eq('estudiante_id', estudiante_id)
    .eq('estado', 'completada')
    .order('completada_at', { ascending: false })
    .limit(1)
    .single()

  // Definimos las reglas de puntuación que existen (fórmulas, límites de puntos)
  const { data: categorias } = await supabase.from('categorias_pregunta').select('*').eq('activa', true) || { data: [] }
  const { data: scoringOps } = await supabase.from('scoring_opciones').select('*') || { data: [] }
  const { data: scoringTramos } = await supabase.from('scoring_tramos').select('*') || { data: [] }

  // Buscamos las contestaciones precisas de la encuesta que encontramos
  const { data: respuestas } = sesion
    ? await supabase
        .from('respuestas')
        .select('*, preguntas(peso_defecto, tipo, categoria_id)')
        .eq('sesion_id', sesion.id)
    : { data: [] }

  // Buscamos detalles del perfil del alumno (Año que entró, su carrera, etc.)
  const { data: estudianteData } = await supabase
    .from('estudiantes')
    .select('anio_ingreso, carrera_id, encuesta_inicial_completada')
    .eq('usuario_id', estudiante_id)
    .single()

  // ============================================================================
  // PASO 2: CÁLCULOS DEL RIESGO - PILAR EMOCIONAL (TEST/ENCUESTA)
  // ============================================================================
  // Aquí sumaremos todos los puntos de riesgo si el alumno respondió que tiene problemas.

  let scoreEncuestaTotal = 0;
  const scorePorCategoria: Record<string, number> = {};

  if (respuestas && respuestas.length > 0) {
    respuestas.forEach((resp: any) => {
       const preg = resp.preguntas;
       if (!preg || !preg.categoria_id) return;

       let rScore = 0;
       
       // Si es una pregunta de selección múltiple ("Elegí una opción")
       if (preg.tipo === 'unica' || preg.tipo === 'multiple') {
          // Buscamos si la opción que eligió suma puntaje de riesgo
          const vals = Array.isArray(resp.valor) ? resp.valor : [resp.valor_texto || resp.valor];
          vals.forEach((v: string) => {
             const opt = scoringOps?.find(so => so.pregunta_id === resp.pregunta_id && so.opcion_valor === v);
             if (opt) rScore += opt.score;
          });
       // Si es un número (ej. "Del 1 al 10, ¿Cómo te sentís?") comparamos los rangos.
       } else if (preg.tipo === 'escala' || preg.tipo === 'numerica') {
          const valNum = Number(resp.valor_numerico || resp.valor);
          const tramos = scoringTramos?.filter((st: any) => st.pregunta_id === resp.pregunta_id) || [];
          
          let matchedTramo = null;
          for (const st of tramos) {
             if (st.condicion_tipo === 'menor' && valNum < st.condicion_valor) { matchedTramo = st; break; }
             if (st.condicion_tipo === 'menor_igual' && valNum <= st.condicion_valor) { matchedTramo = st; break; }
             if (st.condicion_tipo === 'mayor' && valNum > st.condicion_valor) { matchedTramo = st; break; }
             if (st.condicion_tipo === 'mayor_igual' && valNum >= st.condicion_valor) { matchedTramo = st; break; }
             if (st.condicion_tipo === 'igual' && valNum === st.condicion_valor) { matchedTramo = st; break; }
             if (st.condicion_tipo === 'entre' && valNum >= st.condicion_valor_min && valNum <= st.condicion_valor_max) { matchedTramo = st; break; }
          }
          
          if (matchedTramo) {
             try {
                const formula = matchedTramo.formula.replace(/x/g, String(valNum));
                rScore = new Function('return ' + formula)();
             } catch(e) { rScore = 0; }
          }
       }

       scorePorCategoria[preg.categoria_id] = (scorePorCategoria[preg.categoria_id] || 0) + rScore;
    });

    // SISTEMA DE TOPE: No dejamos que un estudiante explote el sistema inflando su riesgo de un solo lado.
    // Solo permitimos sumar hasta un límite por categoría.
    Object.keys(scorePorCategoria).forEach(catId => {
       const cat = categorias?.find(c => c.id === catId);
       if (cat) {
          const actualScore = scorePorCategoria[catId];
          const finalScore = Math.min(actualScore, cat.score_maximo);
          scoreEncuestaTotal += finalScore;
       }
    });
  }

  // ============================================================================
  // PASO 3: CONFIGURACIÓN - RECUPERAMOS LOS PORCENTAJES DE CADA PILAR
  // ============================================================================
  // Tomamos cuánto "empuja" cada factor al resultado final (el 100%).
  //
  // SISTEMA FLEXIBLE + NORMALIZACIÓN AUTOMÁTICA:
  // El admin puede cambiar los pesos desde el panel, agregar nuevos indicadores
  // o desactivar alguno. Para que el score siempre sume correctamente,
  // normalizamos los pesos dividiéndolos por la suma total de activos.
  // Ejemplo: si el admin pone 50/30/10/5 (suma 95), los normalizamos a 1.0
  // automáticamente sin que el resultado se vea afectado.

  // Defaults hardcodeados (se usan solo si la BD está vacía)
  let pesoAcademico     = 0.40;
  let pesoEncuesta      = 0.35;
  let pesoRalentizacion = 0.15;
  let pesoAislamiento   = 0.10;

  if (indicadores && indicadores.length > 0) {
    // Solo consideramos los indicadores activos
    const activos = indicadores.filter((i: any) => i.activo !== false);

    // Suma total de pesos activos (puede no ser 100 si el admin los cambió)
    const totalPeso = activos.reduce((sum: number, i: any) => sum + (Number(i.peso) || 0), 0);

    if (totalPeso > 0) {
      // Helper: busca un indicador por palabras clave en su nombre y devuelve
      // su peso ya normalizado (peso / totalPeso). Si no existe, devuelve 0.
      const getPesoNormalizado = (...keywords: string[]): number => {
        const ind = activos.find((i: any) =>
          keywords.some(kw => i.nombre?.toLowerCase().includes(kw))
        );
        return ind ? (Number(ind.peso) / totalPeso) : 0;
      };

      const pA  = getPesoNormalizado('académico', 'rendimiento');
      const pE  = getPesoNormalizado('encuesta', 'emocional', 'bienestar');
      const pR  = getPesoNormalizado('ralentizaci');
      const pAi = getPesoNormalizado('aislamiento');

      // Si encontramos al menos los 4 pilares base, los usamos.
      // Si el admin agregó indicadores nuevos con otros nombres, sus pesos
      // ya están absorbidos en la normalización aunque no los calculemos
      // explícitamente acá (el denominador totalPeso los incluye).
      const sumEncontrados = pA + pE + pR + pAi;
      if (sumEncontrados > 0) {
        pesoAcademico     = pA;
        pesoEncuesta      = pE;
        pesoRalentizacion = pR;
        pesoAislamiento   = pAi;
      }
    }
  }

  // Variables donde alojaremos la 'Nota base del 0 al 100' final antes de aplicar los porcentajes
  let scoreAcademicoBruto = 0;
  let scoreRalentizacionBruto = 0;

  // ============================================================================
  // PASO 4 y 5: PILARES ACADÉMICO Y RALENTIZACIÓN
  // ============================================================================
  // Usamos la función get_resumen_academico que ya considera correlativas.
  // Esto es más preciso que el cálculo manual anterior porque:
  //   - No penaliza al alumno por materias que no puede cursar aún (bloqueadas)
  //   - Detecta materias habilitadas que el alumno eligió no cursar (señal extra)
  //   - El cálculo de cuatrimestres transcurridos vive en la BD, no duplicado acá

  const { data: resumenAcademico } = await supabase
    .rpc('get_resumen_academico', {
      p_estudiante_id: estudiante_id,
      p_carrera_id:    estudianteData?.carrera_id ?? '',
      p_anio_ingreso:  estudianteData?.anio_ingreso ?? new Date().getFullYear()
    })
    .single();

  if (resumenAcademico) {
    const {
      materias_aprobadas,
      materias_esperadas,
      materias_habilitadas_no_cursadas,
      ratio_avance
    } = resumenAcademico;

    // ── PILAR ACADÉMICO ──────────────────────────────────────────────────────
    // Base: qué tan lejos está del ideal (0 = al día, 100 = no aprobó nada)
    const baseAcademico = materias_esperadas > 0
      ? (1 - Number(ratio_avance)) * 100
      : 0;

    // Penalización por recursadas (la info viene de cursadas, igual que antes)
    let penalizacionAplazos = 0;
    if (cursadas && cursadas.length > 0) {
      const maxCursadasPorMateria: Record<string, number> = {};
      cursadas.forEach((c: any) => {
        maxCursadasPorMateria[c.materia_id] = Math.max(
          maxCursadasPorMateria[c.materia_id] || 0,
          c.numero_cursada || 1
        );
      });
      Object.values(maxCursadasPorMateria).forEach(n => {
        if (n >= 2) penalizacionAplazos += 5;
        if (n >= 3) penalizacionAplazos += 10;
      });
      penalizacionAplazos = Math.min(30, penalizacionAplazos);
    }

    scoreAcademicoBruto = Math.min(100, baseAcademico + penalizacionAplazos);

    // ── PILAR RALENTIZACIÓN ──────────────────────────────────────────────────
    // Mide qué tan lejos está del ritmo ideal, con aceleración progresiva.
    // Además suma si tiene materias habilitadas que no arrancó (desmotivación).
    if (materias_esperadas > 0) {
      const brecha = 1 - Number(ratio_avance); // 0 = al día, 1 = no aprobó nada

      if (brecha <= 0) {
        scoreRalentizacionBruto = 0;
      } else if (brecha <= 0.20) {
        // Retraso leve: crece linealmente hasta 20
        scoreRalentizacionBruto = brecha * 100;
      } else {
        // Retraso grave: crece más rápido a partir del 20%
        scoreRalentizacionBruto = 20 + ((brecha - 0.20) * 200);
      }

      // Bonus de riesgo: tiene materias habilitadas pero no las arrancó
      // Cada materia así suma 3 puntos (tope: 15 puntos extra)
      const bonusSinCursar = Math.min(15, (materias_habilitadas_no_cursadas || 0) * 3);
      scoreRalentizacionBruto += bonusSinCursar;

      scoreRalentizacionBruto = Math.min(100, Math.max(0, scoreRalentizacionBruto));
    }
  }

  // ============================================================================
  // PASO 6: CÁLCULOS DEL RIESGO - PILAR AISLAMIENTO O EL ALUMNO "FANTASMA"
  // ============================================================================
  // Alumno ausente y poco reportado = Mayor riesgo
  let scoreAislamientoBruto = 0;

  // Castigo: Si el alumno está desaparecido por +60 días sin contestar ninguna encuesta
  const last60Days = new Date();
  last60Days.setDate(last60Days.getDate() - 60);
  const { count: recientesCount } = await supabase
    .from('sesiones_encuesta')
    .select('id', { count: 'exact', head: true })
    .eq('estudiante_id', estudiante_id)
    .eq('estado', 'completada')
    .gte('completada_at', last60Days.toISOString());
    
  if (recientesCount === 0) {
     scoreAislamientoBruto += 40;
  }
  
  // Castigo: Si ningún equipo directivo o tutor habló con el en los últimos 3 meses (+90 dias)
  const last90Days = new Date();
  last90Days.setDate(last90Days.getDate() - 90);
  const { count: intCount } = await supabase
    .from('intervenciones')
    .select('id', { count: 'exact', head: true })
    .eq('estudiante_id', estudiante_id)
    .gte('created_at', last90Days.toISOString());
    
  if (intCount === 0) {
     scoreAislamientoBruto += 30;
  }
  
  // Castigo: Faltó a su survey inicial
  if (estudianteData && !estudianteData.encuesta_inicial_completada) {
     scoreAislamientoBruto += 30;
  }
  
  // Castigo: Ya habían alertado antes que el perfil parece muerto (silencioso) y no fue atendido
  const { count: silCount } = await supabase
    .from('alertas')
    .select('id', { count: 'exact', head: true })
    .eq('estudiante_id', estudiante_id)
    .eq('tipo', 'perfil_silencioso')
    .eq('estado', 'pendiente');
    
  if (silCount && silCount > 0) {
     scoreAislamientoBruto += 20;
  }
  
  // Como esto se junta, ponemos un tope duro de que el componente llegue solo al "100", no más.
  scoreAislamientoBruto = Math.min(100, scoreAislamientoBruto);

  // ============================================================================
  // RESÚMEN FINAL: APLICAMOS PORCENTAJE DEL TABLERO A LOS RESULTADOS FINALES DE LOS PILARES
  // ============================================================================

  // Sumando su "Rendimiento"
  const compAcademico = scoreAcademicoBruto * pesoAcademico;
  
  // Sumando "Encuesta Emocional"
  const compEncuesta = scoreEncuestaTotal * pesoEncuesta;
  
  // Sumando Riesgo de la lentitud a graduarse
  const compRalentizacion = scoreRalentizacionBruto * pesoRalentizacion;
  
  // Sumando Desaparición fantasma
  const compAislamiento = scoreAislamientoBruto * pesoAislamiento;

  // Calculo de Calificación general y nivel a guardar
  const scoreTotalCalculado = compAcademico + compEncuesta + compRalentizacion + compAislamiento;
  const scoreTotal = Math.round(Math.min(100, Math.max(0, scoreTotalCalculado)));

  // Escala fija en el negocio 
  const nivel =
    scoreTotal <= 30 ? 'bajo'
    : scoreTotal <= 55 ? 'medio'
    : scoreTotal <= 80 ? 'alto'
    : 'critico'

  await supabase.from('scores').insert({
    estudiante_id,
    valor: scoreTotal,
    nivel_riesgo: nivel,
    componentes: {},
    calculado_at: new Date().toISOString()
  })

  if (nivel === 'alto' || nivel === 'critico') {
    await supabase.from('alertas').insert({
      estudiante_id,
      tipo: 'score_critico',
      origen: 'automatica',
      estado: 'pendiente'
    })
  }

  return new Response(JSON.stringify({ score: scoreTotal, nivel }), {
    headers: { 'Content-Type': 'application/json' }
  })
})