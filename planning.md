# Planning – MVP Proyecto Travesía (Puerto Byte)
**Sistema de Seguimiento de Alumnos en Riesgo de Deserción**
Primer Cuatrimestre 2026

---

## 1. Contexto y Objetivo del MVP

El MVP tiene como propósito demostrar, en el entorno de Google AI Studio, el flujo central del sistema: **un estudiante completa una encuesta → el sistema calcula su score de riesgo → un tutor/docente visualiza el estado y puede registrar una intervención**.

No se busca implementar todo el sistema productivo (Moodle + Supabase + React), sino validar la lógica de negocio, las encuestas base, el modelo de datos y la experiencia de usuario de cada rol.

---

## 2. Roles de Usuario

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| `admin` | Configura encuestas, pesos, plan de estudios, crea usuarios | Total |
| `docente` | Ve dashboard de todos sus alumnos, registra intervenciones | Alumnos asignados |
| `tutor` / `asesor_par` | Ve sus alumnos asignados, registra entrevistas | Alumnos asignados |
| `estudiante` | Completa encuestas, ve su propio panel de progreso | Solo sus datos |

> **Nota MVP:** La identificación de rol se simula mediante selección manual en el login (no se conecta a Moodle real en esta fase). Se documenta la integración futura con Moodle Web Services.

---

## 3. Módulos del MVP

### 3.1 Módulo de Autenticación y Rol
- Pantalla de login con email/contraseña (simulado en AI Studio)
- Selector de rol (Admin / Docente / Tutor / Asesor Par / Estudiante)
- Redirección automática al dashboard según rol

### 3.2 Módulo de Encuestas
**Encuesta Inicial** (se completa al inicio de la carrera, única vez):
- Datos personales básicos (nombre, apellido, DNI)
- Tipo de escuela secundaria
- Situación laboral (trabaja, horas semanales)
- Situación de vivienda y convivencia
- Hijos o personas a cargo
- Tiempo de traslado a la facultad
- Nivel educativo del padre y la madre
- Año de egreso del secundario
- Financiamiento de estudios
- Primera experiencia universitaria
- Técnicas de estudio

**Encuesta Cuatrimestral** (al cierre de cada cuatrimestre):
- Satisfacción con el rendimiento (1-10)
- Materias cursadas (selección desde lista del plan de estudios)
- Por cada materia: situación (promovió / habilitó / desaprobó / abandonó), nota, cómo se sintió, dificultades, dedicación, ritmo de estudio
- Si habilitó: ¿rindió final? ¿nota?
- Materiales disponibles
- Cambios en vida personal
- Motivo principal de duda para continuar
- A quién recurre ante dificultades
- Proyección del próximo mes
- Qué haría si no pudiera continuar
- Qué lo motiva a seguir

**Formulario de Entrevista** (cargado por tutor/docente/asesor par):
- Alumno entrevistado
- Fecha y modalidad
- Motivo de la entrevista
- Resumen cualitativo
- Compromisos acordados
- Estado del alumno post-entrevista
- Próxima acción planificada

### 3.3 Módulo de Plan de Estudios
- El admin puede cargar/editar el plan de estudios (materias, año teórico, correlativas, si es crítica)
- Vista del plan de estudios por carrera
- Progreso del estudiante enfrentado al plan (aprobada / final pendiente / cursando / no cursada)
- Las materias habilitadas para cursar (según correlativas) se muestran en la encuesta cuatrimestral

> **Alcance MVP:** Se incluye la carga del plan de estudios por parte del admin. **No se hardcodea.** Se documenta como feature de producción con integración SIU a futuro.

### 3.4 Módulo de Score y Semáforo
Cálculo del score de riesgo (0-100) basado en:
- Notas y situación en materias cursadas
- Respuestas de encuesta cuatrimestral (variables cualitativas con pesos configurables)
- Detección de ralentización (materias cursadas vs. esperadas según plan)
- Detección de perfil silencioso (alumno sin encuesta completada)

**Sistema semáforo:**
| Nivel | Score | Color |
|-------|-------|-------|
| Vigoroso (Bajo) | ≤ 30 | 🟢 Verde |
| Moderado (Medio) | 31–55 | 🟡 Amarillo |
| Alto (Rojo) | 56–80 | 🔴 Rojo |
| Crítico | > 80 | ⚫ Negro/Crítico |

Las notas ingresadas manualmente por el estudiante se marcan con **tag `no_confiable`** si contradicen los datos importados.

### 3.5 Módulo de Dashboard por Rol

**Dashboard Estudiante:**
- Mi progreso en el plan de estudios
- Mi score actual (semáforo)
- Encuestas pendientes
- Botón "Pedir ayuda" (genera alerta)

**Dashboard Docente / Tutor / Asesor Par:**
- Tabla de alumnos asignados con score, último contacto y situación
- Filtros: nivel de riesgo, año, estado de encuesta
- Acceso al perfil completo de cada alumno
- Registro de intervención
- Alertas recientes

**Dashboard Admin:**
- Estadísticas de cohorte
- Ranking de materias por tasa de abandono
- Gestión de encuestas (crear, editar, configurar pesos)
- Gestión de plan de estudios
- Gestión de usuarios y roles
- Importación de datos (XLS/CSV simulada en MVP)

### 3.6 Módulo de Alertas
- Alerta automática: alumno no completó encuesta (perfil silencioso)
- Alerta automática: score supera umbral crítico
- Alerta manual: alumno presiona "Pedir ayuda"
- Alerta de ralentización: cursa menos materias de las esperadas

### 3.7 Módulo de Ralentización (Casos de Prueba MVP)
Se definen casos de prueba para validar la lógica de ralentización:

| Caso | Descripción | Resultado esperado |
|------|-------------|-------------------|
| CP-RAL-01 | Alumno de 3er año con avance de 1er año según plan | Alerta ralentización crítica |
| CP-RAL-02 | Alumno cursa 1 materia cuando el plan espera 5 | Semáforo amarillo + alerta |
| CP-RAL-03 | Alumno avanza según plan | Sin alerta |
| CP-RAL-04 | Alumno cursó todas las materias pero tiene finales pendientes | Alerta "final pendiente" |
| CP-RAL-05 | Alumno con cambio de plan de estudios | Bloqueo hasta entrevista obligatoria |

---

## 4. Flujos Principales

```
[ESTUDIANTE]
  → Login → Dashboard → Encuesta pendiente → Completa encuesta
  → Score recalculado → Semáforo actualizado

[TUTOR/DOCENTE]
  → Login → Dashboard → Lista de alumnos con alertas
  → Selecciona alumno → Perfil completo → Registra intervención

[ADMIN]
  → Login → Configura plan de estudios → Carga/edita encuesta
  → Ajusta pesos de indicadores → Ve estadísticas globales
```

---

## 5. Integración con Moodle (Documentada, No Implementada en MVP)

En producción:
- La App React se inyecta vía iframe en bloques HTML de Moodle
- El rol se lee desde `moodle_user_id` y el perfil de usuario en Moodle
- Los datos de notas y actividad se sincronizan vía Moodle Web Services REST
- Las alertas se disparan como notificaciones en el campus

En MVP: el login es independiente y el rol se asigna manualmente.

---

## 6. Limitaciones del MVP y Roadmap

| Feature | MVP | Producción |
|---------|-----|-----------|
| Login con Moodle SSO | ❌ (manual) | ✅ |
| Importación XLS/CSV real | ❌ (simulada) | ✅ |
| Embed en Moodle | ❌ | ✅ |
| Exportación PDF/CSV | ❌ | ✅ |
| Envío de emails/notificaciones | ❌ | ✅ |
| Plan de estudios cargado por admin | ✅ | ✅ |
| Encuestas dinámicas | ✅ (parcial) | ✅ (completo) |
| Fórmulas de indicadores custom | ❌ | ✅ |
| Multi-carrera | ❌ (1 carrera fija) | ✅ |

---

## 7. Stack MVP

- **Frontend:** React (componentes funcionales con hooks)
- **Estado:** useState / useReducer (sin backend real en MVP)
- **Datos:** JSON estático / localStorage para persistencia de sesión
- **IA:** API del modelo elegido (Kimi K2.6 / DeepSeek V3.2) para análisis cualitativo de respuestas de encuesta (sugerencias al tutor)
- **Estilos:** Tailwind CSS + librerías de componentes (ver sección 7.1)

### 7.1 Librerías de Componentes UI

Se usan **exclusivamente versiones gratuitas y open source**. Ninguna librería requiere licencia de pago.

#### Aceternity UI (gratuitos)
Componentes con animaciones y efectos visuales de alta calidad. Instalación individual por componente (copy-paste desde aceternity.com/components).

| Componente | Uso en el proyecto |
|------------|-------------------|
| `AuroraBackground` | Fondo animado del hero en dashboard estudiante |
| `FlipWords` | Palabras rotativas en el saludo ("proceso", "camino", "historia") |
| `Spotlight` | Efecto de foco en la card de situación actual |
| `MovingBorder` | Borde animado en navbar y botones de acción primaria |
| `TextGenerateEffect` | Animación de texto en pantallas de bienvenida/login |
| `TypewriterEffect` | Subtítulos animados en dashboard |
| `BackgroundBeams` | Fondo decorativo en pantalla de login |
| `Meteors` | Efecto decorativo en cards de alertas críticas |
| `WavyBackground` | Sección hero en landing/login |
| `Vortex` | Pantalla de carga o transiciones entre roles |
| `FloatingDock` | Navegación principal en desktop para roles estudiante, tutor y asesor par |

> ⚠️ **Prohibido usar:** CardSpotlight, BentoGrid, BackgroundGradient, AnimatedTestimonials, HoverEffect (requieren Aceternity Pro).

#### DaisyUI (gratuito, open source)
Componentes semánticos sobre Tailwind. Se instala como plugin de Tailwind (`npm i daisyui`).

| Componente | Uso en el proyecto |
|------------|-------------------|
| `badge` | Nivel de riesgo semafórico (Vigoroso / Moderado / Alto / Crítico) |
| `radial-progress` | Progreso abstracto de "zona segura" en dashboard estudiante |
| `progress` | Avance en el plan de estudios (materias aprobadas / total) |
| `alert` | Encuestas pendientes, advertencias de datos no confiables |
| `btn` | Botones de acción (CTA, Pedir ayuda, Completar encuesta) |
| `modal` | Registro de intervención, confirmaciones |
| `table` | Dashboard tutor/docente: lista de alumnos con score |
| `stats` | Panel admin: métricas de cohorte |
| `steps` | Progreso dentro del formulario de encuesta multi-paso |
| `drawer` | Menú lateral en versión mobile |
| `btm-nav` | Navegación inferior exclusiva para mobile |
| `select` / `input` / `textarea` | Formularios de encuesta y entrevista |
| `tooltip` | Información adicional sobre indicadores y scores |
| `skeleton` | Estado de carga de datos |
| `swap` | Toggle de tema claro/oscuro |

#### Recharts (gratuito, open source)
Librería de gráficos para React basada en D3. Se instala con `npm i recharts`.

| Componente | Uso en el proyecto |
|------------|-------------------|
| `RadarChart` | Perfil de riesgo del alumno (dimensiones: académico, emocional, laboral, económico) |
| `LineChart` | Evolución del score a lo largo de los cuatrimestres |
| `BarChart` | Ranking de materias por tasa de abandono (dashboard admin/docente) |
| `PieChart` | Distribución de niveles de riesgo en la cohorte |

#### Framer Motion (gratuito, open source)
Ya incluido como dependencia de Aceternity UI. Se usa directamente sin instalación extra.

| Uso | Detalle |
|-----|---------|
| Entrada de cards | `fadeInUp` con stagger de 0.1s entre cards |
| Transiciones de ruta | Fade entre dashboards al cambiar de rol |
| Animación de semáforo | Spring animation al cambiar de nivel de riesgo |

#### Lucide React (gratuito, open source)
Iconos consistentes. Se instala con `npm i lucide-react`.

Íconos usados: `Bell`, `User`, `AlertTriangle`, `CheckCircle`, `BookOpen`, `ClipboardList`, `TrendingDown`, `HelpCircle`, `LogOut`, `ChevronRight`.

---

### 7.2 Convenciones de Uso

- Los componentes de Aceternity se importan desde `@/components/ui/`
- Los componentes DaisyUI se usan como clases de Tailwind directamente (no imports)
- Recharts se importa desde `recharts`
- Framer Motion se importa desde `framer-motion`
- Lucide se importa desde `lucide-react`
- **Nunca mezclar** componentes de Aceternity Pro con los gratuitos en el mismo archivo
- Las animaciones de Aceternity se desactivan si `prefers-reduced-motion` está activo (accesibilidad)

### 7.3 Estrategia de Navegación por Rol — FloatingDock vs Sidebar

El `FloatingDock` de Aceternity se usa como nav principal en desktop para los roles con pocas secciones. El rol admin usa sidebar de DaisyUI por la cantidad de secciones que maneja.

| Rol | Desktop | Mobile |
|-----|---------|--------|
| `estudiante` | FloatingDock (centro, bottom-6) | DaisyUI `btm-nav` |
| `tutor` | FloatingDock (centro, bottom-6) | DaisyUI `btm-nav` |
| `asesor_par` | FloatingDock (centro, bottom-6) | DaisyUI `btm-nav` |
| `docente` | FloatingDock (centro, bottom-6) | DaisyUI `btm-nav` |
| `admin` | DaisyUI `drawer` sidebar lateral | DaisyUI `btm-nav` |

**Ítems del FloatingDock por rol:**

```js
// Estudiante (5 ítems)
[
  { title: "Inicio",      icon: <Home />,         href: "/dashboard" },
  { title: "Mi plan",     icon: <BookOpen />,      href: "/plan" },
  { title: "Encuestas",   icon: <ClipboardList />, href: "/encuestas" },
  { title: "Pedir ayuda", icon: <HelpCircle />,    href: "/ayuda" },
  { title: "Perfil",      icon: <User />,          href: "/perfil" },
]

// Tutor / Asesor Par (5 ítems)
[
  { title: "Inicio",       icon: <Home />,         href: "/dashboard" },
  { title: "Mis alumnos",  icon: <Users />,         href: "/alumnos" },
  { title: "Alertas",      icon: <Bell />,          href: "/alertas" },
  { title: "Intervención", icon: <ClipboardList />, href: "/intervencion/nueva" },
  { title: "Perfil",       icon: <User />,          href: "/perfil" },
]

// Docente (4 ítems)
[
  { title: "Cohorte",   icon: <BarChart2 />,    href: "/dashboard" },
  { title: "Materias",  icon: <BookOpen />,     href: "/materias" },
  { title: "Reportes",  icon: <TrendingDown />, href: "/reportes" },
  { title: "Perfil",    icon: <User />,         href: "/perfil" },
]
```

**Reglas visuales:**
- Posición fija: `fixed bottom-6 left-1/2 -translate-x-1/2 z-50`
- Fondo glass coherente con paleta navy: `bg-gray-900/80 backdrop-blur-md`
- El ícono "Pedir ayuda" del estudiante usa color teal `#14B8A6` para destacarse sin alarmismo
- El ícono "Alertas" del tutor muestra un badge rojo animado si hay alertas pendientes (Framer Motion)
- Instalación: `npx shadcn@latest add @aceternity/floating-dock`

---

## 8. Criterios de Éxito del MVP

- [ ] Un estudiante puede completar la encuesta inicial y cuatrimestral
- [ ] El sistema calcula y muestra el score/semáforo correctamente
- [ ] Un tutor puede ver la lista de sus alumnos con su estado de riesgo
- [ ] Un tutor puede registrar una intervención
- [ ] Un admin puede cargar/editar el plan de estudios
- [ ] Un admin puede crear/editar encuestas con sus preguntas
- [ ] El sistema detecta y marca el perfil silencioso
- [ ] Los casos de prueba de ralentización son demostrables
- [ ] Las notas auto-reportadas tienen el tag `no_confiable`
