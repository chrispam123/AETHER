/**
 * ============================================================================
 * CAPA 3: HUD DE TEXTO FLOTANTE ("EL ALIENTO" · FORMATO Y TEMPERAMENTO)
 * ============================================================================
 * Menú etéreo que se materializa tenuemente al seleccionar texto:
 * - Aparición orgánica con MouseUp Delay (~180ms).
 * - Desaparición instantánea (0ms) ante cualquier tecla (keydown/input) o clic derecho.
 * - Controles de Masa y Voz:
 *   • Negrita (B · Gravedad/Masa ontológica)
 *   • Cursiva (I · Voz interna/Reflexión íntima)
 *   • Escala de Voz: [ Íntimo (16px) | Prosa (20px) | Sentencia (24px) ]
 *   • Temperamento Tipográfico del Santuario: [ Piedra | Cristal | Pergamino ]
 * - Estética mineral de cuarzo translúcido con resonancia acústica sintética.
 */

import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';

export type TextTemperament = 'piedra' | 'cristal' | 'pergamino';
export type TextScale = 'small' | 'normal' | 'large';

export class TextHud {
  private container: HTMLDivElement;
  private editorElement: HTMLElement;
  private audio: HarmonicSynthesizer;
  private mouseUpTimer: number | null = null;
  private isVisible: boolean = false;

  private btnBold!: HTMLButtonElement;
  private btnItalic!: HTMLButtonElement;
  private scaleButtons: Map<TextScale, HTMLButtonElement> = new Map();
  private temperamentButtons: Map<TextTemperament, HTMLButtonElement> = new Map();

  private activeTemperament: TextTemperament = 'piedra';

  constructor(editorElement: HTMLElement, audio: HarmonicSynthesizer) {
    this.editorElement = editorElement;
    this.audio = audio;

    this.container = this.createHudElement();
    document.body.appendChild(this.container);

    this.bindEvents();
    this.applyTemperament(this.activeTemperament);
  }

  /**
   * Crea el elemento DOM del HUD con diseño esbelto en cuarzo translúcido.
   */
  private createHudElement(): HTMLDivElement {
    const hud = document.createElement('div');
    hud.id = 'text-hud-float';
    hud.className = 'text-hud-float';
    hud.style.display = 'none';

    // 1. Grupo de Modulación de Masa (Bold / Italic)
    const massGroup = document.createElement('div');
    massGroup.className = 'hud-group hud-mass-group';

    this.btnBold = document.createElement('button');
    this.btnBold.className = 'hud-btn hud-btn-bold';
    this.btnBold.innerHTML = '<strong>B</strong>';
    this.btnBold.title = 'Masa y Gravedad (Negrita · Ctrl+B)';
    this.btnBold.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Previene deseleccionar el texto
      this.toggleBold();
    });

    this.btnItalic = document.createElement('button');
    this.btnItalic.className = 'hud-btn hud-btn-italic';
    this.btnItalic.innerHTML = '<em>I</em>';
    this.btnItalic.title = 'Voz Interna (Cursiva · Ctrl+I)';
    this.btnItalic.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.toggleItalic();
    });

    massGroup.appendChild(this.btnBold);
    massGroup.appendChild(this.btnItalic);
    hud.appendChild(massGroup);

    // Separador sutil
    hud.appendChild(this.createSeparator());

    // 2. Grupo de Escala de Voz (Íntimo · Prosa · Sentencia)
    const scaleGroup = document.createElement('div');
    scaleGroup.className = 'hud-group hud-scale-group';

    const scales: Array<{ id: TextScale; label: string; title: string }> = [
      { id: 'small', label: 'T⁻', title: 'Voz Íntima / Marginal (16px)' },
      { id: 'normal', label: 'T', title: 'Prosa Serena Continua (20px)' },
      { id: 'large', label: 'T⁺', title: 'Sentencia / Énfasis Nuclear (24px)' }
    ];

    scales.forEach(({ id, label, title }) => {
      const btn = document.createElement('button');
      btn.className = `hud-btn hud-btn-scale ${id === 'normal' ? 'active' : ''}`;
      btn.innerText = label;
      btn.title = title;
      btn.dataset.scale = id;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.applyTextScale(id);
      });
      this.scaleButtons.set(id, btn);
      scaleGroup.appendChild(btn);
    });
    hud.appendChild(scaleGroup);

    // Separador sutil
    hud.appendChild(this.createSeparator());

    // 3. Grupo de Temperamento Tipográfico del Santuario
    const tempGroup = document.createElement('div');
    tempGroup.className = 'hud-group hud-temperament-group';

    const temperaments: Array<{ id: TextTemperament; icon: string; label: string; desc: string }> = [
      { id: 'piedra', icon: '✦', label: 'Piedra', desc: 'Serif Editorial Clásica (Newsreader)' },
      { id: 'cristal', icon: '◆', label: 'Cristal', desc: 'Geométrica Analítica (Inter)' },
      { id: 'pergamino', icon: '❧', label: 'Pergamino', desc: 'Humanista Transicional (Lora)' }
    ];

    temperaments.forEach(({ id, icon, label, desc }) => {
      const btn = document.createElement('button');
      btn.className = `hud-btn hud-btn-temp ${id === this.activeTemperament ? 'active' : ''}`;
      btn.innerHTML = `<span class="hud-temp-icon">${icon}</span><span class="hud-temp-label">${label}</span>`;
      btn.title = `Atmósfera: ${desc}`;
      btn.dataset.temp = id;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.applyTemperament(id);
      });
      this.temperamentButtons.set(id, btn);
      tempGroup.appendChild(btn);
    });
    hud.appendChild(tempGroup);

    return hud;
  }

  /**
   * Crea un separador vertical tenue entre grupos de controles.
   */
  private createSeparator(): HTMLDivElement {
    const sep = document.createElement('div');
    sep.className = 'hud-separator';
    return sep;
  }

  /**
   * Conecta los escuchadores del ratón, selección y teclado.
   */
  private bindEvents(): void {
    // 1. Detección orgánica al soltar el ratón (MouseUp con delay)
    this.editorElement.addEventListener('mouseup', () => {
      if (this.mouseUpTimer) window.clearTimeout(this.mouseUpTimer);
      this.mouseUpTimer = window.setTimeout(() => {
        this.evaluateSelection();
      }, 160);
    });

    // 2. Desaparición instantánea (0ms) ante cualquier tecla (el autor vuelve a escribir)
    this.editorElement.addEventListener('keydown', () => {
      this.hideImmediately();
    });

    this.editorElement.addEventListener('beforeinput', () => {
      this.hideImmediately();
    });

    // 3. Desaparición instantánea si se hace clic derecho (prioridad absoluta a selección de tesis)
    this.editorElement.addEventListener('contextmenu', () => {
      this.hideImmediately();
    });

    // 4. Si la selección se colapsa con un clic simple en el editor, ocultar
    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.toString().trim().length === 0) {
        if (this.isVisible) {
          this.hideSoftly();
        }
      }
    });

    // 5. Ocultar si el usuario hace scroll en el santuario
    const scrollContainer = this.editorElement.parentElement;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', () => {
        if (this.isVisible) {
          this.hideImmediately();
        }
      }, { passive: true });
    }

    // 6. Si se hace clic fuera del editor y fuera del HUD, ocultar
    document.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as Node;
      if (!this.container.contains(target) && !this.editorElement.contains(target)) {
        this.hideImmediately();
      }
    });
  }

  /**
   * Evalúa si hay texto seleccionado en el editor para posicionar el HUD.
   */
  private evaluateSelection(): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      this.hideSoftly();
      return;
    }

    // Verificar que la selección esté dentro del cuerpo editable
    if (!this.editorElement.contains(selection.anchorNode)) {
      this.hideSoftly();
      return;
    }

    const text = selection.toString().trim();
    // Exige al menos 2 caracteres seleccionados
    if (text.length < 2) {
      this.hideSoftly();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      this.hideSoftly();
      return;
    }

    this.showAtPosition(rect);
    this.updateActiveStates();
  }

  /**
   * Posiciona el HUD flotando suavemente sobre el texto seleccionado.
   */
  private showAtPosition(rect: DOMRect): void {
    this.container.style.display = 'flex';

    // Dimensiones del HUD
    const hudWidth = this.container.offsetWidth || 340;
    const hudHeight = this.container.offsetHeight || 38;

    // Centrado horizontal sobre la selección
    let left = rect.left + rect.width / 2 - hudWidth / 2;
    // Límite de márgenes de pantalla
    left = Math.max(16, Math.min(window.innerWidth - hudWidth - 16, left));

    // Flotando 10px por encima de la selección
    let top = rect.top - hudHeight - 10;
    // Si se sale por arriba de la pantalla, mostrar por debajo
    if (top < 70) {
      top = rect.bottom + 12;
    }

    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;

    // Pequeño timeout para animación CSS fluida
    requestAnimationFrame(() => {
      this.container.classList.add('visible');
      this.isVisible = true;
    });
  }

  /**
   * Oculta el HUD de manera instantánea (0ms) al teclear o dar clic derecho.
   */
  public hideImmediately(): void {
    if (this.mouseUpTimer) window.clearTimeout(this.mouseUpTimer);
    this.container.classList.remove('visible');
    this.container.style.display = 'none';
    this.isVisible = false;
  }

  /**
   * Desvanece el HUD suavemente al deseleccionar.
   */
  public hideSoftly(): void {
    if (this.mouseUpTimer) window.clearTimeout(this.mouseUpTimer);
    this.container.classList.remove('visible');
    setTimeout(() => {
      if (!this.container.classList.contains('visible')) {
        this.container.style.display = 'none';
        this.isVisible = false;
      }
    }, 250);
  }

  /**
   * Actualiza el estado visual de los botones de negrita y cursiva.
   */
  private updateActiveStates(): void {
    try {
      const isBold = document.queryCommandState('bold');
      const isItalic = document.queryCommandState('italic');

      if (isBold) {
        this.btnBold.classList.add('active');
      } else {
        this.btnBold.classList.remove('active');
      }

      if (isItalic) {
        this.btnItalic.classList.add('active');
      } else {
        this.btnItalic.classList.remove('active');
      }
    } catch {
      // Fallback silencioso
    }
  }

  /**
   * Alterna la negrita (Masa/Gravedad ontológica) con resonancia grave.
   */
  private toggleBold(): void {
    document.execCommand('bold', false);
    this.updateActiveStates();
    this.audio.play(260, 'sine', 0.25, 0.1);
  }

  /**
   * Alterna la cursiva (Voz interna/Reflexión íntima) con resonancia aérea.
   */
  private toggleItalic(): void {
    document.execCommand('italic', false);
    this.updateActiveStates();
    this.audio.play(540, 'triangle', 0.25, 0.08);
  }

  /**
   * Modula la escala de voz del fragmento seleccionado.
   */
  private applyTextScale(scale: TextScale): void {
    this.scaleButtons.forEach((btn, s) => {
      if (s === scale) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const selectedContent = range.extractContents();
    const span = document.createElement('span');
    span.className = `prose-voice-${scale}`;
    span.appendChild(selectedContent);
    range.insertNode(span);

    // Resonancia armónica de transición de escala
    const freq = scale === 'small' ? 380 : scale === 'normal' ? 440 : 580;
    this.audio.play(freq, 'sine', 0.22, 0.08);

    // Disparar input para persistencia en memoria viva
    this.editorElement.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Conmuta la atmósfera tipográfica global del santuario.
   */
  public applyTemperament(temp: TextTemperament): void {
    this.activeTemperament = temp;
    document.body.setAttribute('data-temperament', temp);

    this.temperamentButtons.forEach((btn, t) => {
      if (t === temp) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Frecuencias cromáticas según el temperamento
    const f = temp === 'piedra' ? 320 : temp === 'cristal' ? 528 : 410;
    this.audio.play(f, 'sine', 0.35, 0.1);
  }

  public getActiveTemperament(): TextTemperament {
    return this.activeTemperament;
  }
}
