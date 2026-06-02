# Explicación del Motor de Cálculo de Riesgo (Score)

Este documento explica de forma sencilla cómo funciona el motor que evalúa a los estudiantes para determinar su nivel de riesgo. El objetivo del motor es generar un "Score" (puntaje) del 0 al 100, donde **mientras más alto sea el puntaje, mayor es el riesgo de que el estudiante abandone la carrera o requiera apoyo**.

---

## 1. Los 4 Pilares del Score

El cálculo se divide en 4 componentes o aspectos fundamentales del paso de un estudiante por su carrera. A cada componente se le asigna un **peso** porcentual (que puede ajustarse en el sistema) que dicta su importancia en el resultado final:

1. **Rendimiento Académico** (Por defecto: 40%)
2. **Encuestas y Bienestar Emocional** (Por defecto: 35%)
3. **Desempeño / Ralentización** (Por defecto: 15%)
4. **Alerta de Aislamiento** (Por defecto: 10%)

La suma total de estos pesos da el 100% de la calificación final. Cada pilar genera una "nota parcial" del 0 al 100, la cual luego se multiplica por su porcentaje asignado para ver cuántos puntos suma al score general.

---

## 2. ¿Cómo se califica cada pilar?

A continuación, detallamos qué mira el sistema para calificar cada categoría del 0 al 100 y de dónde salen esos números.

### Pilar 1: Rendimiento Académico
*Mide qué tan rezagado está el estudiante en la parte académica, considerando materias aprobadas e historial de aplazos.*

- **Progreso Real vs. Ideal:** El sistema examina tu carrera, tu año de inscripción y averigua cuántas materias en un "plan ideal" ya deberías tener aprobadas según el cuatrimestre actual.
- **Cálculo de penalización básica:** Saca una relación matemática simple (Materias que aprobas / Materias que deberías tener). Por cada punto porcentual por debajo de lo ideal, te anota puntos de riesgo. Si deberías tener 10 aprobadas pero tienes 7, te faltan 30% de tus materias, lo que suma 30 puntos parciales.
- **Castigos por recursadas/aplazos:** Adicional a esto, si el estudiante se anota 2 veces a una cursada asume que fue un aplazo o baja y agrega 5 puntos extra de penalización. Si la cursa 3 veces o más, agrega 10 puntos (con un tope máximo de 30 puntos por recursadas en total).

### Pilar 2: Encuestas y Bienestar Emocional
*Evalúa el estado emocional e intenciones basadas en los formularios que el alumno responde.*

- **Respuestas con puntaje:** Por cada pregunta en la última encuesta del alumno, el motor verifica su puntaje. Por ejemplo, si en la opción "¿Cómo te sientes?" respondió "Mal", el sistema le suma puntos al riesgo.
- **Topes por categoría:** Para evitar que un estudiante salga sumamente riesgoso solo por contestar demasiadas encuestas de una sola categoría de bienestar, se le pone un "tope máximo de puntos de riesgo" a cada tipo de preguntas que configuren los administradores.

### Pilar 3: Ralentización Académica
*Mide si el estudiante se está retrasando fuertemente en su carrera.*

- Mientras el primer pilar cuenta crudos de aprobados y recursados, este pilar **evalúa la brecha general de lentitud** a lo largo de los años.
- Si le faltan hasta un 20% de las materias ideales, su riesgo de ralentización es moderado y crece suavemente.
- **Penalización acelerada:** Sin embargo, si al alumno le están faltando más del 20% de las materias del plan ideal, el riesgo a desmotivarse y abandonar aumenta exponencialmente frente a alguien que va un poquito atrasado, por ende el motor dispara fuerte la penalidad.

### Pilar 4: Aislamiento (El perfil "fantasma")
*Detecta alumnos desconectados del sistema.*

Si no muestra actividad o atención, gana puntos de riesgo por las siguientes situaciones:
1. **+40 Puntos:** Suma 40 puntos si no responde una breve encuesta de sistema hace más de 60 días.
2. **+30 Puntos:** Suma 30 puntos si ningún profesor/tutor registró haber re-contactado o intervenido con el estudiante por más de 90 días.
3. **+30 Puntos:** Suma 30 puntos si todavía no completó su encuesta inicial obligatoria al comienzo de la carrera.
4. **+20 Puntos:** Suma 20 puntos de precaución extra si se emitió una "Alerta de perfil silencioso" sobre este estudiante anteriormente y no fue revisada.

*(Su tope total es de 100 puntos en este módulo).*

---

## 3. El Resultado Final y Emisión de Alertas

El motor calcula el total tomando cada pilar (0 a 100) y le extrae la tajada porcentual que le corresponde al alumno. (Ejemplo: Si saca 50 puntos de riesgo académico, en el peso final que vale 40%, eso representa 20 puntos reales para el indicador global).

Con esa suma, obtenemos el **Score Total que dictará este Estado final**:
- 🟢 **DE 0 A 30 PUNTOS:** Riesgo Bajo (Estudiante saludable)
- 🟡 **DE 31 A 55 PUNTOS:** Riesgo Medio (Para seguimiento a largo plazo)
- 🟠 **DE 56 A 80 PUNTOS:** Riesgo Alto (Amerita contacto del tutor y atención inmediata)
- 🔴 **DE 81 A 100 PUNTOS:** Riesgo Crítico (El estudiante probablemente esté por abandonar, intervención urgente)

Si el nivel calculado cae en **Alto** o **Crítico**, el servidor instantáneamente publicará una alerta roja en el panel para este estudiante hasta que los tutores lo examinen.
