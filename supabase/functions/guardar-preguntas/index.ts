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
        const payloadPreg: any = {
          seccion_id: sid,
          texto: preg.texto,
          tipo: preg.tipo,
          opciones: preg.opciones,
          es_obligatoria: preg.es_obligatoria ?? true,
          orden: pIndex + 1,
        };
        
        if (preg.valor_minimo !== undefined) payloadPreg.valor_minimo = preg.valor_minimo;
        if (preg.valor_maximo !== undefined) payloadPreg.valor_maximo = preg.valor_maximo;

        let pid = preg.id;
        if (preg.isNew) {
          const { data: newP, error: errP } = await supabaseClient.from('preguntas').insert(payloadPreg).select().single();
          if (errP) throw errP;
          pid = newP.id;
        } else {
          const { error: errP } = await supabaseClient.from('preguntas').update(payloadPreg).eq('id', pid);
          if (errP) throw errP;
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message, details: error }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
