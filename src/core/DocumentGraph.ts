/**
 * ============================================================================
 * CAPA 1: GRAFO DE PENSAMIENTO (DOCUMENT GRAPH)
 * ============================================================================
 * Modela el conocimiento como un grafo de nodos interconectados.
 * No depende de ningún framework, ni de HTML, ni de Canvas.
 * Permite añadir ideas, moverlas, editarlas y escuchar eventos de cambio.
 */

import { ThoughtNode, Vector2D } from './types';

export type GraphChangeListener = (nodes: ThoughtNode[]) => void;

export class DocumentGraph {
  private nodes: Map<string, ThoughtNode> = new Map();
  private listeners: Set<GraphChangeListener> = new Set();

  constructor(initialNodes?: ThoughtNode[]) {
    if (initialNodes) {
      initialNodes.forEach(node => this.nodes.set(node.id, node));
    }
  }

  /**
   * Obtiene todos los nodos del grafo como un arreglo inmutable.
   */
  public getAllNodes(): ThoughtNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Obtiene únicamente los nodos de materia prima vírgenes (aún no consumidos ni integrados).
   */
  public getAvailableRawNodes(): ThoughtNode[] {
    return Array.from(this.nodes.values()).filter(node => !node.consumed && node.text.trim().length > 0);
  }

  /**
   * Obtiene un nodo por su identificador único.
   */
  public getNode(id: string): ThoughtNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Añade una nueva idea al éter en la coordenada especificada.
   */
  public addNode(text: string, position: Vector2D, tag: string = 'Intuición'): ThoughtNode {
    const newNode: ThoughtNode = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      tag,
      text,
      position: { ...position },
      velocity: { x: 0, y: 0 },
      timestamp: Date.now(),
      consumed: false
    };

    this.nodes.set(newNode.id, newNode);
    this.notify();
    return newNode;
  }

  /**
   * Marca una idea como consumida (ya integrada en el cristal del ensayo).
   */
  public markAsConsumed(id: string): void {
    const node = this.nodes.get(id);
    if (node && !node.consumed) {
      node.consumed = true;
      this.notify();
    }
  }

  /**
   * Actualiza el texto de una idea existente.
   */
  public updateNodeText(id: string, text: string): void {
    const node = this.nodes.get(id);
    if (node) {
      node.text = text;
      this.notify();
    }
  }

  /**
   * Actualiza la posición de una idea en el espacio infinito.
   */
  public updateNodePosition(id: string, position: Vector2D): void {
    const node = this.nodes.get(id);
    if (node) {
      node.position = { ...position };
      this.notify();
    }
  }

  /**
   * Elimina una idea del grafo.
   */
  public removeNode(id: string): void {
    if (this.nodes.delete(id)) {
      this.notify();
    }
  }

  /**
   * Suscribe un observador para reaccionar a cualquier cambio en el grafo.
   */
  public subscribe(listener: GraphChangeListener): () => void {
    this.listeners.add(listener);
    // Retorna una función para cancelar la suscripción
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifica a todos los suscriptores cuando los datos cambian.
   */
  private notify(): void {
    const all = this.getAllNodes();
    this.listeners.forEach(fn => fn(all));
  }
}
