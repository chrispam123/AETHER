/**
 * ============================================================================
 * CAPA 3: INDICADOR DE ZOOM SEMÁNTICO (SEMANTIC ZOOM INDICATOR DIAL)
 * ============================================================================
 * Tacómetro visual y sensorial del nivel de abstracción activo en Modo Cristal:
 * - Niveles: [ Prosa (100%) | Tesis (50%) | Estructura (20%) ]
 * - Es un INDICADOR DE ESTADO PURO (no interactivo por clic): refleja el cambio
 *   gobernado exclusivamente por la dimensión física del gesto (Ctrl + Scroll / Ctrl + 1/2/3).
 * - Si el usuario intenta hacer clic, muestra un micro-aviso translúcido suave:
 *   "Usa Ctrl + Scroll para modular la escala".
 * - Estética mineral de cuarzo con pulso de confirmación armónico.
 */

import { SemanticZoomController } from '../../engine/SemanticZoomController';
import { StateMachine } from '../../core/StateMachine';
import { SemanticLevel } from '../../core/types';

export class ZoomDial {
  private element: HTMLDivElement;
  private controller: SemanticZoomController;
  private stateMachine: StateMachine;
  private buttons: Map<SemanticLevel, HTMLDivElement> = new Map();
  private pulseTimer: number | null = null;
  private tooltipElement: HTMLDivElement | null = null;
  private tooltipTimer: number | null = null;

  constructor(controller: SemanticZoomController, stateMachine: StateMachine) {
    this.controller = controller;
    this.stateMachine = stateMachine;

    this.element = this.createDialElement();
    const header = document.getElementById('app-header') || document.querySelector('header');
    if (header) {
      header.appendChild(this.element);
    } else {
      document.body.appendChild(this.element);
    }

    this.bindEvents();
    this.bindPhaseObserver();
    this.updateActiveButton(this.controller.getLevel());
  }

  /**
   * Crea el tacómetro de escala con los tres segmentos conceptuales y su tooltip pedagógico.
   */
  private createDialElement(): HTMLDivElement {
    const dial = document.createElement('div');
    dial.id = 'semantic-zoom-dial';
    dial.className = 'semantic-zoom-dial';
    dial.style.display = 'none'; // Se activa únicamente en Cristal

    const levels: Array<{ id: SemanticLevel; label: string; shortcut: string }> = [
      { id: 'prose', label: 'Prosa', shortcut: '1' },
      { id: 'thesis', label: 'Tesis', shortcut: '2' },
      { id: 'map', label: 'Estructura', shortcut: '3' }
    ];

    levels.forEach(({ id, label, shortcut }) => {
      const segment = document.createElement('div');
      segment.className = `zoom-dial-segment ${id}`;
      segment.dataset.level = id;

      segment.innerHTML = `
        <span class="zoom-dial-dot"></span>
        <span class="zoom-dial-text">${label}</span>
        <span class="zoom-dial-key">${shortcut}</span>
      `;

      this.buttons.set(id, segment);
      dial.appendChild(segment);
    });

    // Tooltip tenue y suave que enseña la interacción gestual pura
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'zoom-dial-hint-tooltip';
    this.tooltipElement.innerText = 'Usa Ctrl + Scroll para modular la escala';
    dial.appendChild(this.tooltipElement);

    // Al pulsar sobre el dial, orienta al autor sutilmente sin cambiar de modo
    dial.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showScrollHint();
    });

    return dial;
  }

  /**
   * Muestra el micro-aviso pedagógico suave durante 1.2 segundos y se disuelve.
   */
  private showScrollHint(): void {
    if (!this.tooltipElement) return;
    this.tooltipElement.classList.add('visible');
    if (this.tooltipTimer) window.clearTimeout(this.tooltipTimer);
    this.tooltipTimer = window.setTimeout(() => {
      this.tooltipElement?.classList.remove('visible');
    }, 1200);
  }

  /**
   * Conecta los observadores del controlador de zoom.
   */
  private bindEvents(): void {
    this.controller.onChange((state) => {
      this.updateActiveButton(state.level);
      this.pulse();
    });
  }

  /**
   * Genera un pulso visual nítido para confirmar el cambio de escala antes de relajarse.
   */
  private pulse(): void {
    this.element.classList.add('active-pulse');
    if (this.pulseTimer) window.clearTimeout(this.pulseTimer);
    this.pulseTimer = window.setTimeout(() => {
      this.element.classList.remove('active-pulse');
    }, 1800);
  }

  private bindPhaseObserver(): void {
    this.stateMachine.onPhaseChange((phase) => {
      if (phase === 'crystal') {
        this.element.style.display = 'flex';
        this.element.classList.add('visible');
      } else {
        this.element.style.display = 'none';
        this.element.classList.remove('visible');
      }
    });
  }

  /**
   * Actualiza el segmento activo visualmente con el pulso mineral.
   */
  private updateActiveButton(activeLevel: SemanticLevel): void {
    this.buttons.forEach((segment, level) => {
      if (level === activeLevel) {
        segment.classList.add('active');
      } else {
        segment.classList.remove('active');
      }
    });
  }

  /**
   * Muestra u oculta el dial explícitamente.
   */
  public setVisible(visible: boolean): void {
    this.element.style.display = visible ? 'flex' : 'none';
  }
}
