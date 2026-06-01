import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    const { encuestaId, secciones } = payload;
    
    for (const [sIndex, sec] of secciones.entries()) {
      let sid = sec.id;
      if (sec.isNew) {
        const { data: newSec, error: errSec } = await supabaseClient
          .from('encuesta_secciones')
          .insert({
            encuesta_id: encuestaId,
            titulo: sec.titulo,
            orden: sIndex + 1
          })
          .select()
          .single();
        
        if (errSec) throw errSec;
        sid = newSec.id;
      } else {
        await supabaseClient
          .from('encuesta_secciones')
          .update({ titulo: sec.titulo, orden: sIndex + 1 })
          .eq('id', sec.id);
      }

      const localPregs = sec.preguntas;
      const currentPregIds = localPregs.filter((p:any) => !p.isNew).map((p:any) => p.id);
      
      if (!sec.isNew) {
         const { data: dbPregs } = await supabaseClient.from('preguntas').select('id').eq('seccion_id', sid);
         const dbIds = (dbPregs || []).map((p:any) => p.id);
         const toDelete = dbIds.filter((id: string) => !currentPregIds.includes(id));
         
         if (toDelete.length > 0) {
           await supabaseClient.from('preguntas').delete().in('id', toDelete);
         }
      }

      for (const [pIndex, preg] of localPregs.entries()) {
        const payloadPreg = {
          seccion_id: sid,
          texto: preg.texto,
          tipo: preg.tipo,
          opciones: preg.opciones,
          es_obligatoria: preg.es_obligatoria,
          orden: pIndex + 1,
          categoria_id: preg.categoria_id || null,
          valor_minimo: preg.valor_minimo || null,
          valor_maximo: preg.valor_maximo || null,
          unidad: preg.unidad || null
        };

        let pid = preg.id;
        if (preg.isNew) {
          const { data: newP, error: errP } = await supabaseClient.from('preguntas').insert(payloadPreg).select().single();
          if (errP) throw errP;
          pid = newP.id;
        } else {
          const { error: errP } = await supabaseClient.from('preguntas').update(payloadPreg).eq('id', pid);
          if (errP) throw errP;
        }

        // Handle scoring_opciones
        if (preg.scoringOpciones && preg.scoringOpciones.length > 0) {
          await supabaseClient.from('scoring_opciones').delete().eq('pregunta_id', pid);
          const soPayload = preg.scoringOpciones.map((so: any) => ({
            pregunta_id: pid,
            opcion_valor: so.opcion_valor,
            score: so.score
          }));
          await supabaseClient.from('scoring_opciones').insert(soPayload);
        } else {
           await supabaseClient.from('scoring_opciones').delete().eq('pregunta_id', pid);
        }

        // Handle scoring_tramos
        if (preg.scoringTramos && preg.scoringTramos.length > 0) {
          await supabaseClient.from('scoring_tramos').delete().eq('pregunta_id', pid);
          const stPayload = preg.scoringTramos.map((st: any, idx: number) => ({
            pregunta_id: pid,
            orden: idx + 1,
            condicion_tipo: st.condicion_tipo,
            condicion_valor: st.condicion_valor,
            condicion_valor_min: st.condicion_valor_min,
            condicion_valor_max: st.condicion_valor_max,
            formula: st.formula
          }));
          await supabaseClient.from('scoring_tramos').insert(stPayload);
        } else {
           await supabaseClient.from('scoring_tramos').delete().eq('pregunta_id', pid);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
