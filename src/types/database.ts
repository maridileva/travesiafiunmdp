export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface CategoriaPregunta {
  id: string;
  nombre: string;
  descripcion: string | null;
  score_maximo: number;
  color: string;
  activa: boolean;
  created_at: string;
}

export interface ScoringOpcion {
  id: string;
  pregunta_id: string;
  opcion_valor: string;
  score: number;
}

export interface Pregunta {
  id: string;
  seccion_id: string | null;
  texto: string;
  descripcion: string | null;
  tipo: 'texto' | 'multiple' | 'unica' | 'escala' | 'numerica';
  es_obligatoria: boolean;
  opciones: string[] | null;
  peso_defecto: number;
  orden: number;
  categoria_id: string | null;
  valor_minimo: number | null;
  valor_maximo: number | null;
  unidad: string | null;
  created_at: string;
}

export interface ScoringTramo {
  id: string;
  pregunta_id: string;
  orden: number;
  condicion_tipo: 'menor' | 'menor_igual' | 'mayor' | 'mayor_igual' | 'igual' | 'entre';
  condicion_valor: number | null;
  condicion_valor_min: number | null;
  condicion_valor_max: number | null;
  formula: string;
}
