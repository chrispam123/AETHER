/**
 * ============================================================================
 * CAPA 3: PUENTE DE PROYECCIÓN DOM (DOM PROJECTION BRIDGE)
 * ============================================================================
 * El corazón de la arquitectura híbrida:
 * Sincroniza las coordenadas matemáticas del mundo cósmico (Canvas) con los elementos HTML del DOM.
 * Gestiona el ciclo de vida de las tarjetas vivas mediante reconciliación reactiva por ID.
 * Proyecta la posición y escala de las tarjetas según el movimiento y zoom continuo de la cámara.
 */

import { DocumentGraph } from '../core/DocumentGraph';
import { StateMachine } from '../core/StateMachine';
import { HarmonicSynthesizer } from '../audio/HarmonicSynthesizer';
import { Camera } from '../engine/Camera';
import { ThoughtCardElement } from './cards/ThoughtCardElement';

export class DomProjectionBridge {
  private container: HTMLDivElement;
  private camera: Camera;
  private graph: DocumentGraph;
  private stateMachine: StateMachine;
  private audio: HarmonicSynthesizer;
  private cardInstances: Map<string, ThoughtCardElement> = new Map();

  constructor(
    container: HTMLDivElement,
    camera: Camera,
    graph: DocumentGraph,
    stateMachine: StateMachine,
    audio: HarmonicSynthesizer
  ) {
    this.container = container;
    this.camera = camera;
    this.graph = graph;
    this.stateMachine = stateMachine;
    this.audio = audio;

    // Reactividad a cambios en el grafo de datos
    this.graph.subscribe(() => this.sync());

    // Reactividad a movimientos y zoom focal de la cámara 2D (120 FPS)
    this.camera.onChange(() => this.updateAllProjections());
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
        existingCard.updateProjection(this.camera);
        existingCard.updateTextIfExternal(node.text);
      } else {
        // Tarjeta nueva: se instancia y se añade al contenedor
        const isNewAndEmpty = node.text === '';
        const newCard = new ThoughtCardElement(node, phase, this.graph, this.audio, this.camera);
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
