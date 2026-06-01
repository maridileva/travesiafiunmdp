# Planning – Fase 2: Integración Real con Supabase
**Proyecto Travesía | Puerto Byte**
Sistema de Seguimiento de Alumnos en Riesgo de Deserción

> Este documento es continuación de `planning.md` (Fase 1 — Prototipo MVP).
> La Fase 1 valida flujos y lógica de negocio con datos mock.
> La Fase 2 conecta ese prototipo validado a un backend real con Supabase.
>
> **Este documento es la fuente de verdad para el modelo de IA.**
> Ante cualquier decisión de implementación no cubierta aquí,
> el modelo DEBE preguntar antes de decidir arbitrariamente.

---

## 1. Objetivo de la Fase 2

Reemplazar todos los datos mock (JSON estático / localStorage) del MVP por
llamadas reales a Supabase, manteniendo **exactamente la misma interfaz visual
y lógica de negocio** ya validada en Fase 1. El criterio de éxito es que el
usuario no perciba ningún cambio en la UI — solo que los datos ahora persisten
y son multiusuario reales.

**Lo que NO cambia en Fase 2:**
- La UI, el diseño visual, los componentes React
- La lógica de semáforo y niveles de riesgo
- Las reglas de negocio de ralentización y perfil silencioso
- La estructura de encuestas (preguntas, secciones, orden)
- El FloatingDock y la navegación por rol

**Lo que SÍ cambia en Fase 2:**
- Toda fuente de datos pasa de mock/localStorage a Supabase
- La autenticación pasa de selector manual a Supabase Auth
- El score se calcula en una Edge Function, no en el frontend
- Las alertas son en tiempo real via Supabase Realtime

---

## 2. Prerequisitos antes de empezar

- [ ] Proyecto de Supabase creado en [supabase.com](https://supabase.com)
- [ ] Schema de base de datos aplicado (`base_de_datos.sql` del proyecto)
- [ ] Variables de entorno configuradas en el proyecto React
- [ ] Al menos un usuario admin creado manualmente en Supabase Auth
- [ ] RLS habilitado en todas las tablas sensibles (ya definido en el SQL)
- [ ] Plan de estudios de Ingeniería Industrial cargado por el admin antes
      de que cualquier estudiante use el sistema

---

## 3. Variables de Entorno

Crear archivo `.env.local` en la raíz del proyecto React:

```env
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<tu-anon-key>
```

> ⚠️ Nunca commitear `.env.local`. Agregar al `.gitignore` antes de cualquier push.
> La `ANON_KEY` es pública por diseño (RLS la protege), pero la `SERVICE_ROLE_KEY`
> nunca debe estar en el frontend — solo en Edge Functions.

---

## 4. Instalación del Cliente Supabase

```bash
npm install @supabase/supabase-js
```

**Inicialización del cliente** — crear `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
```

Este cliente se importa en todos los hooks y servicios.
**Nunca instanciar más de una vez (singleton).**
**Nunca crear un segundo cliente con SERVICE_ROLE_KEY en el frontend.**

---

## 5. Estrategia de Migración: Mock → Supabase

La migración se hace **módulo por módulo**, en el orden definido en la
sección 10. Cada módulo tiene su propio servicio en `src/services/` que
reemplaza el JSON mock correspondiente. La UI **no se toca** — solo cambia
la fuente de datos.

### Patrón de reemplazo estándar

```ts
// ANTES (mock — Fase 1)
import { estudiantesMock } from '@/data/mock'
const estudiantes = estudiantesMock

// DESPUÉS (Supabase — Fase 2)
import { getEstudiantes } from '@/services/estudiantesService'
const { data: estudiantes, error } = await getEstudiantes()
```

### Patrón de hook estándar (aplicar en TODOS los hooks sin excepción)

```ts
const [data, setData]       = useState(null)
const [loading, setLoading] = useState(true)
const [error, setError]     = useState<string | null>(null)

useEffect(() => {
  const fetchData = async () => {
    try {
      const { data, error } = await miServicio()
      if (error) throw error
      setData(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  fetchData()
}, [])

// En el JSX:
if (loading) return <div className="skeleton h-32 w-full" />
if (error)   return <div className="alert alert-error">{error}</div>
```

---

## 6. Decisiones de Diseño Fijas (no negociables)

Estas decisiones fueron tomadas en conjunto por el equipo y **no deben
ser reinterpretadas por el modelo**:

### 6.1 Quién carga qué materias está cursando el alumno

**Decisión: el estudiante selecciona sus materias en la encuesta cuatrimestral.**

- El sistema muestra únicamente las materias habilitadas para ese estudiante
  según sus correlativas aprobadas (función RPC `get_materias_habilitadas`)
- El estudiante NO escribe texto libre — elige de una lista controlada
  proveniente del plan de estudios cargado por el admin
- Todas las materias seleccionadas y datos asociados se guardan con
  `es_confiable = false` en las tablas `cursadas` y `finales`
- En Fase 3 (integración SIU), los datos importados pisarán los
  auto-reportados y el flag pasará a `es_confiable = true`
- **El sistema nunca bloquea al estudiante** esperando datos del admin —
  si no hay importación, el flujo funciona igual con datos del estudiante

### 6.2 Qué notas carga el estudiante

El estudiante carga exactamente estos datos por cada materia que cursó:

| Dato | Tabla destino | Campo | Confiable |
|------|--------------|-------|-----------|
| Situación final (promovió / habilitó / desaprobó / abandonó) | `cursadas` | `situacion` | false |
| Nota de cursada (si promovió o habilitó) | `cursadas` | `nota_cursada` | false |
| ¿Rindió el final? (sí/no) | `finales` | (crea registro) | false |
| Nota del final | `finales` | `nota` | false |
| Resultado del final (aprobó / desaprobó / ausente) | `finales` | `resultado` | false |
| Número de intento de final | `finales` | `numero_intento` | false |

**El estudiante NO carga:**
- Notas de parciales individuales (demasiada granularidad para el MVP)
- Notas de recuperatorios por separado (se considera parte del resultado final)

**El número de intento** se calcula automáticamente contando los registros
existentes en `finales` para ese estudiante y materia:
```ts
const numeroIntento = (intentosPrevios.length ?? 0) + 1
```

### 6.3 Confiabilidad de datos

- Todo dato ingresado por el estudiante: `es_confiable = false`
- Todo dato importado desde archivo XLS/CSV por admin: `es_confiable = true`
- Si hay contradicción entre ambos: el dato importado tiene prioridad,
  el auto-reportado se conserva en un campo `valor_original_alumno` para
  auditoría, y el flag pasa a `es_confiable = true`
- El tutor siempre ve un indicador visual (⚠️) cuando un dato es no confiable
- El estudiante nunca ve el flag de confiabilidad — es transparente para él

### 6.4 Score y semáforo

- El score numérico (0-100) **nunca se muestra al estudiante**
- Al estudiante solo se le muestra el nivel semafórico y un mensaje motivacional
- El score SÍ se muestra al tutor, docente y admin con su valor numérico exacto
- El score se recalcula automáticamente al:
  1. Completar una encuesta (cuatrimestral o inicial)
  2. Ser solicitado manualmente por el admin desde el panel
- El recálculo se hace siempre en la Edge Function `calcular-score`,
  nunca en el frontend
- Pesos por defecto (configurables por admin):
  - Rendimiento académico: 40%
  - Encuesta emocional/motivacional: 35%
  - Ralentización: 15%
  - Aislamiento: 10%

### 6.5 Ralentización

Se calcula comparando materias aprobadas del alumno vs. materias esperadas
según su año de ingreso y el plan de estudios:

```
brecha = (materias_esperadas_al_año_actual - materias_aprobadas) / materias_esperadas_al_año_actual
si brecha > 0.20 → alerta tipo 'ralentizacion'
```

- "Materias esperadas" = suma de materias del plan hasta el cuatrimestre
  actual, contando desde el año de ingreso del estudiante
- El cálculo de ralentización es responsabilidad de la Edge Function,
  no del frontend
- Si un alumno tiene cambio de plan de estudios registrado, su score
  queda bloqueado hasta que se registre una intervención obligatoria

### 6.6 Perfil silencioso

Un alumno es perfil silencioso si cumple las TRES condiciones:
1. Tiene nivel de riesgo medio, alto o crítico
2. No completó ninguna encuesta en los últimos 60 días
3. No tiene intervención registrada en los últimos 60 días

La detección corre en la Edge Function `detectar-perfil-silencioso`
cada lunes a las 9am (cron job). No se calcula en tiempo real en el frontend.

### 6.7 Alertas

Tipos de alerta y quién las genera:

| Tipo | Origen | Generada por |
|------|--------|-------------|
| `score_critico` | automática | Edge Function calcular-score |
| `perfil_silencioso` | automática | Edge Function detectar-perfil-silencioso (cron) |
| `encuesta_omitida` | automática | Edge Function detectar-perfil-silencioso (cron) |
| `ralentizacion` | automática | Edge Function calcular-score |
| `solicitud_ayuda` | solicitud_alumno | Estudiante presiona "Pedir ayuda" |
| `cambio_plan` | automática | Al registrar cambio de plan de estudios |

Las alertas del tutor se actualizan en tiempo real via Supabase Realtime
(Postgres Changes en tabla `alertas`). No requieren recarga de página.

### 6.8 Encuesta cuatrimestral — flujo exacto

1. El sistema verifica que el estudiante completó la encuesta inicial.
   Si no la completó, lo redirige a completarla primero.
2. El sistema crea una `sesion_encuesta` con estado `en_progreso`.
3. Se muestran las secciones en orden (definido en `encuesta_secciones.orden`).
4. En la sección de materias:
   a. Se llama a `get_materias_habilitadas` para obtener la lista filtrada
   b. El estudiante marca cuáles cursó este cuatrimestre (checkbox múltiple)
   c. Por cada materia marcada, aparecen las preguntas dinámicas en orden:
      - ¿Cuál fue tu situación? (promovió / habilitó / desaprobó / abandonó)
      - Si promovió o habilitó → ¿Cuál fue tu nota de cursada? (1-10)
      - Si habilitó → ¿Rendiste el final? (sí/no)
      - Si rindió final → ¿Cuál fue tu nota? (1-10) y resultado
      - ¿Cómo te sentiste cursando esta materia? (texto libre)
      - ¿Cuál fue tu principal dificultad? (opción múltiple)
      - ¿Cómo calificarías tu dedicación? (escala)
      - ¿Cómo describirías tu ritmo de estudio? (opción única)
5. Cada respuesta se guarda en `respuestas` al avanzar (no al final).
   Esto permite retomar si se cierra la app.
6. Al finalizar → se marca la sesión como `completada` → se invoca
   la Edge Function `calcular-score` → se actualiza el semáforo en la UI.

### 6.9 Navegación por rol

Regla fija — no modificar:

| Rol | Desktop | Mobile |
|-----|---------|--------|
| `estudiante` | FloatingDock | DaisyUI btm-nav |
| `tutor` | FloatingDock | DaisyUI btm-nav |
| `asesor_par` | FloatingDock | DaisyUI btm-nav |
| `docente` | FloatingDock | DaisyUI btm-nav |
| `admin` | DaisyUI drawer sidebar | DaisyUI btm-nav |

---

## 7. Módulos de Migración

### 7.1 Autenticación — `src/services/authService.ts`

**Qué reemplaza:** selector de rol manual del MVP.

```ts
import { supabase } from '@/lib/supabase'

export const signIn = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({ email, password })
}

export const signOut = async () => {
  return await supabase.auth.signOut()
}

export const getSession = async () => {
  return await supabase.auth.getSession()
}

// El rol se lee SIEMPRE de usuario_roles, nunca de metadata de Auth
export const getRolUsuario = async (userId: string) => {
  return await supabase
    .from('usuario_roles')
    .select('rol, carrera_id')
    .eq('usuario_id', userId)
    .eq('activo', true)
    .single()
}
```

**Hook React** — `src/hooks/useAuth.ts`:

```ts
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getRolUsuario } from '@/services/authService'

export const useAuth = () => {
  const [usuario, setUsuario]   = useState(null)
  const [rol, setRol]           = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUsuario(session.user)
        const { data } = await getRolUsuario(session.user.id)
        setRol(data?.rol ?? null)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUsuario(session?.user ?? null)
        if (session?.user) {
          const { data } = await getRolUsuario(session.user.id)
          setRol(data?.rol ?? null)
        } else {
          setRol(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { usuario, rol, loading }
}
```

**Routing:** reemplazar el selector de rol manual por `<Navigate>`
basado en el `rol` que devuelve `useAuth`. Si `rol` es null y no está
cargando, redirigir al login.

---

### 7.2 Estudiantes — `src/services/estudiantesService.ts`

```ts
import { supabase } from '@/lib/supabase'

// Para tutor/asesor_par: solo sus alumnos asignados
export const getEstudiantesDelTutor = async (tutorId: string) => {
  return await supabase
    .from('asignaciones_tutor')
    .select(`
      estudiante_id,
      usuarios!estudiante_id (
        id, nombre, apellido, email, legajo
      ),
      estudiantes!estudiante_id (
        carrera_id, anio_ingreso
      )
    `)
    .eq('tutor_id', tutorId)
    .eq('activa', true)
}

// Para docente/admin: todos los estudiantes de la carrera
export const getEstudiantesPorCarrera = async (carreraId: string) => {
  return await supabase
    .from('estudiantes')
    .select(`
      usuario_id, anio_ingreso, carrera_id,
      usuarios!usuario_id (id, nombre, apellido, email, legajo)
    `)
    .eq('carrera_id', carreraId)
}

// Perfil completo de un estudiante (para tutor/admin)
// Incluye último score, historial de cursadas e intervenciones
export const getPerfilEstudiante = async (estudianteId: string) => {
  return await supabase
    .from('usuarios')
    .select(`
      id, nombre, apellido, email, legajo,
      estudiantes (
        carrera_id, anio_ingreso,
        encuesta_inicial_completada
      )
    `)
    .eq('id', estudianteId)
    .single()
}

// Perfil del estudiante autenticado (para su propio dashboard)
export const getMiPerfil = async (userId: string) => {
  return await supabase
    .from('usuarios')
    .select('id, nombre, apellido, email, legajo, estudiantes(*)')
    .eq('id', userId)
    .single()
}
```

---

### 7.3 Scores — `src/services/scoresService.ts`

```ts
import { supabase } from '@/lib/supabase'

// Último score calculado de un estudiante
export const getUltimoScore = async (estudianteId: string) => {
  return await supabase
    .from('scores')
    .select('valor, nivel_riesgo, calculado_at, componentes')
    .eq('estudiante_id', estudianteId)
    .order('calculado_at', { ascending: false })
    .limit(1)
    .single()
}

// Historial de scores para el gráfico de evolución (LineChart)
export const getHistorialScores = async (estudianteId: string) => {
  return await supabase
    .from('scores')
    .select('valor, nivel_riesgo, calculado_at, cuatrimestre, anio')
    .eq('estudiante_id', estudianteId)
    .order('calculado_at', { ascending: true })
}

// Distribución de niveles en la cohorte para PieChart (admin/docente)
// Se agrupa en el frontend contando por nivel_riesgo
export const getDistribucionCohorte = async (carreraId: string) => {
  return await supabase
    .from('scores')
    .select(`
      nivel_riesgo,
      estudiantes!inner (carrera_id)
    `)
    .eq('estudiantes.carrera_id', carreraId)
    // Filtrar solo el score más reciente por estudiante en el frontend
}

// Solicitar recálculo manual (solo admin)
export const recalcularScore = async (estudianteId: string) => {
  return await supabase.functions.invoke('calcular-score', {
    body: { estudiante_id: estudianteId }
  })
}
```

**Regla de visualización del score:**
- Rol `estudiante`: mostrar SOLO `nivel_riesgo` con badge DaisyUI y mensaje motivacional. **Nunca mostrar `valor` numérico.**
- Rol `tutor`, `asesor_par`, `docente`, `admin`: mostrar `valor` numérico y `nivel_riesgo`.

---

### 7.4 Encuestas — `src/services/encuestasService.ts`

```ts
import { supabase } from '@/lib/supabase'

// Cargar estructura completa de una encuesta con secciones y preguntas
// Las preguntas vienen ordenadas por seccion.orden y pregunta.orden
export const getEncuestaActiva = async (
  tipo: 'inicial' | 'cuatrimestral' | 'entrevista'
) => {
  return await supabase
    .from('encuestas')
    .select(`
      id, titulo, descripcion, tipo,
      encuesta_secciones (
        id, titulo, descripcion, orden,
        preguntas (
          id, texto, tipo, orden, obligatoria,
          opciones, escala_min, escala_max,
          aplica_por_materia, peso_defecto
        )
      )
    `)
    .eq('tipo', tipo)
    .eq('activa', true)
    .order('orden', { referencedTable: 'encuesta_secciones' })
    .order('orden', { referencedTable: 'encuesta_secciones.preguntas' })
    .single()
}

// Verificar si el estudiante ya completó la encuesta inicial
// Si no la completó, debe completarla antes de la cuatrimestral
export const verificarEncuestaInicial = async (estudianteId: string) => {
  const { data } = await supabase
    .from('estudiantes')
    .select('encuesta_inicial_completada')
    .eq('usuario_id', estudianteId)
    .single()
  return data?.encuesta_inicial_completada ?? false
}

// Verificar si ya existe sesión para este cuatrimestre/año
// Evita que el estudiante complete la misma encuesta dos veces
export const getSesionExistente = async (
  encuestaId: string,
  estudianteId: string,
  cuatrimestre: number,
  anio: number
) => {
  return await supabase
    .from('sesiones_encuesta')
    .select('id, estado')
    .eq('encuesta_id', encuestaId)
    .eq('estudiante_id', estudianteId)
    .eq('cuatrimestre', cuatrimestre)
    .eq('anio', anio)
    .maybeSingle()
}

// Crear sesión nueva
export const crearSesionEncuesta = async (
  encuestaId: string,
  estudianteId: string,
  cuatrimestre: number,
  anio: number
) => {
  return await supabase
    .from('sesiones_encuesta')
    .insert({
      encuesta_id:   encuestaId,
      estudiante_id: estudianteId,
      cuatrimestre,
      anio,
      estado:        'en_progreso',
      iniciada_at:   new Date().toISOString()
    })
    .select()
    .single()
}

// Guardar una respuesta individual
// Se llama al avanzar cada pregunta para permitir retomar si se cierra la app
// materiaId es null para preguntas generales, uuid para preguntas por materia
export const guardarRespuesta = async (
  sesionId:   string,
  preguntaId: string,
  valor:      string,
  materiaId?: string
) => {
  return await supabase
    .from('respuestas')
    .upsert({
      sesion_id:    sesionId,
      pregunta_id:  preguntaId,
      materia_id:   materiaId ?? null,
      valor,
      es_confiable: false  // SIEMPRE false para datos auto-reportados
    }, {
      onConflict: 'sesion_id,pregunta_id,materia_id'
    })
}

// Guardar datos de cursada por materia
// Se crea un registro en 'cursadas' por cada materia que el estudiante marcó
export const guardarCursada = async (cursada: {
  estudiante_id:   string
  materia_id:      string
  cuatrimestre:    number
  anio:            number
  situacion:       'promovio' | 'habilito' | 'desaprobo' | 'abandono'
  nota_cursada?:   number   // solo si promovió o habilitó, rango 1-10
  como_se_sintio?: string
  dificultades?:   string[]
  dedicacion?:     string
  ritmo_estudio?:  string
  tiene_materiales?: boolean
}) => {
  // Calcular número de cursada (contador de veces que cursó esta materia)
  const { count } = await supabase
    .from('cursadas')
    .select('id', { count: 'exact', head: true })
    .eq('estudiante_id', cursada.estudiante_id)
    .eq('materia_id', cursada.materia_id)

  return await supabase
    .from('cursadas')
    .insert({
      ...cursada,
      numero_cursada: (count ?? 0) + 1,
      es_confiable:   false  // SIEMPRE false para datos auto-reportados
    })
    .select()
    .single()
}

// Guardar intento de final
// Solo se crea si el estudiante indicó que rindió el final
export const guardarFinal = async (final: {
  cursada_id:    string
  estudiante_id: string
  materia_id:    string
  nota?:         number   // rango 1-10, null si ausente
  resultado:     'aprobado' | 'desaprobado' | 'ausente'
  fecha_intento?: string
}) => {
  // Calcular número de intento de final
  const { count } = await supabase
    .from('finales')
    .select('id', { count: 'exact', head: true })
    .eq('estudiante_id', final.estudiante_id)
    .eq('materia_id', final.materia_id)

  return await supabase
    .from('finales')
    .insert({
      ...final,
      numero_intento: (count ?? 0) + 1,
      es_confiable:   false  // SIEMPRE false para datos auto-reportados
    })
}

// Marcar encuesta como completada y disparar recálculo de score
// Este es el último paso del flujo de encuesta
export const completarEncuesta = async (
  sesionId:      string,
  estudianteId:  string,
  esInicial:     boolean
) => {
  // 1. Marcar sesión como completada
  await supabase
    .from('sesiones_encuesta')
    .update({
      estado:        'completada',
      completada_at: new Date().toISOString()
    })
    .eq('id', sesionId)

  // 2. Si es encuesta inicial, actualizar flag en tabla estudiantes
  if (esInicial) {
    await supabase
      .from('estudiantes')
      .update({ encuesta_inicial_completada: true })
      .eq('usuario_id', estudianteId)
  }

  // 3. Disparar recálculo de score via Edge Function
  return await supabase.functions.invoke('calcular-score', {
    body: { estudiante_id: estudianteId }
  })
}
```

---

### 7.5 Plan de Estudios — `src/services/planService.ts`

```ts
import { supabase } from '@/lib/supabase'

// Plan de estudios completo de una carrera (para admin y vista de progreso)
export const getPlanEstudios = async (carreraId: string) => {
  return await supabase
    .from('plan_estudios')
    .select(`
      anio_teorico, cuatrimestre, tipo, es_critica,
      materias (id, nombre, codigo, creditos)
    `)
    .eq('carrera_id', carreraId)
    .order('anio_teorico')
    .order('cuatrimestre')
}

// Progreso del estudiante enfrentado al plan de estudios
// Estados posibles: 'aprobada' | 'final_pendiente' | 'cursando' | 'no_cursada' | 'recursando'
export const getProgresoEstudiante = async (estudianteId: string) => {
  return await supabase
    .from('progreso_estudiante')
    .select(`
      estado, nota_final, updated_at,
      materias (id, nombre, codigo)
    `)
    .eq('estudiante_id', estudianteId)
}

// Materias que el estudiante puede cursar según correlativas aprobadas
// Esta función RPC filtra materias no aprobadas con todas sus correlativas cumplidas
// Se usa para poblar la lista de selección en la encuesta cuatrimestral
export const getMateriasHabilitadas = async (
  estudianteId: string,
  carreraId:    string
) => {
  return await supabase.rpc('get_materias_habilitadas', {
    p_estudiante_id: estudianteId,
    p_carrera_id:    carreraId
  })
}

// Cargar o editar materia del plan (solo admin)
// Crea la materia si no existe, la actualiza si ya existe (upsert por código)
export const upsertMateriaPlan = async (materia: {
  carrera_id:   string
  nombre:       string
  codigo:       string
  anio_teorico: number
  cuatrimestre: number
  tipo:         string
  es_critica:   boolean
}) => {
  // Paso 1: upsert en tabla materias
  const { data: mat, error: matError } = await supabase
    .from('materias')
    .upsert(
      { nombre: materia.nombre, codigo: materia.codigo, carrera_id: materia.carrera_id },
      { onConflict: 'carrera_id,codigo' }
    )
    .select('id')
    .single()

  if (matError) return { error: matError }

  // Paso 2: upsert en plan_estudios
  return await supabase
    .from('plan_estudios')
    .upsert({
      carrera_id:   materia.carrera_id,
      materia_id:   mat!.id,
      anio_teorico: materia.anio_teorico,
      cuatrimestre: materia.cuatrimestre,
      tipo:         materia.tipo,
      es_critica:   materia.es_critica
    }, {
      onConflict: 'carrera_id,materia_id'
    })
}

// Cargar correlativas de una materia (para admin)
export const getCorrelativas = async (materiaId: string) => {
  return await supabase
    .from('correlativas')
    .select(`
      tipo,
      materias!materia_requerida_id (id, nombre, codigo)
    `)
    .eq('materia_id', materiaId)
}

// Guardar correlativas (solo admin)
// Reemplaza todas las correlativas existentes de la materia
export const setCorrelativas = async (
  materiaId:  string,
  correlativas: { materia_requerida_id: string; tipo: 'aprobada' | 'cursada' }[]
) => {
  // Borrar correlativas anteriores
  await supabase.from('correlativas').delete().eq('materia_id', materiaId)

  // Insertar nuevas
  if (correlativas.length === 0) return { error: null }
  return await supabase.from('correlativas').insert(
    correlativas.map(c => ({ materia_id: materiaId, ...c }))
  )
}
```

---

### 7.6 Alertas — `src/services/alertasService.ts`

```ts
import { supabase } from '@/lib/supabase'

// Alertas pendientes del tutor autenticado, ordenadas por más reciente
export const getAlertasPendientes = async (tutorId: string) => {
  return await supabase
    .from('alertas')
    .select(`
      id, tipo, descripcion, created_at, origen,
      usuarios!estudiante_id (id, nombre, apellido, legajo)
    `)
    .eq('tutor_id', tutorId)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false })
}

// Crear alerta manual cuando el estudiante presiona "Pedir ayuda"
// El sistema debe asignar automáticamente el tutor del estudiante
export const crearAlertaAyuda = async (estudianteId: string) => {
  // Obtener tutor asignado
  const { data: asignacion } = await supabase
    .from('asignaciones_tutor')
    .select('tutor_id')
    .eq('estudiante_id', estudianteId)
    .eq('activa', true)
    .single()

  return await supabase
    .from('alertas')
    .insert({
      estudiante_id: estudianteId,
      tutor_id:      asignacion?.tutor_id ?? null,
      tipo:          'solicitud_ayuda',
      origen:        'solicitud_alumno',
      estado:        'pendiente'
    })
}

// Resolver alerta (tutor marca como resuelta)
export const resolverAlerta = async (alertaId: string, resueltaPor: string) => {
  return await supabase
    .from('alertas')
    .update({
      estado:       'resuelta',
      resuelta_at:  new Date().toISOString(),
      resuelta_por: resueltaPor
    })
    .eq('id', alertaId)
}
```

**Hook con Realtime** — `src/hooks/useAlertas.ts`:

```ts
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getAlertasPendientes } from '@/services/alertasService'

export const useAlertas = (tutorId: string) => {
  const [alertas, setAlertas]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    // Carga inicial
    getAlertasPendientes(tutorId)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setAlertas(data ?? [])
        setLoading(false)
      })

    // Suscripción realtime — nuevas alertas aparecen sin recargar
    const channel = supabase
      .channel(`alertas-tutor-${tutorId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'alertas',
        filter: `tutor_id=eq.${tutorId}`
      }, (payload) => {
        setAlertas(prev => [payload.new as any, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tutorId])

  return { alertas, loading, error }
}
```

---

### 7.7 Intervenciones — `src/services/intervencionesService.ts`

```ts
import { supabase } from '@/lib/supabase'

// Registrar nueva intervención (tutor/asesor_par/docente)
export const crearIntervencion = async (intervencion: {
  estudiante_id:   string
  tutor_id:        string
  tipo:            'entrevista' | 'contacto_email' | 'contacto_telefono' | 'reunion_grupal'
  modalidad:       'presencial' | 'virtual' | 'telefonica'
  fecha_realizada: string
  motivo:          string
  resumen:         string
  compromisos:     string
  proxima_accion:  string
}) => {
  return await supabase
    .from('intervenciones')
    .insert({ ...intervencion, estado: 'realizada' })
    .select()
    .single()
}

// Registrar datos adicionales de entrevista formal
// Solo cuando tipo === 'entrevista'
export const crearEntrevista = async (entrevista: {
  intervencion_id:         string
  motivo_entrevista:       string
  estado_alumno_percibido: 'bien' | 'regular' | 'en_riesgo' | 'critico'
  factores_riesgo:         string[]
  acciones_acordadas:      string
  derivaciones?:           string
  seguimiento_requerido:   boolean
  notas_adicionales?:      string
}) => {
  return await supabase
    .from('entrevistas')
    .insert(entrevista)
}

// Historial de intervenciones de un estudiante (tutor/admin)
export const getIntervencionesEstudiante = async (estudianteId: string) => {
  return await supabase
    .from('intervenciones')
    .select(`
      id, tipo, modalidad, fecha_realizada, estado,
      motivo, resumen, compromisos, proxima_accion,
      usuarios!tutor_id (nombre, apellido),
      entrevistas (estado_alumno_percibido, factores_riesgo)
    `)
    .eq('estudiante_id', estudianteId)
    .order('fecha_realizada', { ascending: false })
}
```

---

## 8. Supabase Edge Functions

Las Edge Functions corren en Deno en los servidores de Supabase.
Se crean en `supabase/functions/` y se despliegan con:
```bash
supabase functions deploy calcular-score
supabase functions deploy detectar-perfil-silencioso
```

### 8.1 `calcular-score`

**Cuándo se invoca:**
- Automáticamente al completar cualquier encuesta (llamado desde `completarEncuesta`)
- Manualmente por el admin desde el panel

**Lógica paso a paso:**
1. Lee indicadores activos con sus componentes y pesos desde tabla `indicadores`
2. Lee cursadas del estudiante (solo registros más recientes por materia)
3. Lee respuestas de la última sesión de encuesta cuatrimestral completada
4. Calcula indicador de ralentización (ver sección 6.5)
5. Calcula indicador de aislamiento (sin encuesta en 60 días = 100, con encuesta = 0)
6. Aplica pesos a cada componente y suma el score total (0-100)
7. Guarda resultado en tabla `scores` con detalle de componentes en campo `componentes` (jsonb)
8. Si nivel es 'alto' o 'critico': inserta alerta `score_critico` en tabla `alertas`
9. Si hay ralentización detectada: inserta alerta `ralentizacion` en tabla `alertas`
10. Actualiza tabla `progreso_estudiante` con el estado actual de cada materia

```ts
// supabase/functions/calcular-score/index.ts
import { serve } from 'https://deno.land/std/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

serve(async (req) => {
  const { estudiante_id } = await req.json()

  // Usar SERVICE_ROLE_KEY para bypass de RLS (solo en Edge Functions)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Indicadores
  const { data: indicadores } = await supabase
    .from('indicadores')
    .select('*, indicador_componentes(*)')
    .eq('activo', true)

  // 2. Cursadas (más reciente por materia)
  const { data: cursadas } = await supabase
    .from('cursadas')
    .select('*, finales(*)')
    .eq('estudiante_id', estudiante_id)
    .order('created_at', { ascending: false })

  // 3. Respuestas de última encuesta completada
  const { data: sesion } = await supabase
    .from('sesiones_encuesta')
    .select('id')
    .eq('estudiante_id', estudiante_id)
    .eq('estado', 'completada')
    .order('completada_at', { ascending: false })
    .limit(1)
    .single()

  const { data: respuestas } = sesion
    ? await supabase
        .from('respuestas')
        .select('*, preguntas(peso_defecto, tipo)')
        .eq('sesion_id', sesion.id)
    : { data: [] }

  // 4. Obtener datos del estudiante para ralentización
  const { data: estudianteData } = await supabase
    .from('estudiantes')
    .select('anio_ingreso, carrera_id')
    .eq('usuario_id', estudiante_id)
    .single()

  // 5. Calcular score (implementar según lógica de indicadores)
  // Los pesos por defecto son: académico 40%, emocional 35%, ralentización 15%, aislamiento 10%
  const componentesScore = {}
  let scoreTotal = 0
  // ... lógica de cálculo usando indicadores y pesos configurados

  const nivel =
    scoreTotal <= 30 ? 'bajo'
    : scoreTotal <= 55 ? 'medio'
    : scoreTotal <= 80 ? 'alto'
    : 'critico'

  // 6. Guardar score
  await supabase.from('scores').insert({
    estudiante_id,
    valor:        scoreTotal,
    nivel_riesgo: nivel,
    componentes:  componentesScore,
    calculado_at: new Date().toISOString()
  })

  // 7. Generar alertas si corresponde
  if (nivel === 'alto' || nivel === 'critico') {
    await supabase.from('alertas').insert({
      estudiante_id,
      tipo:   'score_critico',
      origen: 'automatica',
      estado: 'pendiente'
    })
  }

  return new Response(JSON.stringify({ score: scoreTotal, nivel }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### 8.2 `detectar-perfil-silencioso`

**Cuándo se invoca:** cron job, lunes a las 9am
```
Cron expression: 0 9 * * 1
```

**Lógica:**
1. Busca estudiantes con nivel de riesgo medio/alto/crítico en su último score
2. Filtra los que no tienen encuesta completada en los últimos 60 días
3. Filtra los que no tienen intervención registrada en los últimos 60 días
4. Para cada uno, crea alerta `perfil_silencioso` si no existe una pendiente ya
5. También crea alertas `encuesta_omitida` para estudiantes que debían
   completar la encuesta cuatrimestral y no lo hicieron

---

## 9. Función RPC: `get_materias_habilitadas`

Crear en Supabase SQL Editor. Devuelve las materias que el estudiante
puede cursar según sus correlativas:

```sql
CREATE OR REPLACE FUNCTION get_materias_habilitadas(
  p_estudiante_id uuid,
  p_carrera_id    uuid
)
RETURNS TABLE (materia_id uuid, nombre text, codigo text, anio_teorico int)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT
    m.id        AS materia_id,
    m.nombre,
    m.codigo,
    pe.anio_teorico
  FROM plan_estudios pe
  JOIN materias m ON m.id = pe.materia_id
  WHERE pe.carrera_id = p_carrera_id
    -- Excluir materias ya aprobadas
    AND NOT EXISTS (
      SELECT 1 FROM progreso_estudiante pg
      WHERE pg.estudiante_id = p_estudiante_id
        AND pg.materia_id = m.id
        AND pg.estado = 'aprobada'
    )
    -- Incluir solo si todas las correlativas están aprobadas
    AND NOT EXISTS (
      SELECT 1 FROM correlativas c
      WHERE c.materia_id = m.id
        AND NOT EXISTS (
          SELECT 1 FROM progreso_estudiante pg2
          WHERE pg2.estudiante_id = p_estudiante_id
            AND pg2.materia_id = c.materia_requerida_id
            AND pg2.estado = 'aprobada'
        )
    )
  ORDER BY pe.anio_teorico;
$$;
```

---

## 10. Orden de Implementación

Seguir este orden estrictamente. No empezar un paso sin completar el anterior.

| Paso | Módulo | Qué habilita |
|------|--------|-------------|
| 1 | Auth + useAuth | Login real, routing por rol |
| 2 | Plan de estudios (solo lectura) | Lista de materias para encuesta |
| 3 | Función RPC `get_materias_habilitadas` | Filtrado de materias habilitadas |
| 4 | Perfil estudiante | Dashboard estudiante |
| 5 | Encuestas — cargar estructura | Formulario con preguntas reales |
| 6 | Encuestas — guardar respuestas y cursadas | Persistencia de datos auto-reportados |
| 7 | Encuestas — guardar finales | Registro de intentos de final |
| 8 | Edge Function `calcular-score` | Score real post-encuesta |
| 9 | Scores + semáforo en dashboard | Semáforo actualizado en tiempo real |
| 10 | Alertas + Realtime | Dashboard tutor con alertas en vivo |
| 11 | Intervenciones | Registro de entrevistas y contactos |
| 12 | Dashboard admin (gestión y reportes) | Panel completo de administración |
| 13 | Edge Function `detectar-perfil-silencioso` | Cron semanal automático |
| 14 | Importación XLS/CSV | Datos verificados desde sistema académico |

---

## 11. Estructura de Archivos Fase 2

```
src/
├── lib/
│   └── supabase.ts                      ← cliente singleton, único archivo con createClient
├── hooks/
│   ├── useAuth.ts                        ← sesión, rol, loading
│   ├── useAlertas.ts                     ← alertas + suscripción realtime
│   ├── useEstudiantes.ts                 ← lista de alumnos según rol
│   ├── useScore.ts                       ← último score y historial
│   ├── useEncuesta.ts                    ← estructura y sesión de encuesta
│   └── usePlan.ts                        ← plan de estudios y progreso
├── services/
│   ├── authService.ts
│   ├── estudiantesService.ts
│   ├── scoresService.ts
│   ├── encuestasService.ts               ← incluye guardarCursada y guardarFinal
│   ├── planService.ts
│   ├── alertasService.ts
│   └── intervencionesService.ts
├── data/
│   └── mock/                             ← ELIMINAR completamente al finalizar Fase 2
supabase/
├── functions/
│   ├── calcular-score/
│   │   └── index.ts
│   └── detectar-perfil-silencioso/
│       └── index.ts
└── migrations/
    └── 001_schema_inicial.sql            ← base_de_datos.sql renombrado
```

---

## 12. Criterios de Éxito de la Fase 2

- [ ] Login real con Supabase Auth, sin selector de rol manual
- [ ] El rol se lee de `usuario_roles`, nunca de metadata de Auth ni hardcodeado
- [ ] La encuesta inicial es obligatoria antes de la cuatrimestral
- [ ] Las materias en la encuesta cuatrimestral vienen de `get_materias_habilitadas`
- [ ] El estudiante puede cargar situación, nota de cursada, final e intento de final
- [ ] Todos los datos auto-reportados tienen `es_confiable = false`
- [ ] El score numérico nunca se muestra al estudiante en ninguna vista
- [ ] El score se recalcula automáticamente al completar una encuesta
- [ ] Las alertas aparecen en tiempo real en el dashboard del tutor sin recargar
- [ ] El botón "Pedir ayuda" crea alerta y asigna al tutor del estudiante
- [ ] El plan de estudios es editable por el admin con correlativas
- [ ] Las intervenciones y entrevistas quedan registradas y son consultables
- [ ] Carpeta `src/data/mock/` eliminada completamente del codebase
- [ ] RLS verificado: un estudiante no puede leer datos de otro estudiante