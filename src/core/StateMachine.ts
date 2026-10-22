/**
 * ============================================================================
 * CAPA 1: MÁQUINA DE ESTADOS DE FASE (STATE MACHINE)
 * ============================================================================
 * Gestiona la termodinámica del editor y la transición entre estados:
 * Portal (Invocación) -> Niebla (Vapor) <-> Fluido (Líquido) <-> Cristal (Sólido).
 */

import { Phase } from './types';

export type PhaseChangeListener = (newPhase: Phase, previousPhase: Phase) => void;

export class StateMachine {
  private currentPhase: Phase = 'portal';
  private listeners: Set<PhaseChangeListener> = new Set();

  constructor(initialPhase: Phase = 'portal') {
    this.currentPhase = initialPhase;
  }

  /**
   * Obtiene la fase actual en la que se encuentra la materia del editor.
   */
  public getPhase(): Phase {
    return this.currentPhase;
  }

  /**
   * Realiza una transición hacia una nueva fase y notifica a los observadores.
   */
  public transitionTo(newPhase: Phase): void {
    if (this.currentPhase === newPhase) return;
    const prev = this.currentPhase;
    this.currentPhase = newPhase;
    this.listeners.forEach(fn => fn(newPhase, prev));
  }

  /**
   * Suscribe un listener para reaccionar ante los cambios de fase.
   */
  public onPhaseChange(listener: PhaseChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
