/**
 * ============================================================================
 * CAPA 3: PUENTE DE PROYECCIÓN DOM (DOM PROJECTION BRIDGE)
 * ============================================================================
 * El corazón de la arquitectura híbrida:
 * Sincroniza las coordenadas matemáticas del mundo cósmico (Canvas) con los elementos HTML del DOM.
 * Gestiona el ciclo de vida de las tarjetas vivas mediante reconciliación reactiva por ID.
 * Proyecta la posición y escala de las tarjetas según el movimiento y zoom continuo de la cámara.
 * Pilar 1: Orquesta el trazado de corrientes vivas (Río Narrativo) entre tarjetas en modo Fluido.
 */

import { DocumentGraph } from '../core/DocumentGraph';
import { StateMachine } from '../core/StateMachine';
import { HarmonicSynthesizer } from '../audio/HarmonicSynthesizer';
import { Camera } from '../engine/Camera';
import { Vector2D } from '../core/types';
import { ThoughtCardElement } from './cards/ThoughtCardElement';

export class DomProjectionBridge {
  private container: HTMLDivElement;
  private camera: Camera;
  private graph: DocumentGraph;
  private stateMachine: StateMachine;
  private audio: HarmonicSynthesizer;
  private cardInstances: Map<string, ThoughtCardElement> = new Map();
  private connectingSourceNodeId: string | null = null;
  private onDragStreamChangeCallback?: (
    stream: { sourcePos: Vector2D; currentPos: Vector2D } | null
  ) => void;

  constructor(
    container: HTMLDivElement,
    camera: Camera,
    graph: DocumentGraph,
    stateMachine: StateMachine,
    audio: HarmonicSynthesizer,
    onDragStreamChange?: (stream: { sourcePos: Vector2D; currentPos: Vector2D } | null) => void
  ) {
    this.container = container;
    this.camera = camera;
    this.graph = graph;
    this.stateMachine = stateMachine;
    this.audio = audio;
    this.onDragStreamChangeCallback = onDragStreamChange;

    // Reactividad a cambios en el grafo de datos
    this.graph.subscribe(() => this.sync());

    // Reactividad a movimientos y zoom focal de la cámara 2D (120 FPS)
    this.camera.onChange(() => this.updateAllProjections());

    // Clic en el fondo del lienzo o tecla Escape cancela la conexión activa
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.connectingSourceNodeId) {
        this.clearConnectingState();
      }
    });

    const canvas = document.getElementById('canvas-layer');
    if (canvas) {
      canvas.addEventListener('click', () => {
        if (this.connectingSourceNodeId) {
          this.clearConnectingState();
        }
      });
    }

    // Vía 3: El Hilo Gestual interactivo sigue al cursor en tiempo real por el canvas
    window.addEventListener('mousemove', (e) => {
      if (!this.connectingSourceNodeId) return;
      const sourceNode = this.graph.getNode(this.connectingSourceNodeId);
      if (!sourceNode) return;

      const currentWorldPos = this.camera.screenToWorld({ x: e.clientX, y: e.clientY });
      this.onDragStreamChangeCallback?.({
        sourcePos: { ...sourceNode.position },
        currentPos: currentWorldPos
      });
    });
  }

  /**
   * Limpia el estado de conexión activa en curso.
   */
  public clearConnectingState(): void {
    if (this.connectingSourceNodeId) {
      const sourceCard = this.cardInstances.get(this.connectingSourceNodeId);
      sourceCard?.setConnecting(false);
      this.connectingSourceNodeId = null;
      this.onDragStreamChangeCallback?.(null);
    }
  }

  /**
   * Conecta los escuchadores interactivos para el trazado de corrientes en la tarjeta.
   */
  private setupCardListeners(card: ThoughtCardElement): void {
    card.onPortClick((nodeId) => {
      if (this.connectingSourceNodeId === null) {
        // 1. Inicia la conexión desde esta tarjeta
        this.connectingSourceNodeId = nodeId;
        card.setConnecting(true);
        this.audio.play(432, 'triangle', 0.45, 0.12);
      } else if (this.connectingSourceNodeId === nodeId) {
        // Clic en la misma tarjeta cancela
        this.clearConnectingState();
        this.audio.play(260, 'sine', 0.2, 0.08);
      } else {
        // 2. Clic en otra tarjeta: completa el río narrativo A -> B
        this.graph.toggleBridge(this.connectingSourceNodeId, nodeId);
        this.audio.play(528, 'sine', 0.5, 0.16);
        this.clearConnectingState();
        this.sync();
      }
    });

    card.onCardClick((nodeId) => {
      // Si había una conexión pendiente y se hace clic en el cuerpo de otra tarjeta, se conecta
      if (this.connectingSourceNodeId && this.connectingSourceNodeId !== nodeId) {
        this.graph.toggleBridge(this.connectingSourceNodeId, nodeId);
        this.audio.play(528, 'sine', 0.5, 0.16);
        this.clearConnectingState();
        this.sync();
      }
    });
  }

  /**
   * Actualiza la proyección en pantalla de todas las tarjetas activas.
   */
  public updateAllProjections(): void {
    const phase = this.stateMachine.getPhase();
    if (phase !== 'vapor' && phase !== 'liquid') return;

    for (const card of this.cardInstances.values()) {
      card.updateProjection(this.camera);
    }
  }

  /**
   * Sincroniza las tarjetas en pantalla con el grafo sin destruir elementos existentes.
   */
  public sync(): void {
    const phase = this.stateMachine.getPhase();

    // En portal o cristal, las tarjetas espaciales se ocultan limpiamente
    if (phase === 'portal' || phase === 'crystal') {
      this.container.innerHTML = '';
      this.cardInstances.clear();
      this.clearConnectingState();
      return;
    }

    // Filtrado ontológico según la fase:
    // En Niebla ('vapor'): Cielo limpio y libre. SOLO ideas vírgenes / chispas que NO forman parte del documento.
    // En Fluido ('liquid'): Todas las ideas (el río documental conectado + chispas libres disponibles para conectar).
    const allNodes = this.graph.getAllNodes();
    const currentNodes = phase === 'vapor'
      ? allNodes.filter((n) => !n.inDocument)
      : allNodes;

    const currentIds = new Set(currentNodes.map((n) => n.id));

    // 1. Elimina únicamente las tarjetas que fueron borradas del grafo
    for (const [id, card] of this.cardInstances.entries()) {
      if (!currentIds.has(id)) {
        card.element.remove();
        this.cardInstances.delete(id);
      }
    }

    // 2. Reconcilia o crea las tarjetas existentes sin tocar el DOM enfocado
    currentNodes.forEach((node) => {
      const existingCard = this.cardInstances.get(node.id);

      if (existingCard) {
        existingCard.updatePhase(phase);
        existingCard.updateProjection(this.camera);
        existingCard.updateTextIfExternal(node.text);
      } else {
        const isNewAndEmpty = node.text === '';
        const newCard = new ThoughtCardElement(node, phase, this.graph, this.audio, this.camera);
        this.setupCardListeners(newCard);
        this.cardInstances.set(node.id, newCard);
        this.container.appendChild(newCard.element);
        newCard.updateProjection(this.camera);

        if (isNewAndEmpty) {
          setTimeout(() => newCard.focus(), 25);
        }
      }
    });
  }
}
