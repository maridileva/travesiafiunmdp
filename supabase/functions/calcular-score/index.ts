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

  // Variables donde alojaremos la 'Nota base del 0 al 100' final antes de aplicar los porcentajes
  let scoreAcademicoBruto = 0; 
  let scoreRalentizacionBruto = 0; 
  
  // ============================================================================
  // PASO 4: CÁLCULOS DEL RIESGO - PILAR ACADÉMICO / NOTAS Y RECURSADAS
  // ============================================================================
  // Revisamos todas las materias del recorrido ideal para contar cuantas debería tener aprobadas
  const { data: planMaterias } = await supabase
    .from('plan_estudios')
    .select('anio_teorico, cuatrimestre')
    .eq('carrera_id', estudianteData?.carrera_id || 'dummy');

  if (estudianteData && planMaterias) {
    const currentYear = new Date().getFullYear();
    const isSecondHalf = new Date().getMonth() >= 6;
    const aniosDif = Math.max(0, currentYear - estudianteData.anio_ingreso);
    
    // Calculamos cuantos semestres teóricos pasó el alumno en la universidad (Aprox.)
    const cuatrimestresTranscurridos = Math.max(1, (aniosDif * 2) + (isSecondHalf ? 2 : 1) - 1);
    
    // Contamos cuentas materias tiene el pan hasta el semestre de hoy. Esta es su "Meta".
    const materiasEsperadasCount = planMaterias.filter((m: any) => ((m.anio_teorico - 1) * 2 + m.cuatrimestre) <= cuatrimestresTranscurridos).length;

    // Calculo si debemos castigar al alumno sacando notas por las veces que recurse ó aplace.
    let materiasAprobadasCount = 0;
    let penalizacionAplazos = 0;
    
    if (cursadas && cursadas.length > 0) {
      const aprobadasIds = new Set<string>();
      const maxCursadasPorMateria: Record<string, number> = {};

      cursadas.forEach((c: any) => {
        // Marcamos si promovió o pasó el examen final como materia completada
        if (c.situacion === 'promovio') aprobadasIds.add(c.materia_id);
        if (c.finales && c.finales.some((f: any) => f.resultado === 'aprobado')) {
          aprobadasIds.add(c.materia_id);
        }
        // Registramos cuántas veces ha anotado cursar la misma materia para ver los fallos.
        maxCursadasPorMateria[c.materia_id] = Math.max(maxCursadasPorMateria[c.materia_id] || 0, c.numero_cursada || 1);
      });
      
      materiasAprobadasCount = aprobadasIds.size;
      
      // Aplicar castigo extra al riesgo: +5 pts por segunda vez cursando o +10 pts tras una cuádruple recursión
      Object.values(maxCursadasPorMateria).forEach(numCursadas => {
         if (numCursadas >= 2) penalizacionAplazos += 5;
         if (numCursadas >= 3) penalizacionAplazos += 10;
      });
      // Limitamos el tope para no destruir la barra y ponerle 500 puntos de riesgo a nadie. 
      penalizacionAplazos = Math.min(30, penalizacionAplazos);
    }
    
    // Evaluar que tanto le faltó: 
    let ratioAcademico = 1.0;
    if (materiasEsperadasCount > 0) {
      ratioAcademico = materiasAprobadasCount / materiasEsperadasCount;
    }
    
    let baseAcademico = 0;
    if (ratioAcademico < 1.0) { // Si le va peor a su ideal... suma puntos de riesgo:
       baseAcademico = (1 - ratioAcademico) * 100;
    }
    // Su riesgo Académico va del 0 al 100, y junta materias perdidas + aplazos/recursiones
    scoreAcademicoBruto = Math.min(100, baseAcademico + penalizacionAplazos);
    
    // ============================================================================
    // PASO 5: CÁLCULOS DEL RIESGO - PILAR RALENTIZACIÓN
    // ============================================================================
    // Si bien su historial está siendo mal, queremos saber: ¿Será un descolgado total?
    if (materiasEsperadasCount > 0) {
      // brecha es cuánto del plan de vida se atrasó
      const brecha = (materiasEsperadasCount - materiasAprobadasCount) / materiasEsperadasCount;
      if (brecha <= 0) {
         scoreRalentizacionBruto = 0;
      } else if (brecha <= 0.20) {
         scoreRalentizacionBruto = brecha * 100; // Un retraso leve suma levemente (hasta 20%).
      } else {
         scoreRalentizacionBruto = 20 + ((brecha - 0.20) * 200); // Si es más de un 20% el estudiante necesita salvavidas por ende aceleramos que tan fuerte pega este riesgo.
      }
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
