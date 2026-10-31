/**
 * ============================================================================
 * CAPA 1: GRAFO DE PENSAMIENTO (DOCUMENT GRAPH)
 * ============================================================================
 * Modela el conocimiento como un grafo vivo de nodos y corrientes de pensamiento:
 * - Almacena las ideas atómicas (ThoughtNode).
 * - Almacena los cauces de corriente narrativa entre ideas (ConnectionBridge).
 * - Calcula la topología del Río Narrativo: Manantial (01) -> Afluentes (02) -> Desembocadura (03).
 * - Entrega las ideas ordenadas según la corriente para alimentar la prosa de Cristal.
 */

import { ThoughtNode, Vector2D, ConnectionBridge } from './types';

export type GraphChangeListener = (nodes: ThoughtNode[], bridges: ConnectionBridge[]) => void;

export interface NodeFlowRole {
  role: 'source' | 'flow' | 'drain' | 'isolated';
  sequenceNumber?: number;
  sequenceTitle: string;
}

export class DocumentGraph {
  private nodes: Map<string, ThoughtNode> = new Map();
  private bridges: Map<string, ConnectionBridge> = new Map();
  private listeners: Set<GraphChangeListener> = new Set();

  constructor(initialNodes?: ThoughtNode[], initialBridges?: ConnectionBridge[]) {
    if (initialNodes) {
      initialNodes.forEach((node) => this.nodes.set(node.id, node));
    }
    if (initialBridges) {
      initialBridges.forEach((bridge) => this.bridges.set(bridge.id, bridge));
    }
  }

  /**
   * Obtiene todos los nodos del grafo como un arreglo inmutable.
   */
  public getAllNodes(): ThoughtNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Obtiene todas las corrientes/puentes activos en el grafo.
   */
  public getBridges(): ConnectionBridge[] {
    return Array.from(this.bridges.values());
  }

  /**
   * Obtiene únicamente los nodos de materia prima vírgenes (aún no consumidos ni integrados).
   */
  public getAvailableRawNodes(): ThoughtNode[] {
    return Array.from(this.nodes.values()).filter(
      (node) => !node.consumed && node.text.trim().length > 0
    );
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
   * Establece un cauce de corriente deliberado entre dos ideas (A -> B).
   */
  public addBridge(sourceId: string, targetId: string, label?: string): ConnectionBridge | null {
    if (sourceId === targetId) return null;
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) return null;

    // Evita duplicar el mismo puente en la misma dirección
    for (const b of this.bridges.values()) {
      if (b.sourceId === sourceId && b.targetId === targetId) {
        return b;
      }
    }

    const bridge: ConnectionBridge = {
      id: `${sourceId}->${targetId}`,
      sourceId,
      targetId,
      label,
      timestamp: Date.now()
    };

    this.bridges.set(bridge.id, bridge);
    this.notify();
    return bridge;
  }

  /**
   * Elimina un cauce/puente de corriente específico.
   */
  public removeBridge(id: string): void {
    if (this.bridges.delete(id)) {
      this.notify();
    }
  }

  /**
   * Alterna la conexión entre dos nodos (crea si no existe, o corta si ya existía).
   */
  public toggleBridge(sourceId: string, targetId: string): boolean {
    const existingKey = `${sourceId}->${targetId}`;
    if (this.bridges.has(existingKey)) {
      this.bridges.delete(existingKey);
      this.notify();
      return false; // Desconectado
    }

    // Comprueba también si existía en dirección contraria y la invierte
    const reverseKey = `${targetId}->${sourceId}`;
    if (this.bridges.has(reverseKey)) {
      this.bridges.delete(reverseKey);
    }

    this.addBridge(sourceId, targetId);
    return true; // Conectado
  }

  /**
   * Calcula el rol de una idea dentro de la corriente viva:
   * - 'source' (01 · Manantial): Comienzo del río narrativo.
   * - 'flow'   (02 · Afluente): Eslabón intermedio en la corriente.
   * - 'drain'  (03 · Desembocadura): Desenlace / llegada del argumento.
   * - 'isolated': Idea libre sin cauce asignado todavía.
   */
  public getNodeFlowRole(nodeId: string): NodeFlowRole {
    const ordered = this.getOrderedFlowNodes();
    const indexInFlow = ordered.findIndex((n) => n.id === nodeId);

    const incoming = Array.from(this.bridges.values()).filter((b) => b.targetId === nodeId);
    const outgoing = Array.from(this.bridges.values()).filter((b) => b.sourceId === nodeId);

    if (incoming.length === 0 && outgoing.length === 0) {
      return {
        role: 'isolated',
        sequenceTitle: ''
      };
    }

    const seqNum = indexInFlow !== -1 ? indexInFlow + 1 : 1;
    const padded = seqNum.toString().padStart(2, '0');

    if (incoming.length === 0 && outgoing.length > 0) {
      return {
        role: 'source',
        sequenceNumber: seqNum,
        sequenceTitle: `${padded} · Manantial`
      };
    }

    if (incoming.length > 0 && outgoing.length > 0) {
      return {
        role: 'flow',
        sequenceNumber: seqNum,
        sequenceTitle: `${padded} · Afluente`
      };
    }

    return {
      role: 'drain',
      sequenceNumber: seqNum,
      sequenceTitle: `${padded} · Desembocadura`
    };
  }

  /**
   * Devuelve las ideas ordenadas según la corriente hidráulica del argumento:
   * Recorre la cadena $A -> B -> C$ para que desemboquen en orden lógico en Cristal.
   */
  public getOrderedFlowNodes(): ThoughtNode[] {
    const all = Array.from(this.nodes.values()).filter(
      (node) => !node.consumed && node.text.trim().length > 0
    );

    if (this.bridges.size === 0) {
      return all;
    }

    // Calcula grado de entrada (cuántas conexiones llegan a cada nodo)
    const inDegree = new Map<string, number>();
    const outMap = new Map<string, string[]>();

    all.forEach((n) => {
      inDegree.set(n.id, 0);
      outMap.set(n.id, []);
    });

    for (const b of this.bridges.values()) {
      if (inDegree.has(b.targetId)) {
        inDegree.set(b.targetId, (inDegree.get(b.targetId) || 0) + 1);
      }
      if (outMap.has(b.sourceId)) {
        outMap.get(b.sourceId)!.push(b.targetId);
      }
    }

    const visited = new Set<string>();
    const ordered: ThoughtNode[] = [];

    // 1. Empezar por los manantiales (inDegree === 0 pero con salidas)
    const sources = all.filter(
      (n) => (inDegree.get(n.id) || 0) === 0 && (outMap.get(n.id)?.length || 0) > 0
    );

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (node && !node.consumed) {
        ordered.push(node);
      }
      const children = outMap.get(nodeId) || [];
      for (const childId of children) {
        traverse(childId);
      }
    };

    sources.forEach((s) => traverse(s.id));

    // 2. Añadir cualquier otro nodo conectado no visitado aún
    all.forEach((n) => {
      const isConnected =
        (inDegree.get(n.id) || 0) > 0 || (outMap.get(n.id)?.length || 0) > 0;
      if (isConnected && !visited.has(n.id)) {
        traverse(n.id);
      }
    });

    // 3. Añadir finalmente las ideas libres / aisladas
    all.forEach((n) => {
      if (!visited.has(n.id)) {
        ordered.push(n);
      }
    });

    return ordered;
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
   * Elimina una idea del grafo junto con los puentes que la tocaban.
   */
  public removeNode(id: string): void {
    if (this.nodes.delete(id)) {
      // Elimina cualquier puente asociado a este nodo
      for (const [bridgeId, b] of Array.from(this.bridges.entries())) {
        if (b.sourceId === id || b.targetId === id) {
          this.bridges.delete(bridgeId);
        }
      }
      this.notify();
    }
  }

  /**
   * Suscribe un observador para reaccionar a cualquier cambio en el grafo.
   */
  public subscribe(listener: GraphChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifica a todos los suscriptores cuando los datos cambian.
   */
  private notify(): void {
    const allNodes = this.getAllNodes();
    const allBridges = this.getBridges();
    this.listeners.forEach((fn) => fn(allNodes, allBridges));
  }
}
