/**
 * ============================================================================
 * CAPA 3: ELEMENTO DOM DE TARJETA VIVA (THOUGHT CARD ELEMENT)
 * ============================================================================
 * Representa una tarjeta de pensamiento individual proyectada sobre el lienzo infinito:
 * - Edición de texto directa in-situ (`contenteditable`).
 * - Cursor artesanal táctil de pinza mineral (`TACTILE_PINCH`) en reposo.
 * - Cursor artesanal táctil de agarre firme (`TACTILE_GRIP`) durante el arrastre.
 * - Pilar 1: Conexión deliberada hacia el Río Narrativo con puerto de manantial interactivo.
 * - Proyección espacial reactiva mediante `camera.worldToScreen` y `scale(zoom)`.
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
  private onPortClickCallback?: (nodeId: string) => void;
  private onCardClickCallback?: (nodeId: string) => void;

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

  public getNodeId(): string {
    return this.node.id;
  }

  public onPortClick(cb: (nodeId: string) => void): void {
    this.onPortClickCallback = cb;
  }

  public onCardClick(cb: (nodeId: string) => void): void {
    this.onCardClickCallback = cb;
  }

  public setConnecting(isConnecting: boolean): void {
    const portBtn = this.element.querySelector('.thought-card-port');
    const portLabel = this.element.querySelector('.port-label');
    const portIcon = this.element.querySelector('.port-icon');
    if (isConnecting) {
      this.element.classList.add('is-connecting-source');
      portBtn?.classList.add('is-connecting');
      if (portLabel) portLabel.textContent = 'Enlazando...';
      if (portIcon) portIcon.textContent = '●';
    } else {
      this.element.classList.remove('is-connecting-source');
      portBtn?.classList.remove('is-connecting');
      if (portLabel) portLabel.textContent = '';
      if (portIcon) portIcon.textContent = '○';
    }
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
    const phaseChanged = this.phase !== newPhase;
    if (phaseChanged) {
      this.element.classList.remove(`${this.phase}-card`);
      this.phase = newPhase;
      this.element.classList.add(`${newPhase}-card`);
      this.renderContent();
    } else if (this.phase === 'liquid') {
      this.refreshFlowState();
    }
  }

  /**
   * Actualiza el badge de flujo y estado de los puertos de corriente.
   */
  public refreshFlowState(): void {
    if (this.phase !== 'liquid') return;
    const flowRole = this.graph.getNodeFlowRole(this.node.id);
    const badgeEl = this.element.querySelector('.thought-card-flow-badge') as HTMLElement | null;

    if (badgeEl) {
      if (flowRole.sequenceTitle) {
        badgeEl.className = `thought-card-flow-badge ${flowRole.role}`;
        badgeEl.innerText = flowRole.sequenceTitle;
        badgeEl.style.display = 'inline-flex';
      } else {
        badgeEl.style.display = 'none';
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
   * Renderiza el contenido interno (icono de fase, tag semántico, badge de flujo y puerto).
   */
  private renderContent(): void {
    const icon = this.phase === 'vapor' ? '☁️' : '💧';
    const flowRole = this.graph.getNodeFlowRole(this.node.id);
    const flowBadgeHtml =
      this.phase === 'liquid' && flowRole.sequenceTitle
        ? `<span class="thought-card-flow-badge ${flowRole.role}">${flowRole.sequenceTitle}</span>`
        : `<span class="thought-card-flow-badge" style="display: none;"></span>`;

    const portHtml =
      this.phase === 'liquid'
        ? `<button class="thought-card-port" data-tooltip="Encauzar hacia otra idea">
            <span class="port-icon">○</span>
            <span class="port-label"></span>
           </button>`
        : '';

    this.element.innerHTML = `
      <div class="thought-card-header">
        <div class="thought-card-tag">
          <span>${icon}</span>
          <span>${this.node.tag || 'Pensamiento'}</span>
        </div>
        ${flowBadgeHtml}
      </div>
      <div class="thought-card-text" contenteditable="true" spellcheck="false">${this.node.text}</div>
      ${portHtml ? `<div class="thought-card-footer">${portHtml}</div>` : ''}
    `;

    const textEl = this.element.querySelector('.thought-card-text') as HTMLDivElement;
    if (textEl) {
      textEl.addEventListener('input', () => {
        this.graph.updateNodeText(this.node.id, textEl.innerText);
      });
    }

    const portBtn = this.element.querySelector('.thought-card-port');
    if (portBtn) {
      portBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onPortClickCallback?.(this.node.id);
      });
    }

    this.element.addEventListener('click', () => {
      this.onCardClickCallback?.(this.node.id);
    });
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

    this.element.addEventListener('dblclick', (e) => {
      e.stopPropagation();
    });

    this.element.addEventListener('mousedown', (e) => {
      e.stopPropagation();

      // Si el clic es en el puerto o en el texto editable, no arrastramos
      if (e.target === textEl || (e.target as HTMLElement).closest('.thought-card-port')) return;
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

  public focus(): void {
    const textEl = this.element.querySelector('.thought-card-text') as HTMLDivElement;
    if (textEl) {
      textEl.focus();
    }
  }
}
