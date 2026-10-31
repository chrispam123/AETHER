/**
 * ============================================================================
 * CAPA 3: TRÍPTICO DE LUZ EN EL LOGO (BRAND ATMOSPHERE TRIPTYCH)
 * ============================================================================
 * Transforma el punto de luz junto a AETHER en un tríptico de 3 cuentas minerales
 * puras: [ • • • ] AETHER · ATMÓSFERA
 * - Cero tooltips invasivos de Windows (cero atributos title con texto feo).
 * - Misma tipografía, color y espaciado exacto de AETHER (Geist Mono, 11px, letter-spacing).
 * - 3 perlas minerales que representan:
 *   1. ATMÓSFERA (Ámbar vela · Newsreader)
 *   2. AURA (Cian glacial · Inter)
 *   3. HALO (Cobre cálido · Lora)
 * - Al pulsar en cualquiera de las 3 perlas, el texto junto al logo refleja
 *   inmediatamente la personalidad activa con la misma voz tipográfica.
 */

import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';
import { StateMachine } from '../../core/StateMachine';

export type AtmosphereMode = 'atmosfera' | 'aura' | 'halo';

interface BeadConfig {
  id: AtmosphereMode;
  label: string;
  color: string;
  toneFreq: number;
}

export class AtmosphereSelector {
  private container: HTMLDivElement;
  private audio: HarmonicSynthesizer;
  private stateMachine: StateMachine;

  private currentAtmosphere: AtmosphereMode = 'atmosfera';
  private beads: Map<AtmosphereMode, HTMLSpanElement> = new Map();
  private brandTextElement: HTMLElement | null = null;

  private readonly config: BeadConfig[] = [
    { id: 'atmosfera', label: 'ATMÓSFERA', color: '#d9ba85', toneFreq: 330 },
    { id: 'aura', label: 'AURA', color: '#6fe0eb', toneFreq: 528 },
    { id: 'halo', label: 'HALO', color: '#e59c77', toneFreq: 415 }
  ];

  constructor(audio: HarmonicSynthesizer, stateMachine: StateMachine) {
    this.audio = audio;
    this.stateMachine = stateMachine;
    this.brandTextElement = document.getElementById('brand-text');

    this.container = document.createElement('div');
    this.container.className = 'brand-triptych';
    this.container.id = 'brand-triptych';

    this.createBeads();
    this.bindPhaseObserver();
    this.applyAtmosphere(this.currentAtmosphere, false);
  }

  /**
   * Crea las 3 cuentas minerales de luz pura SIN tooltips 'title' invasivos.
   */
  private createBeads(): void {
    this.config.forEach((cfg) => {
      const bead = document.createElement('span');
      bead.className = `triptych-bead ${cfg.id === this.currentAtmosphere ? 'active' : ''}`;
      bead.dataset.id = cfg.id;

      bead.style.setProperty('--bead-color', cfg.color);

      bead.addEventListener('click', (e) => {
        e.stopPropagation();
        this.applyAtmosphere(cfg.id, true);
      });

      this.beads.set(cfg.id, bead);
      this.container.appendChild(bead);
    });
  }

  public getElement(): HTMLDivElement {
    return this.container;
  }

  /**
   * Solo visible en la fase Cristal.
   */
  private bindPhaseObserver(): void {
    this.stateMachine.onPhaseChange((phase) => {
      if (phase === 'crystal') {
        this.container.style.display = 'inline-flex';
        this.updateBrandLabel();
      } else {
        this.container.style.display = 'none';
      }
    });

    const currentPhase = this.stateMachine.getPhase();
    this.container.style.display = currentPhase === 'crystal' ? 'inline-flex' : 'none';
  }

  /**
   * Actualiza el texto de marca con exactamente la misma tipografía y estilo de AETHER.
   */
  private updateBrandLabel(): void {
    if (!this.brandTextElement) {
      this.brandTextElement = document.getElementById('brand-text');
    }
    if (this.brandTextElement) {
      const cfg = this.config.find((c) => c.id === this.currentAtmosphere);
      const label = cfg ? cfg.label : 'ATMÓSFERA';
      this.brandTextElement.innerHTML = `AETHER <span class="brand-atmosphere-tag">· ${label}</span>`;
    }
  }

  /**
   * Aplica la atmósfera mutando el atributo del body y encendiendo la perla correspondiente.
   */
  public applyAtmosphere(id: AtmosphereMode, playSound: boolean = true): void {
    this.currentAtmosphere = id;
    document.body.setAttribute('data-atmosphere', id);

    this.beads.forEach((bead, mode) => {
      if (mode === id) {
        bead.classList.add('active');
      } else {
        bead.classList.remove('active');
      }
    });

    const cfg = this.config.find((c) => c.id === id);
    if (cfg && playSound) {
      this.audio.play(cfg.toneFreq, 'sine', 0.35, 0.12);
    }

    if (this.stateMachine.getPhase() === 'crystal') {
      this.updateBrandLabel();
    }
  }

  public getCurrentAtmosphere(): AtmosphereMode {
    return this.currentAtmosphere;
  }
}
