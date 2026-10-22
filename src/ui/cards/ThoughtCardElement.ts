/**
 * ============================================================================
 * CAPA 3: ELEMENTO DOM DE TARJETA VIVA (THOUGHT CARD ELEMENT)
 * ============================================================================
 * Representa una tarjeta de pensamiento individual proyectada sobre el lienzo:
 * - Edición de texto directa in-situ (`contenteditable`).
 * - Arrastre suave con física de inercia y actualización de coordenadas en el grafo.
 * - Estética de vidrio esmerilado sin bordes duros.
 * - Preservación de foco y reconciliación reactiva sin destrucción de elementos.
 */

import { ThoughtNode } from '../../core/types';
import { DocumentGraph } from '../../core/DocumentGraph';
import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';

export class ThoughtCardElement {
  public readonly element: HTMLDivElement;
  private node: ThoughtNode;
  private graph: DocumentGraph;
  private audio: HarmonicSynthesizer;
  private phase: string;

  constructor(
    node: ThoughtNode,
    phase: string,
    graph: DocumentGraph,
    audio: HarmonicSynthesizer
  ) {
    this.node = node;
    this.phase = phase;
    this.graph = graph;
    this.audio = audio;

    this.element = document.createElement('div');
    this.element.className = `thought-card ${phase}-card`;
    this.element.id = `card-${node.id}`;
    this.updatePosition(node.position.x, node.position.y);

    this.renderContent();
    this.attachDragBehavior();
  }

  /**
   * Actualiza las coordenadas visuales de la tarjeta en pantalla.
   */
  public updatePosition(x: number, y: number): void {
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }

  /**
   * Actualiza la fase de la tarjeta (Niebla <-> Fluido) sin destruir el nodo DOM.
   */
  public updatePhase(newPhase: string): void {
    if (this.phase !== newPhase) {
      this.element.classList.remove(`${this.phase}-card`);
      this.phase = newPhase;
      this.element.classList.add(`${newPhase}-card`);

      const iconSpan = this.element.querySelector('.thought-card-tag span:first-child');
      if (iconSpan) {
        iconSpan.textContent = newPhase === 'vapor' ? '☁️' : '💧';
      }
    }
  }

  /**
   * Actualiza el texto si cambió externamente y el usuario no está tecleando activamente en él.
   */
  public updateTextIfExternal(newText: string): void {
    const textEl = this.element.querySelector('.thought-card-text') as HTMLDivElement;
    if (textEl && document.activeElement !== textEl && textEl.innerText !== newText) {
      textEl.innerText = newText;
    }
  }

  /**
   * Renderiza el contenido interno (icono de fase, tag semántico y texto editable).
   */
  private renderContent(): void {
    const icon = this.phase === 'vapor' ? '☁️' : '💧';

    this.element.innerHTML = `
      <div class="thought-card-tag">
        <span>${icon}</span>
        <span>${this.node.tag || 'Pensamiento'}</span>
      </div>
      <div class="thought-card-text" contenteditable="true" spellcheck="false">${this.node.text}</div>
    `;

    const textEl = this.element.querySelector('.thought-card-text') as HTMLDivElement;
    if (textEl) {
      textEl.addEventListener('input', () => {
        // Actualiza el texto en el grafo de datos
        this.graph.updateNodeText(this.node.id, textEl.innerText);
      });
    }
  }

  /**
   * Habilita el arrastre de la tarjeta en el espacio bidimensional.
   */
  private attachDragBehavior(): void {
    const textEl = this.element.querySelector('.thought-card-text') as HTMLDivElement;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let origX = 0;
    let origY = 0;

    this.element.addEventListener('mousedown', (e) => {
      // Si el usuario hace clic dentro del texto para editar, no arrastrar
      if (e.target === textEl) return;

      isDragging = true;
      this.element.classList.add('dragging');
      startX = e.clientX;
      startY = e.clientY;
      origX = this.node.position.x;
      origY = this.node.position.y;
      this.audio.play(280, 'sine', 0.2, 0.05);

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging) return;
        const newX = origX + (ev.clientX - startX);
        const newY = origY + (ev.clientY - startY);
        this.node.position.x = newX;
        this.node.position.y = newY;
        this.updatePosition(newX, newY);
      };

      const onMouseUp = () => {
        if (isDragging) {
          isDragging = false;
          this.element.classList.remove('dragging');
          this.graph.updateNodePosition(this.node.id, { ...this.node.position });
          this.audio.play(220, 'sine', 0.2, 0.05);
        }
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  /**
   * Pone el foco del cursor automáticamente en el texto de la tarjeta.
   */
  public focus(): void {
    const textEl = this.element.querySelector('.thought-card-text') as HTMLDivElement;
    if (textEl) {
      textEl.focus();
    }
  }
}
