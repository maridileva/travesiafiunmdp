import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { validRows } = await req.json()

    if (!validRows || !Array.isArray(validRows)) {
      throw new Error("Payload inválido. Se esperaba un array 'validRows'.")
    }

    let alumnosNuevos = 0
    let alumnosActualizados = 0
    let errores: { fila: any, error: string }[] = []

    for (const row of validRows) {
      try {
        const email = row.email
        const legajo = row.legajo

        // Buscar si ya existe la carrera
        const { data: carreraData, error: carreraError } = await supabaseClient
          .from('carreras')
          .select('id')
          .eq('codigo', row.carrera_codigo)
          .single()

        if (carreraError || !carreraData) {
          throw new Error(`Carrera con código ${row.carrera_codigo} no encontrada.`)
        }

        const carreraId = carreraData.id

        // Buscar si el legajo ya existe
        const { data: usuarioExistente, error: userLookupError } = await supabaseClient
          .from('usuarios')
          .select('id, email')
          .eq('legajo', legajo)
          .maybeSingle()

        if (userLookupError) {
            throw new Error(`Error buscando legajo: ${userLookupError.message}`)
        }

        if (usuarioExistente) {
          // Existe: Actualizamos
          const userId = usuarioExistente.id

          // Update usuarios
          const { error: errorUpdUsuario } = await supabaseClient
            .from('usuarios')
            .update({ nombre: row.nombres, apellido: row.apellido, email: email })
            .eq('id', userId)

          if (errorUpdUsuario) throw new Error(`Error actualizando usuario: ${errorUpdUsuario.message}`)

          // Update estudiantes
          const { error: errorUpdEst } = await supabaseClient
            .from('estudiantes')
            .update({ anio_ingreso: parseInt(row.anio_ingreso), carrera_id: carreraId })
            .eq('usuario_id', userId)

          if (errorUpdEst) throw new Error(`Error actualizando estudiante: ${errorUpdEst.message}`)

          alumnosActualizados++
        } else {
          // No existe: Creamos
          let createdAuthUserId = ""
          
          // Crear en auth as invited if we could. In edge functions with service key, admin.createUser works
          const { data: authData, error: authError } = await supabaseClient.auth.admin.inviteUserByEmail(email, {
             data: { legajo }
          })
          
          if (authError) {
             // maybe user already exists by email but different legajo?
             throw new Error(`Error creando Auth: ${authError.message}`)
          }
          if (authData?.user) {
              createdAuthUserId = authData.user.id
          } else {
              throw new Error("No se pudo obtener el ID de usuario de auth de vuelta.")
          }

          // Insertar en usuarios 
          // Note: the on_auth_user_created trigger might have tried to insert into public.usuarios already
          // The instruction says to insert it here, but typically you do one or the other. We'll do upsert to be safe from trigger conflicts.
          const { error: errorUsrInsert } = await supabaseClient
            .from('usuarios')
            .upsert({ 
                id: createdAuthUserId, 
                nombre: row.nombres, 
                apellido: row.apellido, 
                email: email, 
                legajo: legajo 
            }, { onConflict: 'id' })

          if (errorUsrInsert) throw errorUsrInsert

          // Insertar en estudiantes
          const { error: errorEstInsert } = await supabaseClient
            .from('estudiantes')
            .insert({ 
                usuario_id: createdAuthUserId, 
                carrera_id: carreraId, 
                anio_ingreso: parseInt(row.anio_ingreso),
                encuesta_inicial_completada: false 
            })

          if (errorEstInsert) throw errorEstInsert

          // Insertar en usuario_roles
          const { error: errorRolInsert } = await supabaseClient
            .from('usuario_roles')
            .insert({ 
                usuario_id: createdAuthUserId, 
                rol: 'estudiante', 
                carrera_id: carreraId 
            })

          if (errorRolInsert) throw errorRolInsert

          alumnosNuevos++
        }
      } catch (e: any) {
        errores.push({ fila: row, error: e.message || String(e) })
      }
    }

    return new Response(
      JSON.stringify({ alumnosNuevos, alumnosActualizados, errores }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
