/**
 * ============================================================================
 * CAPA 1: MODELO DE DATOS Y TIPOS FUNDACIONALES (CORE TYPES)
 * ============================================================================
 * Define el vocabulario ontológico del editor.
 * Estos tipos son puros e independientes de la interfaz gráfica y del DOM.
 */

/**
 * Los cuatro estados ontológicos posibles del sistema:
 * - 'portal': Pantalla de bienvenida con la pregunta y los 3 orbes vivos.
 * - 'vapor': Captura caótica, fragmentos ingrávidos, notas y lluvia de ideas.
 * - 'liquid': Flujo conectivo, corrientes semánticas y puentes de tensión.
 * - 'crystal': Materia sólida, prosa editorial calibrada y foco monástico.
 */
export type Phase = 'portal' | 'vapor' | 'liquid' | 'crystal';

/**
 * Coordenada bidimensional matemática en el espacio infinito del lienzo.
 */
export interface Vector2D {
  x: number;
  y: number;
}

/**
 * Nodo de Pensamiento individual.
 * Es la unidad atómica de una idea dentro del grafo de conocimiento.
 */
export interface ThoughtNode {
  /** Identificador único inmutable */
  id: string;
  /** Etiqueta semántica o categoría conceptual (ej: 'Intuición', 'Tensión') */
  tag: string;
  /** Contenido textual vivo del pensamiento */
  text: string;
  /** Posición en el lienzo infinito (coordenadas del mundo) */
  position: Vector2D;
  /** Velocidad física (para inercia y amortiguación elástica) */
  velocity?: Vector2D;
  /** Estado de densidad en el que nació la nota */
  phase?: Phase;
  /** Marca temporal de creación (para el río temporal continuo) */
  timestamp: number;
  /** Indica si la idea ya ha sido consumida e integrada en la prosa de Cristal */
  consumed?: boolean;
}

/**
 * Puente o filamento de tensión semántica entre dos ideas en estado Fluido.
 */
export interface ConnectionBridge {
  sourceId: string;
  targetId: string;
  /** Nivel de afinidad semántica (0.0 a 1.0) */
  tension: number;
  /** Distancia calculada en tiempo real entre los dos nodos */
  distance: number;
}

/**
 * Elemento o viruta de texto rescatada en el Margen de Descartes.
 * Almacena el fragmento descartado para permitir su recuperación inmediata.
 */
export interface DiscardItem {
  id: string;
  text: string;
  timestamp: number;
  originalY?: number;
}

/**
 * Estado global del documento continuo.
 */
export interface DocumentState {
  currentPhase: Phase;
  nodes: ThoughtNode[];
  activeNodeId: string | null;
  editorialTitle: string;
  editorialBody: string;
  isAudioEnabled: boolean;
}
