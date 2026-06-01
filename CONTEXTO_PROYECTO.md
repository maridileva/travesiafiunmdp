# Contexto del Proyecto: Travesía MVP (Fase 2)

**Puerto Byte | Sistema de Seguimiento de Alumnos en Riesgo de Deserción**

Este documento de contexto completo contiene la arquitectura, las directrices de interfaz de usuario, las reglas de negocio y los roles de usuario para la aplicación. Está diseñado para servir como referencia principal para el desarrollo y mantenimiento del sistema.

---

## 1. Visión y Propósito del Proyecto
**Travesía** es un Sistema de Seguimiento longitudinal para estudiantes de Ingeniería Industrial de la FI-UNMdP (desde el ingreso hasta el egreso). Su propósito central es identificar, prevenir e intervenir de manera temprana ante situaciones de:
*   **Deserción Temprana**: Frecuente en el 1° año (tasa histórica: 40%), usualmente por el shock de materias básicas.
*   **Deserción Tardía**: Frecuente a partir de 4° año (tasa histórica: 23%), ocasionada por cambios de prioridades o ingreso al mercado laboral.
*   **Ralentización**: Prolongación excesiva de los tiempos teóricos del plan de estudios.

El sistema procesa notas, avance en el plan, respuestas de encuestas cualitativas del alumno y niveles de contacto, para alimentar un **Algoritmo de Score de Riesgo Determinístico (0-100)** usando pesos y reglas estrictas, que luego alerta a los tutores para intervenir. **Aclaración**: El cálculo del score y la detección del riesgo es 100% determinístico basado en fórmulas, sin intervención de IA.

---

## 2. Instrucciones Generales del Sistema
El sistema de Travesía cumple una función operativa clave:
1.  **Asistencia Operativa**: Guiar al alumno, mostrar cómo funciona la plataforma y permitir a los administradores la importación de datos o configuración de indicadores.

**Directivas de Comunicación (Textos de la plataforma)**:
*   El tono de la interfaz debe ser: **español rioplatense**, cercano, profesional y altamente empático con el estudiante, pero directo, estructurado y basado en datos con tutores y administradores.
*   **Restricciones de Privacidad**: El sistema NUNCA muestra datos de otros estudiantes.
*   **Restricciones de Diagnóstico**: La plataforma no realiza diagnósticos. Si un alumno indica crisis en las encuestas, se alerta directamente a tutores institucionales.

---

## 3. Tipos de Usuarios, Permisos y Comportamientos

### A. Estudiante (Consumidor Primario)
*   **Misión**: Mantenerlo motivado, relevar su estado y mostrar su avance en el plan.
*   **Reglas**:
    *   **NUNCA ve el score numérico (ej. "75/100")**. Solo ve una categoría semafórica y un mensaje constructivo.
    *   Debe rellenar una "Encuesta Inicial" al ingresar al sistema.
    *   Debe rellenar la "Encuesta Cuatrimestral" para actualizar su estado. Las preguntas de materias en esta encuesta se generan dinámicamente según las materias que *tiene habilitadas* para cursar (validando con correlativas).
    *   Puede pulsar un botón de "Pedir Ayuda" (icono turquesa) que genera una alerta instantánea a su tutor.

### B. Tutor / Asesor Par (Interventor)
*   **Misión**: Acompañar a los alumnos asignados, registrar entrevistas (intervenciones) y revisar alertas.
*   **Diferencia de trato**: El Asesor Par (estudiante avanzado) recibe un tono más coloquial; el Tutor (docente/graduado) un tono más formal.
*   **Reglas**:
    *   Ve el listado de alumnos asignados con score exacto.
    *   La herramienta principal que usa es el panel de métricas y la revisión directa de las respuestas de las encuestas del alumno para guiar su entrevista.

### C. Docente (Consultor)
*   **Misión**: Monitorear estadísticas globales y tendencias de abandono/rendimiento de su propia cohorte o materia.
*   **Reglas**: No puede ver data personal de alumnos fuera de estadísticas indexadas (datos anonimizados para evitar sesgos, salvo configuraciones especiales de administración).

### D. Administrador (Gestor del Sistema)
*   **Misión**: Configurar pesos del algoritmo, ABM de materias, planes, importación de datos brutos desde archivos (XLS/CSV) y configuración de las encuestas.

---

## 4. Reglas de Negocio Vitales y Algoritmia Core

### 4.1. Semáforo de Riesgo (Score 0-100)
*   🟢 **Vigoroso (Bajo Riesgo)**: score ≤ 30
*   🟡 **Moderado (Medio Riesgo)**: score 31–55
*   🔴 **Alto Riesgo**: score 56–80
*   ⚫ **Crítico**: score > 80

### 4.2. Variables del Algoritmo (Pesos por Defecto)
El sistema pondera 4 dimensiones para su cálculo base:
1.  **Rendimiento Académico (40%)**: Ratio de materias aprobadas vs esperadas, recurrencias de aplazos.
2.  **Encuesta Emocional/Motivacional (35%)**: Respuestas autodeclaradas (estrés, trabajo, autopercepción).
3.  **Indicador de Ralentización (15%)**: Mide la brecha entre el plan teórico sugerido y la realidad cronológica del estudiante. (Alerta: brecha > 20% de diferencia).
4.  **Indicador de Aislamiento (10%)**: Si el alumno no responde encuestas, no pide ayuda o no acude a intervenciones.

### 4.3. Conceptos Especiales del Dominio
*   **Perfil Silencioso**: Estudiantes con score Medio o Alto, que **NO** han completado encuestas en los últimos 60 días, y que **NO** registran pedido de ayuda o intervención. (Prioridad ROJA para los tutores).
*   **Datos "No Confiables"**: Si el estudiante declara manualmente en una encuesta haber aprobado una materia, se guarda bajo un flag `es_confiable = false`. Este dato pesa en el UI pero si entra en contradicción con datos maestros importados (SIU-Guaraní), prima el SIU.
*   **Bloqueo por Cambio de Plan**: Si un alumno cambia de plan de estudios, el score se "congela" y se requiere obligatoriamente una entrevista validada con un tutor.

---

## 5. Directrices de Tecnología, UI y Diseño (Obligatorio)

### Stack Tecnológico
*   **Frontend**: React 18+ con Vite (TypeScript).
*   **Backend & Auth**: Supabase (PostgreSQL para data, Supabase Auth para acceso, Edge Functions si aplica).
*   **Datos Visules**: Recharts (obligatorio para dashboards).

### UI Design System y Componentes Permitidos
1.  **Framework Base**: Tailwind CSS (Utility classes absolutas). Formatos prefabricados a través de **DaisyUI** (por ej: `<span className="badge badge-success">...</span>`).
2.  **Librerías de Animación / UI Específica**:
    *   `framer-motion` (estándar para micro-interacciones, page transitions usando AnimatePresence).
    *   **Aceternity UI (Solo librerías GRATUITAS y permitidas)**: 
        *   Permitidos: `AuroraBackground`, `FlipWords`, `Spotlight`, `MovingBorder`, `TextGenerateEffect`, `TypewriterEffect`, `BackgroundBeams`, `Meteors`, `Vortex`, `FloatingDock`.
        *   **PROHIBIDOS ESTRICTAMENTE (Versiones PRO)**: `CardSpotlight`, `BentoGrid`, `BackgroundGradient`, `AnimatedTestimonials`, `HoverEffect`, `GlassCard`. No incluirlos, referenciarlos ni importarlos nunca.
3.  **Íconos**: Únicamente `lucide-react`.

### Convenciones de UI y Layout
*   **Paleta Genérica**:
    *   Fondo/Base: Navy (#0F1B2D). Interfaz de tipo Dark/Glassmorphism predominante.
    *   Acentos principales: Azul (#3B82F6) o Teal (#14B8A6).
*   **Navegación**:
    *   Todos los roles (excepto Admin) usan el `<FloatingDock>` de Aceternity como menú iterativo de escritorio (fijado abajo). En móvil, se delega al bottom bar nativo de DaisyUI.
    *   Botón "Pedir Ayuda" del estudiante: debe forzarse en color Teal-400 para disuadir urgencias graves que correspondan al 911, actuando como contención institucional.

---

## 6. Estructura del Proyecto (Directorio React)
La arquitectura está dividida por capas para mantener escalabilidad:
```plaintext
/src
  /components
    /ui              # Envoltorios de Aceternity UI, loaders, layouts base.
    /dashboards      # Las pantallas core. e.g. DashEstudiante, DashTutor, Encuestas.
    AppRouter.tsx    # Motor de rutas y protección basada en Rol.
  /hooks             # Hooks de data-fetching. Ejs:
                     # - useAuth: Manejo de sesión Supabase y rol activo.
                     # - usePerfil: Data biográfica (estudiantes/profesores).
                     # - useScore: Recupera score y métricas calculadas.
                     # - usePlan: Maneja la lógica de progreso y correlativas.
  /services          # Capa de API. Funciones exportadas que llaman estricta y puramente a supabase-js.
  /types             # Interfaces TypeScript, Supabase definitions (Database) y Enums.
  /lib               # Clientes de librerías externas (supabase client init, utils cn).
```

---

## 7. Referencia de Base de Datos - Supabase PostgreSQL
A continuación, el esquema real definido para este MVP. El sistema hace fuerte uso de restricciones `CHECK` y `FOREIGN KEY` para resguardar la integridad.

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.usuarios (
  id uuid NOT NULL,
  nombre text NOT NULL,
  apellido text NOT NULL,
  email text NOT NULL UNIQUE,
  legajo text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.carreras (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre text NOT NULL,
  codigo text,
  CONSTRAINT carreras_pkey PRIMARY KEY (id)
);

CREATE TABLE public.usuario_roles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  usuario_id uuid NOT NULL,
  rol text NOT NULL CHECK (rol = ANY (ARRAY['admin'::text, 'docente'::text, 'tutor'::text, 'asesor_par'::text, 'estudiante'::text])),
  carrera_id uuid,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT usuario_roles_pkey PRIMARY KEY (id),
  CONSTRAINT usuario_roles_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT usuario_roles_carrera_id_fkey FOREIGN KEY (carrera_id) REFERENCES public.carreras(id)
);

CREATE TABLE public.estudiantes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  usuario_id uuid NOT NULL UNIQUE,
  carrera_id uuid NOT NULL,
  anio_ingreso integer NOT NULL,
  encuesta_inicial_completada boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT estudiantes_pkey PRIMARY KEY (id),
  CONSTRAINT estudiantes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT estudiantes_carrera_id_fkey FOREIGN KEY (carrera_id) REFERENCES public.carreras(id)
);

CREATE TABLE public.materias (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  carrera_id uuid NOT NULL,
  nombre text NOT NULL,
  codigo text NOT NULL,
  creditos integer,
  CONSTRAINT materias_pkey PRIMARY KEY (id),
  CONSTRAINT materias_carrera_id_fkey FOREIGN KEY (carrera_id) REFERENCES public.carreras(id)
);

CREATE TABLE public.plan_estudios (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  carrera_id uuid NOT NULL,
  materia_id uuid NOT NULL,
  anio_teorico integer NOT NULL,
  cuatrimestre integer NOT NULL,
  tipo text DEFAULT 'obligatoria'::text,
  es_critica boolean DEFAULT false,
  CONSTRAINT plan_estudios_pkey PRIMARY KEY (id),
  CONSTRAINT plan_estudios_carrera_id_fkey FOREIGN KEY (carrera_id) REFERENCES public.carreras(id),
  CONSTRAINT plan_estudios_materia_id_fkey FOREIGN KEY (materia_id) REFERENCES public.materias(id)
);

CREATE TABLE public.correlativas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  materia_id uuid NOT NULL,
  materia_requerida_id uuid NOT NULL,
  tipo text DEFAULT 'aprobada'::text CHECK (tipo = ANY (ARRAY['aprobada'::text, 'cursada'::text])),
  CONSTRAINT correlativas_pkey PRIMARY KEY (id),
  CONSTRAINT correlativas_materia_id_fkey FOREIGN KEY (materia_id) REFERENCES public.materias(id),
  CONSTRAINT correlativas_materia_requerida_id_fkey FOREIGN KEY (materia_requerida_id) REFERENCES public.materias(id)
);

CREATE TABLE public.progreso_estudiante (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  estudiante_id uuid NOT NULL,
  materia_id uuid NOT NULL,
  estado text NOT NULL CHECK (estado = ANY (ARRAY['aprobada'::text, 'final_pendiente'::text, 'cursando'::text, 'no_cursada'::text, 'recursando'::text])),
  nota_final numeric,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT progreso_estudiante_pkey PRIMARY KEY (id),
  CONSTRAINT progreso_estudiante_estudiante_id_fkey FOREIGN KEY (estudiante_id) REFERENCES public.usuarios(id),
  CONSTRAINT progreso_estudiante_materia_id_fkey FOREIGN KEY (materia_id) REFERENCES public.materias(id)
);

CREATE TABLE public.cursadas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  estudiante_id uuid NOT NULL,
  materia_id uuid NOT NULL,
  cuatrimestre integer NOT NULL,
  anio integer NOT NULL,
  situacion text NOT NULL CHECK (situacion = ANY (ARRAY['promovio'::text, 'habilito'::text, 'desaprobo'::text, 'abandono'::text])),
  nota_cursada integer,
  como_se_sintio text,
  dificultades ARRAY,
  dedicacion text,
  ritmo_estudio text,
  tiene_materiales boolean,
  numero_cursada integer DEFAULT 1,
  es_confiable boolean DEFAULT false,
  valor_original_alumno jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cursadas_pkey PRIMARY KEY (id),
  CONSTRAINT cursadas_estudiante_id_fkey FOREIGN KEY (estudiante_id) REFERENCES public.usuarios(id),
  CONSTRAINT cursadas_materia_id_fkey FOREIGN KEY (materia_id) REFERENCES public.materias(id)
);

CREATE TABLE public.finales (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  cursada_id uuid NOT NULL,
  estudiante_id uuid NOT NULL,
  materia_id uuid NOT NULL,
  resultado text NOT NULL CHECK (resultado = ANY (ARRAY['aprobado'::text, 'desaprobado'::text, 'ausente'::text])),
  nota integer,
  fecha_intento date,
  numero_intento integer DEFAULT 1,
  es_confiable boolean DEFAULT false,
  valor_original_alumno jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT finales_pkey PRIMARY KEY (id),
  CONSTRAINT finales_cursada_id_fkey FOREIGN KEY (cursada_id) REFERENCES public.cursadas(id),
  CONSTRAINT finales_estudiante_id_fkey FOREIGN KEY (estudiante_id) REFERENCES public.usuarios(id),
  CONSTRAINT finales_materia_id_fkey FOREIGN KEY (materia_id) REFERENCES public.materias(id)
);

CREATE TABLE public.encuestas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  titulo text NOT NULL,
  descripcion text,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['inicial'::text, 'cuatrimestral'::text, 'entrevista'::text])),
  activa boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT encuestas_pkey PRIMARY KEY (id)
);

CREATE TABLE public.encuesta_secciones (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  encuesta_id uuid NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  orden integer NOT NULL,
  CONSTRAINT encuesta_secciones_pkey PRIMARY KEY (id),
  CONSTRAINT encuesta_secciones_encuesta_id_fkey FOREIGN KEY (encuesta_id) REFERENCES public.encuestas(id)
);

CREATE TABLE public.preguntas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  seccion_id uuid NOT NULL,
  texto text NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['texto'::text, 'multiple'::text, 'unica'::text, 'escala'::text])),
  opciones jsonb,
  escala_min integer,
  escala_max integer,
  orden integer NOT NULL,
  obligatoria boolean DEFAULT true,
  aplica_por_materia boolean DEFAULT false,
  peso_defecto numeric DEFAULT 0,
  CONSTRAINT preguntas_pkey PRIMARY KEY (id),
  CONSTRAINT preguntas_seccion_id_fkey FOREIGN KEY (seccion_id) REFERENCES public.encuesta_secciones(id)
);

CREATE TABLE public.sesiones_encuesta (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  encuesta_id uuid NOT NULL,
  estudiante_id uuid NOT NULL,
  cuatrimestre integer,
  anio integer,
  estado text NOT NULL CHECK (estado = ANY (ARRAY['en_progreso'::text, 'completada'::text])),
  iniciada_at timestamp with time zone DEFAULT now(),
  completada_at timestamp with time zone,
  CONSTRAINT sesiones_encuesta_pkey PRIMARY KEY (id),
  CONSTRAINT sesiones_encuesta_encuesta_id_fkey FOREIGN KEY (encuesta_id) REFERENCES public.encuestas(id),
  CONSTRAINT sesiones_encuesta_estudiante_id_fkey FOREIGN KEY (estudiante_id) REFERENCES public.usuarios(id)
);

CREATE TABLE public.respuestas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  sesion_id uuid NOT NULL,
  pregunta_id uuid NOT NULL,
  materia_id uuid,
  valor text NOT NULL,
  es_confiable boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT respuestas_pkey PRIMARY KEY (id),
  CONSTRAINT respuestas_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.sesiones_encuesta(id),
  CONSTRAINT respuestas_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES public.preguntas(id),
  CONSTRAINT respuestas_materia_id_fkey FOREIGN KEY (materia_id) REFERENCES public.materias(id)
);

CREATE TABLE public.scores (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  estudiante_id uuid NOT NULL,
  valor numeric NOT NULL,
  nivel_riesgo text NOT NULL CHECK (nivel_riesgo = ANY (ARRAY['bajo'::text, 'medio'::text, 'alto'::text, 'critico'::text])),
  cuatrimestre integer,
  anio integer,
  componentes jsonb,
  calculado_at timestamp with time zone DEFAULT now(),
  CONSTRAINT scores_pkey PRIMARY KEY (id),
  CONSTRAINT scores_estudiante_id_fkey FOREIGN KEY (estudiante_id) REFERENCES public.usuarios(id)
);

CREATE TABLE public.asignaciones_tutor (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tutor_id uuid NOT NULL,
  estudiante_id uuid NOT NULL,
  rol_tutor text NOT NULL CHECK (rol_tutor = ANY (ARRAY['tutor'::text, 'asesor_par'::text])),
  activa boolean DEFAULT true,
  asignado_at timestamp with time zone DEFAULT now(),
  CONSTRAINT asignaciones_tutor_pkey PRIMARY KEY (id),
  CONSTRAINT asignaciones_tutor_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.usuarios(id),
  CONSTRAINT asignaciones_tutor_estudiante_id_fkey FOREIGN KEY (estudiante_id) REFERENCES public.usuarios(id)
);

CREATE TABLE public.alertas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  estudiante_id uuid NOT NULL,
  tutor_id uuid,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['score_critico'::text, 'perfil_silencioso'::text, 'encuesta_omitida'::text, 'ralentizacion'::text, 'solicitud_ayuda'::text, 'cambio_plan'::text])),
  origen text NOT NULL CHECK (origen = ANY (ARRAY['automatica'::text, 'solicitud_alumno'::text])),
  descripcion text,
  estado text NOT NULL CHECK (estado = ANY (ARRAY['pendiente'::text, 'resuelta'::text])),
  created_at timestamp with time zone DEFAULT now(),
  resuelta_at timestamp with time zone,
  resuelta_por uuid,
  CONSTRAINT alertas_pkey PRIMARY KEY (id),
  CONSTRAINT alertas_estudiante_id_fkey FOREIGN KEY (estudiante_id) REFERENCES public.usuarios(id),
  CONSTRAINT alertas_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.usuarios(id),
  CONSTRAINT alertas_resuelta_por_fkey FOREIGN KEY (resuelta_por) REFERENCES public.usuarios(id)
);

CREATE TABLE public.intervenciones (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  estudiante_id uuid NOT NULL,
  tutor_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['entrevista'::text, 'contacto_email'::text, 'contacto_telefono'::text, 'reunion_grupal'::text])),
  modalidad text NOT NULL CHECK (modalidad = ANY (ARRAY['presencial'::text, 'virtual'::text, 'telefonica'::text])),
  fecha_realizada timestamp with time zone NOT NULL,
  motivo text NOT NULL,
  resumen text NOT NULL,
  compromisos text,
  proxima_accion text,
  estado text NOT NULL CHECK (estado = ANY (ARRAY['planificada'::text, 'realizada'::text, 'cancelada'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT intervenciones_pkey PRIMARY KEY (id),
  CONSTRAINT intervenciones_estudiante_id_fkey FOREIGN KEY (estudiante_id) REFERENCES public.usuarios(id),
  CONSTRAINT intervenciones_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.usuarios(id)
);

CREATE TABLE public.entrevistas (
  intervencion_id uuid NOT NULL,
  motivo_entrevista text NOT NULL,
  estado_alumno_percibido text NOT NULL CHECK (estado_alumno_percibido = ANY (ARRAY['bien'::text, 'regular'::text, 'en_riesgo'::text, 'critico'::text])),
  factores_riesgo ARRAY,
  acciones_acordadas text NOT NULL,
  derivaciones text,
  seguimiento_requerido boolean DEFAULT false,
  notas_adicionales text,
  CONSTRAINT entrevistas_pkey PRIMARY KEY (intervencion_id),
  CONSTRAINT entrevistas_intervencion_id_fkey FOREIGN KEY (intervencion_id) REFERENCES public.intervenciones(id)
);
```