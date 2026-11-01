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
  private riverTopologyChanged: boolean = false;

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
      (node) => !node.consumed && !node.inDocument && node.text.trim().length > 0
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
  public addNode(
    text: string,
    position: Vector2D,
    tag: string = 'Intuición',
    inDocument: boolean = false
  ): ThoughtNode {
    const newNode: ThoughtNode = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      tag,
      text,
      position: { ...position },
      vaporPosition: { ...position },
      liquidPosition: { ...position },
      velocity: { x: 0, y: 0 },
      timestamp: Date.now(),
      consumed: false,
      inDocument
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
    this.riverTopologyChanged = true;

    // Al enlazar dos ideas en la corriente del río, pasan a formar parte del documento vivo
    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);
    if (sourceNode) sourceNode.inDocument = true;
    if (targetNode) targetNode.inDocument = true;

    this.notify();
    return bridge;
  }

  /**
   * Elimina un cauce/puente de corriente específico.
   */
  public removeBridge(id: string): void {
    if (this.bridges.delete(id)) {
      this.riverTopologyChanged = true;
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
      this.riverTopologyChanged = true;
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
   * Indica si la topología del río (puentes) fue modificada deliberadamente en Fluido.
   */
  public hasRiverTopologyChanged(): boolean {
    return this.riverTopologyChanged;
  }

  /**
   * Reinicia la bandera de topología tras solidificar hacia Cristal.
   */
  public resetRiverTopologyChanged(): void {
    this.riverTopologyChanged = false;
  }

  /**
   * Hidrata y reconstruye el grafo en caliente a partir de una instantánea persistida.
   */
  public hydrate(nodes: ThoughtNode[], bridges: ConnectionBridge[] = []): void {
    this.nodes.clear();
    this.bridges.clear();

    nodes.forEach((node) => {
      const pos = node.position || { x: 0, y: 0 };
      const vaporPos = node.vaporPosition || { ...pos };
      const liquidPos = node.liquidPosition || { ...pos };

      this.nodes.set(node.id, {
        ...node,
        position: { ...pos },
        vaporPosition: { ...vaporPos },
        liquidPosition: { ...liquidPos },
        velocity: node.velocity || { x: 0, y: 0 },
        consumed: !!node.consumed,
        inDocument: !!node.inDocument
      });
    });

    bridges.forEach((bridge) => {
      if (this.nodes.has(bridge.sourceId) && this.nodes.has(bridge.targetId)) {
        this.bridges.set(bridge.id, bridge);
      }
    });

    this.riverTopologyChanged = true;
    this.notify();
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
      // Si no hay puentes, solo los nodos que explícitamente forman parte del documento
      return all.filter((n) => n.inDocument);
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

    // 3. Solo añadir ideas que ya pertenecían al documento si quedaron temporalmente sin conectar
    // Las chispas libres de Niebla (!n.inDocument sin puentes) NUNCA se agregan automáticamente al río
    all.forEach((n) => {
      if (n.inDocument && !visited.has(n.id)) {
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
   * Actualiza la posición de una idea en el espacio infinito según la fase activa.
   */
  public updateNodePosition(id: string, position: Vector2D, phase?: string): void {
    const node = this.nodes.get(id);
    if (node) {
      node.position = { ...position };
      if (phase === 'vapor') {
        node.vaporPosition = { ...position };
      } else if (phase === 'liquid') {
        node.liquidPosition = { ...position };
      }
      this.notify();
    }
  }

  /**
   * Sincroniza la posición activa de todos los nodos al entrar en una fase determinada,
   * garantizando independencia espacial absoluta entre el lienzo de Niebla y el de Fluido.
   */
  public syncPositionsForPhase(phase: 'vapor' | 'liquid'): void {
    for (const node of this.nodes.values()) {
      if (phase === 'vapor') {
        if (!node.vaporPosition) {
          node.vaporPosition = { ...node.position };
        }
        node.position = { ...node.vaporPosition };
      } else if (phase === 'liquid') {
        if (!node.liquidPosition) {
          node.liquidPosition = { ...node.position };
        }
        node.position = { ...node.liquidPosition };
      }
    }
    this.notify();
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
   * Encuentra una coordenada libre en el espacio para evitar que las tarjetas se solapen.
   */
  public findClearPosition(
    targetPos: Vector2D,
    excludeId?: string,
    minDx: number = 380,
    minDy: number = 260
  ): Vector2D {
    const otherNodes = Array.from(this.nodes.values()).filter((n) => n.id !== excludeId);
    if (otherNodes.length === 0) return { ...targetPos };

    let candidate = { ...targetPos };
    let attempts = 0;
    const maxAttempts = 36;

    while (attempts < maxAttempts) {
      const colliding = otherNodes.find(
        (n) =>
          Math.abs(n.position.x - candidate.x) < minDx &&
          Math.abs(n.position.y - candidate.y) < minDy
      );

      if (!colliding) {
        return candidate;
      }

      attempts++;
      // Espiral de búsqueda áurea para encontrar orillas despejadas alrededor del río
      const angle = attempts * 1.047; // ~60 grados
      const layer = Math.floor((attempts - 1) / 6) + 1;
      const radiusX = layer * minDx;
      const radiusY = layer * minDy;

      candidate = {
        x: targetPos.x + Math.cos(angle) * radiusX,
        y: targetPos.y + Math.sin(angle) * radiusY
      };
    }

    return candidate;
  }

  /**
   * Desplaza suavemente cualquier tarjeta en el lienzo que coincida espacialmente
   * con otra para que nunca queden tapadas, ocultas ni sobrepuestas en el río.
   */
  public disperseCollidingSparks(): boolean {
    const allNodes = Array.from(this.nodes.values());
    let changed = false;

    for (let i = 0; i < allNodes.length; i++) {
      const nodeA = allNodes[i];
      for (let j = 0; j < i; j++) {
        const nodeB = allNodes[j];
        const dx = Math.abs(nodeA.position.x - nodeB.position.x);
        const dy = Math.abs(nodeA.position.y - nodeB.position.y);
        if (dx < 360 && dy < 220) {
          // Si colisionan, calculamos una posición despejada en espiral para el nodo A
          const newPos = this.findClearPosition(nodeA.position, nodeA.id, 360, 220);
          nodeA.position = newPos;
          nodeA.liquidPosition = { ...newPos };
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      this.notify();
    }
    return changed;
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
