# Archive Report: fix-db-schema-mismatches

**Status**: Complete
**Date**: 2026-06-27
**Verdict**: PASS — all 22 tasks complete, verification passed

## Summary

Fixed all database schema mismatches between Supabase migrations and TypeScript frontend code. Applied 7 migrations (000-007) to local development database. Modified 10 source files.

## Changes Applied

### Migrations
| File | Changes |
|------|---------|
| `000_base_de_datos.sql` | Added GRANTs for all tables, renamed obligatoria→es_obligatoria, added missing preguntas columns |
| `004_scoring_tablas.sql` | Created (new): scoring_opciones, scoring_tramos, categorias_pregunta tables + GRANTs |
| `005_rls_scoring_categorias.sql` | Renamed from 004 (version conflict fix) |
| `006_schema_inicial.sql` | Renamed from 001/005 (version conflict fix) |
| `007_schema_fixes.sql` | Created: GRANT EXECUTE is_admin(), 14 RLS policies, realtime expansion, DROP escala cols, get_distribucion_cohorte RPC |

### TypeScript
| File | Changes |
|------|---------|
| `src/types/database.ts` | Added DistribucionCohorte interface |
| `src/services/encuestasService.ts` | Updated SELECT columns (es_obligatoria, valor_minimo, valor_maximo, descripcion) |
| `src/services/scoresService.ts` | Added getDistribucionCohorte() using .rpc() |
| `src/hooks/useScore.ts` | Typed state as DistribucionCohorte |
| `src/components/dashboards/EncuestaEditor.tsx` | Write payload uses valor_minimo/valor_maximo, added descripcion save, read mapping |
| `src/components/dashboards/Encuestas.tsx` | Split aprobada/desaprobada routing to progreso_estudiante+finales |
| `src/components/dashboards/DashAdmin.tsx` | NaN coercion guards on KPI values |
| `supabase/functions/guardar-preguntas/index.ts` | Renamed escala→valor columns |

### Rollback
| File | Location |
|------|----------|
| `008_revert_schema_fixes.sql` | supabase/ (outside migrations/) |

## Issues Fixed
1. 14 tables had RLS enabled but zero policies → added own-row OR admin policies
2. `is_admin()` function missing GRANT EXECUTE → all RLS policies silently denied access
3. preguntas columns missing (descripcion, valor_minimo, valor_maximo, unidad, created_at)
4. preguntas CHECK constraint missing 'numerica' type
5. Column name mismatch: obligatoria vs es_obligatoria
6. Column name mismatch: escala_min/max vs valor_minimo/maximo
7. GRANT permissions missing for authenticated role on all tables
8. usuario_roles RLS policies missing (blocked login)
9. cursadas.situacion routing split for aprobada/desaprobada
10. DashAdmin NaN in KPI display

## Verification
- tsc --noEmit: PASS
- DB reset: PASS (all 7 migrations applied)
- RLS policies: 14/14 present
- Column references: zero remaining old names in src/

## Warnings (Accepted)
- W1: descripcion save payload — fixed post-verify
- W2: Rollback migration exists outside migrations/ (intentional, prevents auto-apply)
- W3: Dropdown shows aprobada/desaprobada — UX design choice, routing handles correctly
