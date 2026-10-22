/**
 * ============================================================================
 * CAPA 3: PUENTE DE PROYECCIÓN DOM (DOM PROJECTION BRIDGE)
 * ============================================================================
 * El corazón de la arquitectura híbrida:
 * Sincroniza las coordenadas matemáticas del mundo (Canvas) con los elementos HTML del DOM.
 * Gestiona el ciclo de vida de las tarjetas vivas sin reconstrucciones innecesarias.
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
   * Sincroniza la colección de tarjetas en pantalla con el estado actual del grafo.
   */
  public sync(): void {
    const phase = this.stateMachine.getPhase();

    // En portal o cristal, las tarjetas espaciales se ocultan
    if (phase === 'portal' || phase === 'crystal') {
      this.container.innerHTML = '';
      this.cardInstances.clear();
      return;
    }

    const currentNodes = this.graph.getAllNodes();
    this.container.innerHTML = '';
    this.cardInstances.clear();

    currentNodes.forEach(node => {
      const card = new ThoughtCardElement(node, phase, this.graph, this.audio);
      this.cardInstances.set(node.id, card);
      this.container.appendChild(card.element);
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
