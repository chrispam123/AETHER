/**
 * ============================================================================
 * CAPA 3: SELECTOR DE ATMÓSFERA EDITORIAL (ATMOSPHERE SELECTOR)
 * ============================================================================
 * Modula la atmósfera visual, tipográfica y cromática del Santuario Cristal:
 * - 1. Atmósfera (Basalto & Ámbar vela · Newsreader)
 * - 2. Aura (Obsidiana & Cian glacial · Inter)
 * - 3. Flujo (Café carbón & Cobre cálido · Lora)
 * - Se ubica en el Header superior, junto a la Resonancia Acústica.
 * - Desaparece suavemente durante el hiperfoco de escritura para no invadir.
 */

import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';
import { StateMachine } from '../../core/StateMachine';

export type AtmosphereMode = 'atmosfera' | 'aura' | 'flujo';

interface AtmosphereConfig {
  id: AtmosphereMode;
  label: string;
  dotColor: string;
  toneFreq: number;
}

export class AtmosphereSelector {
  private container: HTMLDivElement;
  private btn: HTMLButtonElement;
  private dropdown: HTMLDivElement;
  private indicatorDot: HTMLSpanElement;
  private labelSpan: HTMLSpanElement;
  private audio: HarmonicSynthesizer;
  private stateMachine: StateMachine;

  private currentAtmosphere: AtmosphereMode = 'atmosfera';
  private isOpen: boolean = false;

  private readonly atmospheres: AtmosphereConfig[] = [
    { id: 'atmosfera', label: 'Atmósfera', dotColor: '#d9ba85', toneFreq: 330 },
    { id: 'aura', label: 'Aura', dotColor: '#6fe0eb', toneFreq: 528 },
    { id: 'flujo', label: 'Flujo', dotColor: '#e59c77', toneFreq: 415 }
  ];

  constructor(audio: HarmonicSynthesizer, stateMachine: StateMachine) {
    this.audio = audio;
    this.stateMachine = stateMachine;

    this.container = document.createElement('div');
    this.container.className = 'atmosphere-control';
    this.container.id = 'atmosphere-control';

    // 1. Botón disparador en el Header
    this.btn = document.createElement('button');
    this.btn.className = 'atmosphere-btn';
    this.btn.title = 'Modula la atmósfera y personalidad del santuario';

    this.indicatorDot = document.createElement('span');
    this.indicatorDot.className = 'atmosphere-indicator-dot';

    this.labelSpan = document.createElement('span');
    this.labelSpan.className = 'atmosphere-label';
    this.labelSpan.innerText = 'Atmósfera';

    this.btn.appendChild(this.indicatorDot);
    this.btn.appendChild(this.labelSpan);

    // 2. Desplegable etéreo
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'atmosphere-dropdown';

    this.renderDropdownItems();

    this.container.appendChild(this.btn);
    this.container.appendChild(this.dropdown);

    this.bindEvents();
    this.bindPhaseObserver();
    this.applyAtmosphere(this.currentAtmosphere, false);
  }

  /**
   * Obtiene el elemento contenedor para insertarlo en el Header.
   */
  public getElement(): HTMLDivElement {
    return this.container;
  }

  /**
   * Pinta las 3 opciones del menú desplegable.
   */
  private renderDropdownItems(): void {
    this.dropdown.innerHTML = '';

    this.atmospheres.forEach((item) => {
      const btnItem = document.createElement('button');
      btnItem.className = `atmosphere-item ${item.id === this.currentAtmosphere ? 'active' : ''}`;
      btnItem.dataset.id = item.id;

      btnItem.innerHTML = `
        <span>${item.label}</span>
        <span class="atmosphere-item-dot" style="background-color: ${item.dotColor};"></span>
      `;

      btnItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.applyAtmosphere(item.id, true);
        this.close();
      });

      this.dropdown.appendChild(btnItem);
    });
  }

  /**
   * Conecta los escuchadores de clic y de cierre al pulsar fuera.
   */
  private bindEvents(): void {
    this.btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.container.contains(e.target as Node)) {
        this.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  /**
   * Visibilidad ligada a la fase Cristal.
   */
  private bindPhaseObserver(): void {
    this.stateMachine.onPhaseChange((phase) => {
      if (phase === 'crystal') {
        this.container.style.display = 'flex';
      } else {
        this.container.style.display = 'none';
        this.close();
      }
    });
  }

  /**
   * Abre o cierra el desplegable con transición suave.
   */
  private toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private open(): void {
    this.isOpen = true;
    this.dropdown.classList.add('visible');
    this.audio.play(440, 'sine', 0.15, 0.05);
  }

  private close(): void {
    this.isOpen = false;
    this.dropdown.classList.remove('visible');
  }

  /**
   * Aplica la atmósfera al cuerpo del documento y emite el acorde acústico.
   */
  public applyAtmosphere(id: AtmosphereMode, playSound: boolean = true): void {
    this.currentAtmosphere = id;
    document.body.setAttribute('data-atmosphere', id);

    const config = this.atmospheres.find((a) => a.id === id);
    if (config) {
      this.labelSpan.innerText = config.label;
      this.indicatorDot.style.backgroundColor = config.dotColor;
      this.indicatorDot.style.boxShadow = `0 0 8px ${config.dotColor}`;

      if (playSound) {
        this.audio.play(config.toneFreq, 'sine', 0.35, 0.12);
      }
    }

    this.renderDropdownItems();
  }

  public getCurrentAtmosphere(): AtmosphereMode {
    return this.currentAtmosphere;
  }
}
