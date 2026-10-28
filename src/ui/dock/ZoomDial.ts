/**
 * ============================================================================
 * CAPA 3: DIAL DE ZOOM SEMÁNTICO (ZOOM DIAL COMPONENT)
 * ============================================================================
 * Indicador táctil y visual del nivel de abstracción activo en Modo Cristal:
 * - Opciones: [ Prosa (100%) | Tesis (50%) | Estructura (20%) ]
 * - Permite conmutar con un solo clic o reflejar el cambio de Ctrl+Rueda / atajos.
 * - Estética de vidrio esmerilado mineral sin bordes agresivos.
 */

import { SemanticZoomController } from '../../engine/SemanticZoomController';
import { StateMachine } from '../../core/StateMachine';
import { SemanticLevel } from '../../core/types';

export class ZoomDial {
  private element: HTMLDivElement;
  private controller: SemanticZoomController;
  private stateMachine: StateMachine;
  private buttons: Map<SemanticLevel, HTMLButtonElement> = new Map();

  constructor(controller: SemanticZoomController, stateMachine: StateMachine) {
    this.controller = controller;
    this.stateMachine = stateMachine;

    this.element = this.createDialElement();
    document.body.appendChild(this.element);

    this.bindEvents();
    this.bindPhaseObserver();
    this.updateActiveButton(this.controller.getLevel());
  }

  /**
   * Crea el contenedor del dial con los tres botones de densidad conceptual.
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
      const btn = document.createElement('button');
      btn.className = `zoom-dial-btn ${id}`;
      btn.dataset.level = id;
      btn.title = `Nivel ${label} (Ctrl+${shortcut} o Ctrl+Rueda)`;

      btn.innerHTML = `
        <span class="zoom-dial-dot"></span>
        <span class="zoom-dial-text">${label}</span>
        <span class="zoom-dial-key">${shortcut}</span>
      `;

      btn.addEventListener('click', () => {
        this.controller.setLevel(id);
      });

      this.buttons.set(id, btn);
      dial.appendChild(btn);
    });

    return dial;
  }

  /**
   * Conecta los observadores del controlador de zoom.
   */
  private bindEvents(): void {
    this.controller.onChange((state) => {
      this.updateActiveButton(state.level);
    });
  }

  /**
   * Conecta el observador de cambio de fase ontológica.
   */
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
   * Actualiza el botón activo visualmente con el pulso mineral.
   */
  private updateActiveButton(activeLevel: SemanticLevel): void {
    this.buttons.forEach((btn, level) => {
      if (level === activeLevel) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
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
