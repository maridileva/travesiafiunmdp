import { serve } from 'https://deno.land/std/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

serve(async (req) => {
  const { estudiante_id } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: indicadores } = await supabase
    .from('indicadores')
    .select('*, indicador_componentes(*)')
    .eq('activo', true)

  const { data: cursadas } = await supabase
    .from('cursadas')
    .select('*, finales(*)')
    .eq('estudiante_id', estudiante_id)
    .order('created_at', { ascending: false })

  const { data: sesion } = await supabase
    .from('sesiones_encuesta')
    .select('id')
    .eq('estudiante_id', estudiante_id)
    .eq('estado', 'completada')
    .order('completada_at', { ascending: false })
    .limit(1)
    .single()

  const { data: categorias } = await supabase.from('categorias_pregunta').select('*').eq('activa', true) || { data: [] }
  const { data: scoringOps } = await supabase.from('scoring_opciones').select('*') || { data: [] }
  const { data: scoringTramos } = await supabase.from('scoring_tramos').select('*') || { data: [] }

  const { data: respuestas } = sesion
    ? await supabase
        .from('respuestas')
        .select('*, preguntas(peso_defecto, tipo, categoria_id)')
        .eq('sesion_id', sesion.id)
    : { data: [] }

  const { data: estudianteData } = await supabase
    .from('estudiantes')
    .select('anio_ingreso, carrera_id, encuesta_inicial_completada')
    .eq('usuario_id', estudiante_id)
    .single()

  // Score calculation logic with category capping
  let scoreEncuestaTotal = 0;
  const scorePorCategoria: Record<string, number> = {};

  if (respuestas && respuestas.length > 0) {
    respuestas.forEach((resp: any) => {
       const preg = resp.preguntas;
       if (!preg || !preg.categoria_id) return;

       let rScore = 0;
       
       if (preg.tipo === 'unica' || preg.tipo === 'multiple') {
          // If multiple, resp.valor is usually stringified JSON array
          const vals = Array.isArray(resp.valor) ? resp.valor : [resp.valor_texto || resp.valor];
          vals.forEach((v: string) => {
             const opt = scoringOps?.find(so => so.pregunta_id === resp.pregunta_id && so.opcion_valor === v);
             if (opt) rScore += opt.score;
          });
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
                // simple eval replacement
                const formula = matchedTramo.formula.replace(/x/g, String(valNum));
                // safe eval
                rScore = new Function('return ' + formula)();
             } catch(e) { rScore = 0; }
          }
       }

       scorePorCategoria[preg.categoria_id] = (scorePorCategoria[preg.categoria_id] || 0) + rScore;
    });

    // CAPPING RULE
    Object.keys(scorePorCategoria).forEach(catId => {
       const cat = categorias?.find(c => c.id === catId);
       if (cat) {
          const actualScore = scorePorCategoria[catId];
          const finalScore = Math.min(actualScore, cat.score_maximo);
          scoreEncuestaTotal += finalScore;
       }
    });
  }

  // Weights configuration (defaults as per business rules, or from `indicadores` table)
  let pesoAcademico = 0.40;
  let pesoEncuesta = 0.35;
  let pesoRalentizacion = 0.15;
  let pesoAislamiento = 0.10;
  
  if (indicadores) {
     const iAca = indicadores.find((i: any) => i.nombre?.toLowerCase().includes('académico'));
     if (iAca && iAca.peso !== undefined) pesoAcademico = iAca.peso / 100;

     const iEnc = indicadores.find((i: any) => i.nombre?.toLowerCase().includes('encuesta') || i.nombre?.toLowerCase().includes('emocional'));
     if (iEnc && iEnc.peso !== undefined) pesoEncuesta = iEnc.peso / 100;

     const iRal = indicadores.find((i: any) => i.nombre?.toLowerCase().includes('ralentizaci'));
     if (iRal && iRal.peso !== undefined) pesoRalentizacion = iRal.peso / 100;

     const iAis = indicadores.find((i: any) => i.nombre?.toLowerCase().includes('aislamiento'));
     if (iAis && iAis.peso !== undefined) pesoAislamiento = iAis.peso / 100;
  }

  // Calculate component scores (0-100 scales)
  let scoreAcademicoBruto = 0; // Componente 1
  let scoreRalentizacionBruto = 0; // Componente 3
  
  const { data: planMaterias } = await supabase
    .from('plan_estudios')
    .select('anio_teorico, cuatrimestre')
    .eq('carrera_id', estudianteData?.carrera_id || 'dummy');

  if (estudianteData && planMaterias) {
    const currentYear = new Date().getFullYear();
    const isSecondHalf = new Date().getMonth() >= 6;
    const aniosDif = Math.max(0, currentYear - estudianteData.anio_ingreso);
    // Calcular cuatrimestres_transcurridos (approximate based on years difference and current semester)
    const cuatrimestresTranscurridos = Math.max(1, (aniosDif * 2) + (isSecondHalf ? 2 : 1) - 1);
    
    // materias_esperadas = todas las materias del plan hasta el cuatrimestre actual
    const materiasEsperadasCount = planMaterias.filter((m: any) => ((m.anio_teorico - 1) * 2 + m.cuatrimestre) <= cuatrimestresTranscurridos).length;

    // materias_aprobadas y penalización por aplazos
    let materiasAprobadasCount = 0;
    let penalizacionAplazos = 0;
    
    if (cursadas && cursadas.length > 0) {
      const aprobadasIds = new Set<string>();
      const maxCursadasPorMateria: Record<string, number> = {};

      cursadas.forEach((c: any) => {
        if (c.situacion === 'promovio') aprobadasIds.add(c.materia_id);
        if (c.finales && c.finales.some((f: any) => f.resultado === 'aprobado')) {
          aprobadasIds.add(c.materia_id);
        }
        // Save max count of curses per class to calculate aplazos later
        maxCursadasPorMateria[c.materia_id] = Math.max(maxCursadasPorMateria[c.materia_id] || 0, c.numero_cursada || 1);
      });
      
      materiasAprobadasCount = aprobadasIds.size;
      
      // Calculate aplazos penalty
      Object.values(maxCursadasPorMateria).forEach(numCursadas => {
         if (numCursadas >= 2) penalizacionAplazos += 5;
         if (numCursadas >= 3) penalizacionAplazos += 10;
      });
      // Cap at 30 exact penalty points
      penalizacionAplazos = Math.min(30, penalizacionAplazos);
    }
    
    // --- Lógica Académica ---
    let ratioAcademico = 1.0;
    if (materiasEsperadasCount > 0) {
      ratioAcademico = materiasAprobadasCount / materiasEsperadasCount;
    }
    
    let baseAcademico = 0;
    if (ratioAcademico < 1.0) {
       baseAcademico = (1 - ratioAcademico) * 100;
    }
    scoreAcademicoBruto = Math.min(100, baseAcademico + penalizacionAplazos);
    
    // --- Lógica de Ralentización ---
    if (materiasEsperadasCount > 0) {
      const brecha = (materiasEsperadasCount - materiasAprobadasCount) / materiasEsperadasCount;
      if (brecha <= 0) {
         scoreRalentizacionBruto = 0;
      } else if (brecha <= 0.20) {
         scoreRalentizacionBruto = brecha * 100; // proportional
      } else {
         scoreRalentizacionBruto = 20 + ((brecha - 0.20) * 200); // accelerated penalty
      }
      scoreRalentizacionBruto = Math.min(100, Math.max(0, scoreRalentizacionBruto));
    }
  }

  // Componente 4: Aislamiento
  let scoreAislamientoBruto = 0;

  // 1. Sin encuesta en los últimos 60 días
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
  
  // 2. Sin intervención en últimos 90 días
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
  
  // 3. Nunca completó la inicial
  if (estudianteData && !estudianteData.encuesta_inicial_completada) {
     scoreAislamientoBruto += 30;
  }
  
  // 4. Alerta tipo 'perfil_silencioso' pendiente
  const { count: silCount } = await supabase
    .from('alertas')
    .select('id', { count: 'exact', head: true })
    .eq('estudiante_id', estudiante_id)
    .eq('tipo', 'perfil_silencioso')
    .eq('estado', 'pendiente');
    
  if (silCount && silCount > 0) {
     scoreAislamientoBruto += 20;
  }
  
  // Cap at 100
  scoreAislamientoBruto = Math.min(100, scoreAislamientoBruto);

  // Componente 1: Rendimiento académico
  const compAcademico = scoreAcademicoBruto * pesoAcademico;
  
  // Componente 2: Encuestas (Score ya calculado y capeado)
  const compEncuesta = scoreEncuestaTotal * pesoEncuesta;
  
  // Componente 3: Ralentización
  const compRalentizacion = scoreRalentizacionBruto * pesoRalentizacion;
  
  // Componente 4: Aislamiento
  const compAislamiento = scoreAislamientoBruto * pesoAislamiento;

  // Final 0-100 Score
  const scoreTotalCalculado = compAcademico + compEncuesta + compRalentizacion + compAislamiento;
  const scoreTotal = Math.round(Math.min(100, Math.max(0, scoreTotalCalculado)));

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
