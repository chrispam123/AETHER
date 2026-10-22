/**
 * ============================================================================
 * CAPA 3: ELEMENTO DOM DE TARJETA VIVA (THOUGHT CARD ELEMENT)
 * ============================================================================
 * Representa una tarjeta de pensamiento individual proyectada sobre el lienzo infinito:
 * - Edición de texto directa in-situ (`contenteditable`).
 * - Cursor artesanal táctil de pinza mineral (`TACTILE_PINCH`) en reposo.
 * - Cursor artesanal táctil de agarre firme (`TACTILE_GRIP`) durante el arrastre.
 * - Arrastre suave compensado por el factor de zoom de la cámara 2D.
 * - Proyección espacial reactiva mediante `camera.worldToScreen` y `scale(zoom)`.
 * - Preservación de foco y reconciliación reactiva sin destrucción de elementos.
 */

import { ThoughtNode } from '../../core/types';
import { DocumentGraph } from '../../core/DocumentGraph';
import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';
import { Camera } from '../../engine/Camera';
import { CURSORS } from '../cursors/CursorAssets';

export class ThoughtCardElement {
  public readonly element: HTMLDivElement;
  private node: ThoughtNode;
  private graph: DocumentGraph;
  private audio: HarmonicSynthesizer;
  private camera: Camera;
  private phase: string;

  constructor(
    node: ThoughtNode,
    phase: string,
    graph: DocumentGraph,
    audio: HarmonicSynthesizer,
    camera: Camera
  ) {
    this.node = node;
    this.phase = phase;
    this.graph = graph;
    this.audio = audio;
    this.camera = camera;

    this.element = document.createElement('div');
    this.element.className = `thought-card ${phase}-card`;
    this.element.id = `card-${node.id}`;
    this.element.style.cursor = CURSORS.TACTILE_PINCH;

    this.renderContent();
    this.updateProjection(this.camera);
    this.attachDragBehavior();
  }

  /**
   * Proyecta la posición del mundo infinito a la pantalla con escala de zoom.
   */
  public updateProjection(camera: Camera): void {
    const screen = camera.worldToScreen(this.node.position);
    this.element.style.left = `${screen.x}px`;
    this.element.style.top = `${screen.y}px`;
    this.element.style.transform = `translate(-50%, -50%) scale(${camera.zoom})`;
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
   * Habilita el arrastre de la tarjeta en el espacio bidimensional infinito con cursor artesanal táctil.
   */
  private attachDragBehavior(): void {
    const textEl = this.element.querySelector('.thought-card-text') as HTMLDivElement;

    let isDragging = false;
    let startScreenX = 0;
    let startScreenY = 0;
    let origWorldX = 0;
    let origWorldY = 0;

    // Evitar que el doble clic en la tarjeta cree una idea en el lienzo de fondo
    this.element.addEventListener('dblclick', (e) => {
      e.stopPropagation();
    });

    this.element.addEventListener('mousedown', (e) => {
      // Evitar que el mousedown en la tarjeta active el paneo del lienzo
      e.stopPropagation();

      // Si el usuario hace clic dentro del texto para editar, permitir selección y no arrastrar
      if (e.target === textEl) return;

      // Si no es el botón izquierdo principal, ignorar
      if (e.button !== 0) return;

      isDragging = true;
      this.element.classList.add('dragging');
      this.element.style.cursor = CURSORS.TACTILE_GRIP;
      document.body.style.cursor = CURSORS.TACTILE_GRIP;

      startScreenX = e.clientX;
      startScreenY = e.clientY;
      origWorldX = this.node.position.x;
      origWorldY = this.node.position.y;
      this.audio.play(280, 'sine', 0.2, 0.05);

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging) return;
        // El delta de pantalla se compensa dividiendo por el zoom de la cámara
        const deltaWorldX = (ev.clientX - startScreenX) / this.camera.zoom;
        const deltaWorldY = (ev.clientY - startScreenY) / this.camera.zoom;

        const newX = origWorldX + deltaWorldX;
        const newY = origWorldY + deltaWorldY;

        this.node.position.x = newX;
        this.node.position.y = newY;
        this.updateProjection(this.camera);
      };

      const onMouseUp = () => {
        if (isDragging) {
          isDragging = false;
          this.element.classList.remove('dragging');
          this.element.style.cursor = CURSORS.TACTILE_PINCH;
          document.body.style.cursor = CURSORS.COSMIC_OPEN;

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
