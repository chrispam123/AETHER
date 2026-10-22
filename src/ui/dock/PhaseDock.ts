/**
 * ============================================================================
 * CAPA 3: MODULADOR DE FASE FLOTANTE (PHASE DOCK)
 * ============================================================================
 * Controla el selector inferior ingrávido para cambiar de fase térmica:
 * Niebla (Vapor) <-> Fluido (Líquido) <-> Cristal (Sólido).
 */

import { Phase } from '../../core/types';
import { StateMachine } from '../../core/StateMachine';

export class PhaseDock {
  private dockElement: HTMLDivElement;
  private pills: NodeListOf<HTMLButtonElement>;
  private stateMachine: StateMachine;

  constructor(stateMachine: StateMachine) {
    this.stateMachine = stateMachine;
    this.dockElement = document.getElementById('phase-dock') as HTMLDivElement;
    this.pills = document.querySelectorAll('.phase-pill');

    this.bindEvents();
  }

  /**
   * Conecta los clics de cada píldora con la máquina de estados.
   */
  private bindEvents(): void {
    this.pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const phase = pill.getAttribute('data-phase') as Phase;
        if (phase) {
          this.stateMachine.transitionTo(phase);
        }
      });
    });
  }

  /**
   * Muestra el dock y resalta la píldora correspondiente a la fase activa.
   */
  public update(currentPhase: Phase): void {
    if (currentPhase === 'portal') {
      this.dockElement.classList.remove('visible');
      return;
    }

    this.dockElement.classList.add('visible');

    this.pills.forEach(pill => {
      pill.classList.remove('active');
      const phase = pill.getAttribute('data-phase');
      if (phase === currentPhase) {
        pill.classList.add('active');
      }
    });
  }
}
