/**
 * ============================================================================
 * CAPA 3: PUENTE DE PROYECCIÓN DOM (DOM PROJECTION BRIDGE)
 * ============================================================================
 * El corazón de la arquitectura híbrida:
 * Sincroniza las coordenadas matemáticas del mundo (Canvas) con los elementos HTML del DOM.
 * Gestiona el ciclo de vida de las tarjetas vivas mediante reconciliación por ID,
 * evitando la destrucción destructiva del DOM para que el foco no se pierda al escribir.
 */

import { DocumentGraph } from '../core/DocumentGraph';
import { StateMachine } from '../core/StateMachine';
import { HarmonicSynthesizer } from '../audio/HarmonicSynthesizer';
import { ThoughtCardElement } from './cards/ThoughtCardElement';

export class DomProjectionBridge {
  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private graph: DocumentGraph;
  private stateMachine: StateMachine;
  private audio: HarmonicSynthesizer;
  private cardInstances: Map<string, ThoughtCardElement> = new Map();

  constructor(
    container: HTMLDivElement,
    canvas: HTMLCanvasElement,
    graph: DocumentGraph,
    stateMachine: StateMachine,
    audio: HarmonicSynthesizer
  ) {
    this.container = container;
    this.canvas = canvas;
    this.graph = graph;
    this.stateMachine = stateMachine;
    this.audio = audio;

    this.bindCanvasClick();
    this.graph.subscribe(() => this.sync());
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
      return;
    }

    const currentNodes = this.graph.getAllNodes();
    const currentIds = new Set(currentNodes.map(n => n.id));

    // 1. Elimina únicamente las tarjetas que fueron borradas del grafo
    for (const [id, card] of this.cardInstances.entries()) {
      if (!currentIds.has(id)) {
        card.element.remove();
        this.cardInstances.delete(id);
      }
    }

    // 2. Reconcilia o crea las tarjetas existentes sin tocar el DOM enfocado
    currentNodes.forEach(node => {
      const existingCard = this.cardInstances.get(node.id);

      if (existingCard) {
        // La tarjeta ya existe: actualizamos su fase y posición sin recrear el DOM
        existingCard.updatePhase(phase);
        existingCard.updatePosition(node.position.x, node.position.y);
        existingCard.updateTextIfExternal(node.text);
      } else {
        // Tarjeta nueva: se instancia y se añade al contenedor
        const newCard = new ThoughtCardElement(node, phase, this.graph, this.audio);
        this.cardInstances.set(node.id, newCard);
        this.container.appendChild(newCard.element);
      }
    });
  }

  /**
   * Permite hacer clic en cualquier punto vacío del lienzo para condensar una idea in-situ.
   */
  private bindCanvasClick(): void {
    this.canvas.addEventListener('click', (e) => {
      const phase = this.stateMachine.getPhase();
      if (phase !== 'vapor' && phase !== 'liquid') return;

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const tag = phase === 'vapor' ? 'Chispa libre' : 'Corriente nodal';
      const newNode = this.graph.addNode('', { x, y }, tag);
      this.audio.play(432, 'sine', 0.4, 0.12);

      // Enfoca inmediatamente la nueva tarjeta creada
      setTimeout(() => {
        const card = this.cardInstances.get(newNode.id);
        if (card) card.focus();
      }, 40);
    });
  }
}
