/**
 * ============================================================================
 * CAPA 2: CONTROLADOR DE ZOOM SEMÁNTICO (SEMANTIC ZOOM CONTROLLER)
 * ============================================================================
 * Implementa el Pilar 3 del Manifiesto de Aether (Bret Victor):
 * - Modula el nivel de abstracción del pensamiento en modo Cristal:
 *   1. 'prose' (100%): Redacción monástica y estilo detallado.
 *   2. 'thesis' (50%): Esqueleto argumental; frases tesis destacadas y relleno plegado.
 *   3. 'map' (20%): Cartografía conceptual de bloques estructurales.
 * - Discrimina con total pureza:
 *   - Rueda normal: Scroll vertical del texto.
 *   - Ctrl + Rueda (o Pinch de trackpad): Zoom semántico continuo.
 *   - Ctrl + 1 / 2 / 3: Atajos de teclado para salto cuántico inmediato.
 */

import { SemanticLevel, SemanticZoomState } from '../core/types';
import { StateMachine } from '../core/StateMachine';
import { HarmonicSynthesizer } from '../audio/HarmonicSynthesizer';

export type SemanticZoomCallback = (state: SemanticZoomState) => void;

export class SemanticZoomController {
  private stateMachine: StateMachine;
  private audio: HarmonicSynthesizer;
  private currentLevel: SemanticLevel = 'prose';
  private currentFactor: number = 1.0;
  private listeners: Set<SemanticZoomCallback> = new Set();
  private wheelAccumulator: number = 0;
  private wheelCooldown: boolean = false;

  constructor(stateMachine: StateMachine, audio: HarmonicSynthesizer) {
    this.stateMachine = stateMachine;
    this.audio = audio;

    this.bindEvents();
  }

  /**
   * Conecta los escuchadores de rueda con modificador y atajos de teclado.
   */
  private bindEvents(): void {
    // 1. Detección de atajos rápidos numéricos: Ctrl+1, Ctrl+2, Ctrl+3
    window.addEventListener('keydown', (e) => {
      if (this.stateMachine.getPhase() !== 'crystal') return;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          this.setLevel('prose');
        } else if (e.key === '2') {
          e.preventDefault();
          this.setLevel('thesis');
        } else if (e.key === '3') {
          e.preventDefault();
          this.setLevel('map');
        }
      }
    });

    // 2. Zoom Semántico con Ctrl + Rueda del ratón o Gesto de Pinza (Pinch)
    window.addEventListener(
      'wheel',
      (e) => {
        if (this.stateMachine.getPhase() !== 'crystal') return;

        // Únicamente se activa si el usuario mantiene Ctrl (o pinch en trackpad)
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();

          if (this.wheelCooldown) return;

          this.wheelAccumulator += e.deltaY;

          const threshold = 40;
          if (this.wheelAccumulator > threshold) {
            this.stepZoom('out');
            this.triggerCooldown();
          } else if (this.wheelAccumulator < -threshold) {
            this.stepZoom('in');
            this.triggerCooldown();
          }
        }
      },
      { passive: false }
    );
  }

  /**
   * Cooldown de 280ms para evitar saltos descontrolados al girar rápido la rueda.
   */
  private triggerCooldown(): void {
    this.wheelCooldown = true;
    this.wheelAccumulator = 0;
    setTimeout(() => {
      this.wheelCooldown = false;
      this.wheelAccumulator = 0;
    }, 280);
  }

  /**
   * Avanza o retrocede un peldaño en la escala de abstracción.
   */
  public stepZoom(direction: 'in' | 'out'): void {
    if (direction === 'out') {
      if (this.currentLevel === 'prose') {
        this.setLevel('thesis');
      } else if (this.currentLevel === 'thesis') {
        this.setLevel('map');
      }
    } else {
      if (this.currentLevel === 'map') {
        this.setLevel('thesis');
      } else if (this.currentLevel === 'thesis') {
        this.setLevel('prose');
      }
    }
  }

  /**
   * Establece un nivel de zoom semántico explícito.
   */
  public setLevel(level: SemanticLevel): void {
    if (this.currentLevel === level) return;

    this.currentLevel = level;
    if (level === 'prose') {
      this.currentFactor = 1.0;
      this.audio.play(528, 'sine', 0.35, 0.12);
    } else if (level === 'thesis') {
      this.currentFactor = 0.5;
      this.audio.play(432, 'triangle', 0.4, 0.14);
    } else if (level === 'map') {
      this.currentFactor = 0.2;
      this.audio.play(320, 'sine', 0.45, 0.16);
    }

    this.notify();
  }

  /**
   * Obtiene el nivel de abstracción actual.
   */
  public getLevel(): SemanticLevel {
    return this.currentLevel;
  }

  /**
   * Obtiene el factor numérico de escala conceptual.
   */
  public getFactor(): number {
    return this.currentFactor;
  }

  /**
   * Suscribe un observador a los cambios de nivel semántico.
   */
  public onChange(callback: SemanticZoomCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notifica a todos los escuchadores registrados.
   */
  private notify(): void {
    const state: SemanticZoomState = {
      level: this.currentLevel,
      factor: this.currentFactor
    };
    this.listeners.forEach((fn) => fn(state));
  }
}
