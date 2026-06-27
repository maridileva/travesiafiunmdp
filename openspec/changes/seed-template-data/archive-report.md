# Archive Report: seed-template-data

**Status**: Complete
**Date**: 2026-06-27
**Verdict**: PASS — all seeded data verified

## Summary
Created 2 seed migrations that populate the database with template data: 10 carreras, 55 materias (Informática Plan 2024), 62 correlativas, 4 indicadores, 3 encuesta templates with sections, 19 preguntas, 5 categorías, 35 scoring_opciones, and 17 scoring_tramos.

## Migrations Created
| Migration | Purpose |
|-----------|---------|
| `009_seed_carreras_materias.sql` | 10 carreras + Informática Plan 2024 (subjects, plan, correlatividades) |
| `010_seed_indicadores_encuestas.sql` | 4 indicadores + components + 3 encuesta templates + scoring |

## Verified Counts
| Entity | Count | Status |
|--------|-------|--------|
| Carreras | 10 | ✅ |
| Materias | 55 | ✅ |
| Plan_Estudios | 55 | ✅ |
| Correlativas | 62 | ✅ |
| Indicadores | 4 | ✅ (weights sum 100%) |
| Indicador Componentes | 9 | ✅ |
| Encuestas | 3 | ✅ |
| Encuesta Secciones | 5 | ✅ |
| Preguntas | 19 | ✅ |
| Categorías Pregunta | 5 | ✅ |
| Scoring Opciones | 35 | ✅ |
| Scoring Tramos | 17 | ✅ |

## Edge Function Contract
Indicador names match the `calcular-score` Edge Function substring keywords: "Académico", "Emocional", "Ralentización", "Aislamiento".

## Verification
- `tsc --noEmit`: PASS (zero errors)
- `supabase db reset`: PASS (all 10 migrations applied cleanly)
- Admin user: recreated (admin@travesia.com / Admin123!)
