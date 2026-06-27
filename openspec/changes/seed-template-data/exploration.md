# Exploration: Seed Template Data for travesiafiunmdp-main

**Date**: 2026-06-27
**Scope**: Investigate what data needs to be seeded so the app ships ready-to-use with template data
**Mode**: Read-only investigation (no code or SQL written)
**Change name**: `seed-template-data`

---

## Current State

The project has 7 applied migrations (`000_base_de_datos.sql` through `007_schema_fixes.sql`) plus a manual revert script (`supabase/008_revert_schema_fixes.sql`) outside the migrations folder. **No migration seeds any data** — the 22 tables exist as schema only. The user reported "we already seeded 4 indicators manually" but a full grep of `supabase/` confirms zero `INSERT INTO` statements for any of the runtime tables (`carreras`, `materias`, `plan_estudios`, `correlativas`, `indicadores`, `indicador_componentes`, `categorias_pregunta`, `encuestas`, `encuesta_secciones`, `preguntas`, `scoring_opciones`, `scoring_tramos`).

The live Supabase DB confirmed via `supabase_execute_sql` is empty: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'` returns `[]`. The 7 migration files are the schema source of truth, but no row-level data exists in production.

This means the app, as it stands, ships **completely empty**: when an admin opens `DashPlanAdmin` they see the empty-state ("Añadí una carrera nueva para empezar..."), `DashEncuestasAdmin` shows "No hay encuestas todavía", and the `calcular-score` Edge Function finds zero indicadores so it falls back to the hardcoded 40/35/15/10 split.

---

## Affected Areas

- `supabase/docs/planesdeestudio.md` — Source of truth for 10 careers (Informática Plan 2024 has full subject list; 9 others have names only)
- `supabase/migrations/` — Next available number is `009` (since `008` is the manual revert script at `supabase/008_revert_schema_fixes.sql`, intentionally outside `migrations/`)
- `EXPLICACION_SCORE.md` — Documents the 4-pillar scoring model with default weights
- `src/services/encuestasService.ts` — Reads `encuesta` + `encuesta_secciones` + `preguntas` via nested select; will fail silently with no rows
- `src/components/dashboards/EncuestaInicial.tsx` — Hardcoded `formData` slugs (`'horas_trabajo'`, `'expectativa'`, etc.) passed as `pregunta_id` to `guardarRespuesta` (legacy FK-broken pattern — see fix-db-schema-mismatches finding #13)
- `src/components/dashboards/Encuestas.tsx` — Hardcoded `satisfaction` (1-10) + per-materia cursada flow
- `src/components/dashboards/EncuestaEditor.tsx` — Editor of `preguntas` + nested `scoring_opciones` + `scoring_tramos`; produces canonical survey structure
- `src/components/dashboards/GestionCategorias.tsx` — Creates `categorias_pregunta` with `score_maximo`, `color`, `descripcion`
- `src/components/dashboards/DashEncuestasAdmin.tsx` — Toggles `encuestas.activa`; **only one encuesta per `tipo` should be active** to avoid `getEncuestaActiva` (`.single()`) throwing
- `supabase/functions/calcular-score/index.ts` — Looks up `indicadores` by substring match (`nombre.toLowerCase().includes('académico')` etc.) — names MUST include those keywords
- `src/components/dashboards/ImportarAlumnos.tsx` — Validates CSV `carrera_codigo` against `carreras.codigo` — codes must match what users will type

---

## Approaches

### 1. **Single big migration `009_seed_template_data.sql`** (atomic)
- Pros: One apply, one rollback story, all data ships together
- Cons: ~300-400 lines — tight on the 400-line PR review budget; harder to test in slices
- Effort: **Medium** (1 SQL file, 1 PR)

### 2. **Split by domain: 009_carreras → 010_indicadores → 011_encuestas**
- Pros: Each file ~120-150 lines, well under budget; ordered by dependency; can roll back partial
- Cons: Three PRs to merge, but each is autonomous
- Effort: **Medium** (3 SQL files, 1 chained PR with 3 slices or 3 separate PRs)

### 3. **JSON-driven seed script** (e.g. `supabase/seed.sql` regenerated)
- Pros: Cleaner authoring, version-controllable, easier to maintain
- Cons: Requires a small Node script to convert JSON → SQL; doesn't match the migration file pattern
- Effort: **High** (build pipeline + migration file + script)

### 4. **Two migrations only: 009_carreras+plan, 010_indicadores+encuestas**
- Pros: Half the work of option 2, each still ~150-200 lines
- Cons: Slight coupling between files if reviewers want to bisect
- Effort: **Medium** (2 SQL files)

---

## Recommendation

**Approach 4: Two migrations, split by table ownership.**

- `009_seed_carreras_materias.sql` (~150-200 lines) — 10 `carreras` + 55 `materias` for Informática Plan 2024 + 55 `plan_estudios` rows + ~50 `correlativas` rows
- `010_seed_indicadores_encuestas.sql` (~180-220 lines) — 4 `indicadores` (no `indicador_componentes` needed — the Edge Function reads by substring) + 5 `categorias_pregunta` + 3 `encuestas` (inicial, cuatrimestral, entrevista as template) + ~10 `encuesta_secciones` + ~25 `preguntas` + ~50 `scoring_opciones` + ~5 `scoring_tramos`

Reasoning:
- Keeps both PRs under the 400-line review budget (well under, ~60% of cap each)
- The two halves are independent: a reviewer can ship migration 009 (admin can manage plan) before migration 010 (admin can manage surveys) without functional regression
- No coupling between files — both depend only on existing schema (no FK forward-references)
- Matches the project's existing per-domain file naming pattern (e.g. `004_scoring_tablas.sql`, `007_schema_fixes.sql`)

Avoid Approach 3: the codebase has no JSON→SQL pipeline today, and adding one is scope creep for a seed task. Avoid Approach 1: while atomic, ~400 lines is right at the budget edge and harder to bisect.

---

## Data to Seed — Detailed Inventory

### A. 10 Carreras (all migrations; one row per career)

| Codigo | Nombre (canonical) |
|--------|-------------------|
| `INF` | Ingeniería en Informática |
| `COM` | Ingeniería en Computación |
| `ELE` | Ingeniería Electrónica |
| `ELE` → use `ELEC` | (avoid collision with Ingeniería Eléctrica) — use `ELE` for Electrónica, `ELEC` for Eléctrica |
| `ELC` | Ingeniería Eléctrica |
| `EMC` | Ingeniería Electromecánica |
| `IND` | Ingeniería Industrial |
| `MEC` | Ingeniería Mecánica |
| `QUI` | Ingeniería Química |
| `ALI` | Ingeniería en Alimentos |
| `MAT` | Ingeniería en Materiales |

> **Codification rule**: Use a 3–4 letter code (matching the `carreras.codigo` lookup used by `ImportarAlumnos.tsx` for CSV validation). Need to disambiguate Electrónica vs. Eléctrica. Final codes: `INF`, `COM`, `ELE` (Electrónica), `ELC` (Eléctrica), `EMC`, `IND`, `MEC`, `QUI`, `ALI`, `MAT`.

### B. 55 Materias for Informática Plan 2024 (5 years + 14 optativas)

#### Curso de Ingreso (treated as 1° año 1° cuat, obligatoria)
| Codigo | Nombre | CG | Correlativas |
|--------|--------|----|----|
| `ING0000` | Introducción a la Ciencia y la Ingeniería | 0 | — |

#### 1° Año 1° Cuatrimestre
| Codigo | Nombre | CG | Correlativas |
|--------|--------|----|----|
| `ING6102` | Informática Básica | 4 | ING0000 |
| `INGM101` | Análisis Matemático I | 6 | ING0000 |
| `INGM105` | Álgebra I-B | 4 | ING0000 |
| `ING6301` | Tecnologías Informáticas A | 6 | ING0000 |

#### 1° Año 2° Cuatrimestre
| Codigo | Nombre | CG | Correlativas |
|--------|--------|----|----|
| `ING6201` | Programación A | 8 | INGM101, INGM105, ING6102 |
| `INGM102` | Análisis Matemático II | 5 | INGM101 |
| `INGM106` | Álgebra II | 5 | INGM105 |
| `INGM107` | Introducción a la Matemática Discreta | 4 | INGM105, ING6102 |

#### 2° Año 1° Cuatrimestre
| Codigo | Nombre | CG | Correlativas |
|--------|--------|----|----|
| `ING6202` | Programación B | 8 | ING6201, INGM107 |
| `INGM108` | Probabilidad y Estadística | 4 | INGM102 |
| `INGF101` | Física A | 6 | INGM101, INGM105 |
| `ING6302` | Tecnologías Informáticas B | 6 | ING6301, ING6201 |
| `ING8408` | Inglés I | 3 | ING0000 |

#### 2° Año 2° Cuatrimestre
| Codigo | Nombre | CG | Correlativas |
|--------|--------|----|----|
| `ING6205` | Programación C | 8 | ING6202, ING6302 |
| `ING6203` | Teoría de la Información y la Comunicación | 5 | INGM108, ING6202 |
| `ING6204` | Fundamentos de la Arquitectura de Computadoras | 5 | INGF101, ING6202 |
| `INGF103` | Física B-II | 6 | INGM102, INGM106, INGF101 |
| `ING8409` | Inglés II | 3 | ING8408 |

#### 3° Año 1° Cuatrimestre
| Codigo | Nombre | CG | Correlativas |
|--------|--------|----|----|
| `ING6208` | Fundamentos de los Lenguajes Formales | 4 | ING6202, ING6204 |
| `ING6207` | Estructura y Organización de Datos | 5 | ING6202, ING6203 |
| `ING6303` | Fundamentos de Sistemas Operativos | 6 | ING6204, ING6205 |
| `ING8410` | Investigación de Operaciones | 4 | INGM108 |

#### 3° Año 2° Cuatrimestre
| Codigo | Nombre | CG | Correlativas |
|--------|--------|----|----|
| `ING6305` | Redes y Comunicación de Datos A | 4 | INGF103, ING6303 |
| `ING6304` | Calidad de Software A | 4 | ING6205 |
| `ING6306` | Análisis y Diseño de Sistemas A | 6 | ING6205 |
| `ING8401` | Administración Empresarial en la Economía del Conocimiento | 4 | ING8410 |

#### 4° Año 1° Cuatrimestre
| Codigo | Nombre | CG | Correlativas |
|--------|--------|----|----|
| `ING6307` | Sistemas de Bases de Datos | 6 | ING6205, ING6306, ING6303 |
| `ING6316` | Introducción a la Inteligencia Artificial | 4 | ING6205 |
| `ING6310` | Análisis y Diseño de Sistemas B | 6 | ING6306, ING8401 |
| `ING8402` | Comportamiento Organizacional y Relaciones del Trabajo | 4 | ING6310 |

#### 4° Año 2° Cuatrimestre
| Codigo | Nombre | CG | Correlativas |
|--------|--------|----|----|
| `ING6309` | Redes y Comunicación de Datos B | 4 | ING6305 |
| `ING6312` | Gestión de la Seguridad Informática | 4 | ING6305 |
| `ING6313` | Diseño e Implementación de Sistemas Distribuidos | 4 | ING6309, ING6310 |
| `ING6311` | Calidad de Software B | 4 | ING6304, ING6307, ING6309 |
| `ING6401` | Gestión de Proyectos Informáticos | 4 | ING6310 |

#### 5° Año 1° Cuatrimestre
| Codigo | Nombre | CG | Correlativas |
|--------|--------|----|----|
| `ING6209` | Teoría de Modelos y Simulación | 4 | INGM108, ING6313 |
| `ING6314` | Trabajo Final Integrador | 10 | ING6401 |
| `ING6315` | Auditoría y Homologación | 4 | ING6304, ING6312, ING6401 |
| `ING8405` | Ética, Legislación y Propiedad Intelectual en el Ejercicio Profesional | 4 | ING8401 |

#### 5° Año 2° Cuatrimestre
| Codigo | Nombre | CG | Correlativas |
|--------|--------|----|----|
| `ING8412` | Seguridad y Salud Ocupacional | 4 | ING8402 |

#### Optativas (5° año 2° cuatrimestre, all `tipo='electiva'`)
`ING6324` (Internet de las Cosas), `ING6317` (Software Libre), `ING6318` (Computación en la Nube), `ING6319` (Estimación de Costos de Productos de Software), `ING6320` (Ingeniería de Videojuegos), `ING6321` (Base de Datos Avanzada), `ING4229` (Procesamiento Digital de Imágenes), `ING8515` (Economía de la Innovación y del Conocimiento), `ING8516` (Gestión de Patentes y de la Propiedad Industrial), `ING6325` (Informática Médica), `ING1404` (Técnicas de la Creatividad Aplicada), `ING6322` (Gestión y Automatización de Procesos de Negocios), `ING6323` (Tecnologías BlockChain), `ING8520` (Exploración de Datos para Inteligencia Competitiva).

No correlativas for optativas.

> **Note on "Introducción a la Ciencia y la Ingeniería"**: The doc labels it `(asignatura base / ingreso)` and gives no code. We use code `ING0000` (preserves ING#### convention), 0 CG, and seed it as a normal `plan_estudios` row in 1° año / 1° cuat / obligatoria. This is the cleanest mapping that preserves the FK graph and lets correlativas reference it by code. Alternative: skip it entirely and reference a placeholder — rejected because the FK would dangle.

### C. 4 Indicadores (must match `calcular-score` substring lookup)

| Nombre (exact) | peso | activo |
|----------------|------|--------|
| `Rendimiento Académico` | 40 | true |
| `Encuestas y Bienestar Emocional` | 35 | true |
| `Ralentización Académica` | 15 | true |
| `Alerta de Aislamiento` | 10 | true |

> **Critical**: `calcular-score/index.ts:130-140` matches by `nombre.toLowerCase().includes('académico')` etc. The seeds MUST include those exact keywords. Do NOT rename to "Desempeño" or similar — the Edge Function will not find them. The user mentioned these were "seeded manually" but no migration does this; we codify them.

> **indicador_componentes**: SKIP — the Edge Function ignores this table (only `indicadores` rows are read). Seeding it would be dead data. Flagged as a future enhancement when the admin UI surfaces components.

### D. 5 Categorías_pregunta (score_maximo = cap per category)

| Nombre | descripcion | score_maximo | color | activa |
|--------|-------------|--------------|-------|--------|
| `Emocional` | Estado de ánimo, bienestar psicológico, niveles de ansiedad/estrés | 30 | `#EC4899` | true |
| `Académico` | Confianza en el rendimiento, satisfacción con el estudio, claridad vocacional | 25 | `#3B82F6` | true |
| `Social` | Sentido de pertenencia, integración con pares, apoyo percibido | 15 | `#10B981` | true |
| `Económico` | Presión financiera, horas de trabajo, acceso a recursos | 15 | `#F59E0B` | true |
| `Motivacional` | Engagement, intención de continuar, riesgo de abandono declarado | 15 | `#8B5CF6` | true |

> Sum of caps = 100, matching the 0-100 score scale. Each pregunta response adds `scoring.score` to the matching category's accumulator; the accumulator is capped at `score_maximo`; total bienestar = sum of capped accumulators, then multiplied by `pesoEncuesta` (0.35) to contribute to global score.

### E. 3 Encuestas (inicial, cuatrimestral, entrevista)

> **State convention**: 
> - `inicial`: `activa = true` (gating survey — `useEncuesta` blocks cuatrimestral until this is completed)
> - `cuatrimestral`: `activa = true` (primary feedback loop)
> - `entrevista`: `activa = false` (template; no UI consumer yet — `getEncuestaActiva('entrevista')` is never called by current code)
> - Only ONE encuesta per `tipo` should be active. `getEncuestaActiva` uses `.single()` — two active rows for the same tipo would 500.

#### E.1 Encuesta Inicial (id: `enc-inicial-2026`)
- **Tipo**: `inicial` | **Activa**: `true`
- **Título**: "Encuesta de Ingreso"
- **Descripción**: "Conocerte mejor para acompañarte desde el primer día."
- **Secciones** (1):
  1. **Perfil de Ingreso** (orden 1)
     - P1: `¿Cuántas horas semanales trabajás?` (`unica`, obligatoria, cat. **Económico**)
       - Opciones: `No trabajo` (0 pts), `Hasta 10 horas` (5 pts), `10 a 20 horas` (10 pts), `Más de 20 horas / Full time` (15 pts)
     - P2: `¿Tenés computadora propia para estudiar?` (`unica`, obligatoria, cat. **Económico**)
       - Opciones: `Sí, tengo` (0 pts), `No, comparto o uso de la facu` (10 pts)
     - P3: `¿Cuál es tu principal dificultad esperada?` (`unica`, obligatoria, cat. **Académico**)
       - Opciones: `Ninguna` (0 pts), `Falta de tiempo` (10 pts), `Falta de base matemática/física` (15 pts), `Dificultad económica` (15 pts)
     - P4: `¿Qué esperás de la carrera?` (`texto`, opcional, sin categoría)

#### E.2 Encuesta Cuatrimestral (id: `enc-cuatrimestral-2026`)
- **Tipo**: `cuatrimestral` | **Activa**: `true`
- **Título**: "Encuesta Cuatrimestral"
- **Descripción**: "Tu mirada sobre este cuatrimestre nos ayuda a acompañarte mejor."
- **Secciones** (3):
  1. **Bienestar General** (orden 1)
     - P1: `Del 1 al 10, ¿cómo te sentís con tu rendimiento este cuatrimestre?` (`escala`, obligatoria, cat. **Académico**, min 1, max 10)
       - Tramos (menor=mayor riesgo): `x >= 8` → formula `0`, `x >= 6` → formula `(8 - x) * 5`, `x >= 4` → formula `(8 - x) * 7 + 10`, `x < 4` → formula `30` (capped at score_maximo=25)
     - P2: `¿Ha habido algún cambio significativo en tu vida personal o laboral?` (`texto`, opcional, sin categoría)
     - P3: `¿Te sentís parte de la comunidad de la facultad?` (`unica`, obligatoria, cat. **Social**)
       - Opciones: `Sí, totalmente` (0 pts), `A veces` (5 pts), `Casi nunca` (12 pts), `No, me siento afuera` (15 pts)
     - P4: `¿Pensaste en dejar la carrera este cuatrimestre?` (`unica`, obligatoria, cat. **Motivacional**)
       - Opciones: `Nunca` (0 pts), `Alguna vez` (5 pts), `Varias veces` (10 pts), `Constantemente` (15 pts)
     - P5: `¿Cómo describirías tu nivel de estrés actual?` (`unica`, obligatoria, cat. **Emocional**)
       - Opciones: `Bajo` (0 pts), `Moderado` (5 pts), `Alto` (12 pts), `Muy alto` (20 pts)
  2. **Rendimiento Académico** (orden 2) — note: per-materia cursada state is generated dynamically from `materias_habilitadas` (RPC) and saved via `guardarCursada`, not as `preguntas`
     - P6: `¿Cuántas horas por semana le dedicás al estudio fuera de clase?` (`numerica`, obligatoria, cat. **Académico**, min 0, max 80, unidad `horas/semana`)
       - Tramos: `x >= 20` → `0`, `x >= 10` → `(20 - x) * 1.5`, `x < 10` → `15` (capped at 25)
  3. **Cierre** (orden 3)
     - P7: `Si querés, dejanos un comentario libre` (`texto`, opcional, sin categoría)

> **Issue flagged (out of scope for this seed)**: `EncuestaInicial.tsx:64-67` passes string slugs (`'horas_trabajo'`, etc.) as `pregunta_id` to `guardarRespuesta`. These are NOT valid UUIDs. The seed gives canonical UUIDs (e.g. `a1b2c3d4-...` for the initial hours pregunta) but `EncuestaInicial.tsx` still uses the broken slug pattern. A separate fix-change is required to make the inicial survey read from `encuesta` schema. **This seed migration does NOT fix that TS bug** — it just gives the schema what the UI should be reading.

#### E.3 Encuesta Entrevista (id: `enc-entrevista-template`)
- **Tipo**: `entrevista` | **Activa**: `false` (template; toggled on when an admin opens it)
- **Título**: "Encuesta de Entrevista (template)"
- **Descripción**: "Cuestionario opcional usado durante entrevistas tutor-alumno. Inactivar salvo uso."
- **Secciones** (2):
  1. **Contexto Personal** (orden 1)
     - P1: `¿Cómo te está yendo en general?` (`unica`, obligatoria, cat. **Emocional**)
       - Opciones: `Bien` (0 pts), `Regular` (8 pts), `Mal` (20 pts)
     - P2: `¿Tenés acompañamiento familiar?` (`unica`, obligatoria, cat. **Social**)
       - Opciones: `Sí, mucho` (0 pts), `Algo` (5 pts), `Poco o nada` (12 pts)
  2. **Decisiones y Futuro** (orden 2)
     - P3: `¿Te imaginás recibiéndote?` (`unica`, obligatoria, cat. **Motivacional**)
       - Opciones: `Sí, seguro` (0 pts), `Tal vez` (8 pts), `No lo creo` (15 pts)
     - P4: `¿Comentarios para tu tutor?` (`texto`, opcional, sin categoría)

### F. Suggested migration numbering (orchestrator confirms before apply)

> Per the user's brief: 008 is the manual revert in `supabase/008_revert_schema_fixes.sql` (intentionally outside `migrations/`). Next applied migration is `009`. Recommend split:
>
> - `supabase/migrations/009_seed_carreras_materias.sql`
> - `supabase/migrations/010_seed_indicadores_encuestas.sql`
>
> Each is ~150-220 lines — well under the 400-line review budget. Both are idempotent (`ON CONFLICT DO NOTHING` on PKs / unique constraints). No 011_revert needed unless the user explicitly requests rollback; if so, mirror with `supabase/011_revert_seed_template_data.sql` in root (matching the 008 convention).

---

## Risks

- **High**: The `EncuestaInicial.tsx` slug-as-UUID bug is a SEPARATE issue. After this seed, `EncuestaInicial.tsx` will still fail because it passes `'horas_trabajo'` as `pregunta_id` to `guardarRespuesta`, which violates the FK to `preguntas.id` (UUID). Flagged in fix-db-schema-mismatches/exploration.md finding #13. This seed migration does NOT address that — a follow-up change is needed to make `EncuestaInicial.tsx` use real UUIDs from the loaded encuesta.
- **Medium**: Carrera codes for Electrónica vs. Eléctrica could collide if not carefully prefixed. Recommendation: `ELE` (Electrónica) + `ELC` (Eléctrica). Confirmed with the user via the prompt's emphasis on 10 distinct careers.
- **Medium**: Only one encuesta per `tipo` can be active (because `getEncuestaActiva` uses `.single()`). The seed sets `entrevista.activa = false` to avoid the 500-error trap. If an admin later activates it without deactivating another, the `getEncuestaActiva` call will throw. Consider adding a unique partial index `(tipo) WHERE activa = true` in a future migration.
- **Medium**: The `calcular-score` Edge Function matches indicador names by substring. If anyone renames the seeded indicadores (e.g. "Rendimiento Académico" → "Rendimiento"), the function will silently fall back to the hardcoded 40/35/15/10 defaults. Document this in a comment block inside migration 010.
- **Low**: Optativas are seeded into 5° año / 2° cuat / `tipo='electiva'`. The original doc says "el listado es dinámico; se actualiza según la oferta" — these 14 are the known Plan 2024 list. Admins can add more via `DashPlanAdmin`.
- **Low**: The `EncuestaCuatrimestral` P1 "rendimiento" pregunta uses an escala 1-10 with tramos that add up to ~30 risk points at the worst end, capped at category score_maximo=25. This is intentional to prevent overcounting within a single pregunta.

---

## Ready for Proposal

**Yes** — the inventory is complete, the data is reproducible from `supabase/docs/planesdeestudio.md` and `EXPLICACION_SCORE.md`, and the migration structure is decided. The orchestrator should propose a change named `seed-template-data` with:

1. **Scope**: Two SQL migrations (009 + 010) with the inventory above. No TS changes (EncuestaInicial slug bug is a separate change).
2. **Approach**: Approach 4 (split by domain) — recommended above.
3. **Rollback**: Optional `supabase/011_revert_seed_template_data.sql` (mirror the 008 pattern: drop in reverse order).
4. **Verification**: `tsc --noEmit` (no TS changes → should still pass); after applying, an admin can open `DashPlanAdmin` and see "Ingeniería en Informática" with 55 subjects; `DashEncuestasAdmin` shows 3 surveys (1 active inicial, 1 active cuatrimestral, 1 template entrevista); `getEncuestaActiva('cuatrimestral').single()` does not throw; `calcular-score` finds the 4 indicators by substring.
5. **Excluded**: NO `indicador_componentes` rows (Edge Function doesn't read them); NO `usuarios` / `estudiantes` / `progreso_estudiante` rows (those are per-deployment, not template data); NO sample `scores` / `alertas` (those are runtime-generated).
