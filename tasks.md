# Tareas del Proyecto Travesía MVP

## 1. Configuración Inicial
- [x] Inicializar y documentar el archivo de tareas (`tasks.md`).
- [x] Instalar dependencias necesarias (`daisyui`, `recharts`, `framer-motion`, `clsx`, `tailwind-merge`).
- [x] Configurar Tailwind CSS para incluir DaisyUI.
- [x] Definir la paleta de colores y variables globales en CSS/Config.

## 2. Base de Datos Mock (Estado Global)
- [x] Definir el contexto de React para el estado (Auth, Usuarios, Plan de Estudios, Encuestas, Alertas).
- [x] Poblar datos de prueba (Mock Data) para Estudiantes, Tutores, Docentes y Admin.
- [ ] Crear funciones de cálculo de Score de Riesgo (Semáforo) y Ralentización.

## 3. Autenticación y Layouts
- [x] Pantalla de Login simulado.
- [x] Layout principal responsivo.
- [x] Implementar la navegación según el rol (`FloatingDock` para estudiante/tutor/docente, `Drawer` para admin).

## 4. Dashboard Estudiante
- [x] Vista general (Score, Semáforo con explicación amigable).
- [x] Progreso en el plan de estudios.
- [x] Botón "Pedir ayuda" (genera alerta).
- [x] Formulario de encuestas (Inicial y Cuatrimestral).

## 5. Dashboard Tutor / Asesor Par / Docente
- [x] Lista de alumnos a cargo con indicadores de riesgo.
- [x] Filtros por nivel de riesgo y estado.
- [x] Vista detallada del perfil del alumno.
- [x] Modal / Formulario para registrar entrevistas / intervenciones.

## 6. Dashboard Admin
- [x] Visualización de métricas de la cohorte (Gráficos Recharts).
- [x] Gestión del plan de estudios (vista básica).
- [x] Configurador de encuestas básico.

## 7. Refinamiento UI y Animaciones (Aceternity UI)
- [x] Integrar `AuroraBackground` o `WavyBackground` en el Login/Módulos de bienvenida.
- [x] Integrar `FloatingDock` para navegaciones.
- [x] Validar criterios de accesibilidad y "prefers-reduced-motion".
