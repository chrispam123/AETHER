/**
 * ============================================================================
 * CAPA 3: GESTOR DE FOCO MONÁSTICO, HIPERFOCO & TYPEWRITER SCROLL
 * ============================================================================
 * Implementa el Pilar 2 del Manifiesto de Aether con máxima pureza UX:
 * 1. Pulso de Presencia: Halo sutil que sigue al cursor en tiempo real.
 * 2. Hiperfoco Periférico: Atenúa la periferia de la UI durante la cadencia viva.
 * 3. Enfoque Monástico (Dimming de Párrafos):
 *    - El párrafo vivo o título activo permanece al 100% de luz y contraste.
 *    - Los párrafos anteriores y posteriores descienden con suavidad al 45%-55%.
 *    - Caso C (Híbrido):
 *      * Respiración automática al escribir (tras pausa de 3s vuelve al 100%).
 *      * Anclaje permanente con atajo Alt + Z o botón ◎ Enfoque en la barra de métricas.
 * 4. Typewriter Scroll: Mantiene el párrafo vivo suavemente centrado a la altura de los ojos (~40%).
 */

import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';

export interface FocusOptions {
  /** Milisegundos de inactividad antes de suspender el modo automático (por defecto 3000ms) */
  idleDelayMs?: number;
}

export class FocusManager {
  private idleDelayMs: number;
  private idleTimer: number | null = null;
  private isHyperfocusActive: boolean = false;
  private isPinned: boolean = false;
  private isAutoDimActive: boolean = false;

  private trackedElement: HTMLElement | null = null;
  private titleElement: HTMLElement | null = null;
  private scrollContainer: HTMLElement | null = null;
  private audio: HarmonicSynthesizer | null = null;
  private presenceHalo: HTMLDivElement;

  private activeBlock: HTMLElement | null = null;
  private btnFocusToggle: HTMLButtonElement | null = null;
  private typewriterTimer: number | null = null;

  constructor(options: FocusOptions = {}) {
    this.idleDelayMs = options.idleDelayMs ?? 3000;
    this.presenceHalo = this.createPresenceHalo();
  }

  /**
   * Crea el elemento visual del Pulso de Presencia en el DOM.
   */
  private createPresenceHalo(): HTMLDivElement {
    const halo = document.createElement('div');
    halo.className = 'presence-pulse';
    halo.style.display = 'none';
    document.body.appendChild(halo);
    return halo;
  }

  /**
   * Vincula el gestor de foco a los elementos del Santuario Editorial.
   */
  public attach(
    element: HTMLElement,
    scrollContainer?: HTMLElement,
    titleElement?: HTMLElement | null,
    audio?: HarmonicSynthesizer
  ): void {
    this.trackedElement = element;
    this.scrollContainer = scrollContainer || null;
    this.titleElement = titleElement || null;
    this.audio = audio || null;

    // 1. Asegurar separación semántica nativa por párrafos (<p>)
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      // Fallback
    }
    this.normalizeParagraphs();

    // 2. Conectar el botón ◎ Enfoque en la barra de métricas
    this.btnFocusToggle = document.getElementById('btn-focus-toggle') as HTMLButtonElement | null;
    if (this.btnFocusToggle) {
      this.btnFocusToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.togglePinnedFocus();
      });
    }

    // 3. Atajo global Alt + Z
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ')) {
        e.preventDefault();
        this.togglePinnedFocus();
      }
    });

    // 4. Escuchadores en el contenedor de scroll
    if (this.scrollContainer) {
      this.scrollContainer.addEventListener('scroll', () => {
        if (document.activeElement === this.trackedElement || document.activeElement === this.titleElement) {
          this.updatePresencePosition();
        }
      }, { passive: true });
    }

    // 5. Escuchadores en el Cuerpo de Prosa
    const targets = [this.trackedElement, this.titleElement].filter(Boolean) as HTMLElement[];

    targets.forEach((target) => {
      target.addEventListener('keydown', (e) => {
        // En el título, pulsar Enter salta elegantemente al cuerpo en vez de crear saltos vacíos
        if (target === this.titleElement && e.key === 'Enter') {
          e.preventDefault();
          if (this.trackedElement) {
            const firstP = this.trackedElement.firstElementChild as HTMLElement;
            if (firstP) {
              firstP.focus();
              const range = document.createRange();
              range.selectNodeContents(firstP);
              range.collapse(true);
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
            } else {
              this.trackedElement.focus();
            }
            this.updateActiveParagraph();
            this.updatePresencePosition();
          }
          return;
        }

        this.handleActivity();
        if (e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete') {
          // El navegador genera o destruye nodos en el DOM; en el siguiente tick limpiamos clases clonadas
          setTimeout(() => {
            this.updateActiveParagraph();
            this.updatePresencePosition();
            this.triggerTypewriterScroll();
          }, 15);
        }
      });

      target.addEventListener('input', () => {
        this.handleActivity();
        this.updateActiveParagraph();
        requestAnimationFrame(() => {
          this.updatePresencePosition();
          this.triggerTypewriterScroll();
        });
      });

      target.addEventListener('click', () => {
        this.updateActiveParagraph();
        requestAnimationFrame(() => this.updatePresencePosition());
      });

      target.addEventListener('keyup', (e) => {
        if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') {
          this.updateActiveParagraph();
          requestAnimationFrame(() => {
            this.updatePresencePosition();
            this.triggerTypewriterScroll();
          });
        }
      });

      target.addEventListener('focus', () => {
        this.showPresenceHalo();
        this.updateActiveParagraph();
        this.updatePresencePosition();
      });

      target.addEventListener('blur', () => {
        this.hidePresenceHalo();
        if (!this.isPinned) {
          this.exitHyperfocus();
          this.isAutoDimActive = false;
          this.scrollContainer?.classList.remove('focus-dim-mode');
        }
      });
    });

    // 6. Escuchar cambios de selección global
    document.addEventListener('selectionchange', () => {
      const activeEl = document.activeElement;
      if (activeEl === this.trackedElement || activeEl === this.titleElement) {
        this.updateActiveParagraph();
        this.updatePresencePosition();
      }
    });

    // Estado inicial de párrafo activo
    setTimeout(() => {
      this.updateActiveParagraph();
    }, 100);
  }

  /**
   * Asegura que el contenido del cuerpo esté envuelto en párrafos <p> limpios.
   */
  private normalizeParagraphs(): void {
    if (!this.trackedElement) return;

    const existingP = this.trackedElement.querySelectorAll('p');
    if (existingP.length > 0) return;

    const raw = this.trackedElement.innerText.trim();
    if (raw.length === 0) {
      this.trackedElement.innerHTML = '<p><br></p>';
      return;
    }

    const blocks = raw.split(/\r?\n\s*\r?\n+/).map((b) => b.trim()).filter((b) => b.length > 0);
    if (blocks.length > 0) {
      this.trackedElement.innerHTML = blocks.map((b) => `<p>${b}</p>`).join('');
    }
  }

  /**
   * Conmuta el modo de Enfoque Monástico Anclado (Alt + Z).
   */
  public togglePinnedFocus(): void {
    this.isPinned = !this.isPinned;

    if (this.btnFocusToggle) {
      this.btnFocusToggle.classList.toggle('active', this.isPinned);
    }

    if (this.isPinned) {
      // Activar foco fijo
      this.scrollContainer?.classList.add('focus-dim-mode');
      this.updateActiveParagraph();
      this.triggerTypewriterScroll(true);
      this.audio?.play(540, 'sine', 0.25, 0.12);
    } else {
      // Apagar anclaje: si no estamos tecleando en ese instante, relajamos el dimming
      if (!this.isAutoDimActive) {
        this.scrollContainer?.classList.remove('focus-dim-mode');
      }
      this.audio?.play(360, 'sine', 0.2, 0.08);
    }
  }

  /**
   * Se ejecuta con cada pulsación de tecla para modular la respiración del foco.
   */
  private handleActivity(): void {
    // 1. Activar Hiperfoco periférico si no estaba activo
    if (!this.isHyperfocusActive) {
      this.enterHyperfocus();
    }

    // 2. Respiración automática del Enfoque Monástico (si no está ya anclado)
    if (!this.isPinned) {
      this.isAutoDimActive = true;
      this.scrollContainer?.classList.add('focus-dim-mode');
    }

    // 3. Reiniciar temporizador de inactividad
    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer);
    }

    this.idleTimer = window.setTimeout(() => {
      this.exitHyperfocus();
      if (!this.isPinned) {
        this.isAutoDimActive = false;
        this.scrollContainer?.classList.remove('focus-dim-mode');
      }
    }, this.idleDelayMs);
  }

  /**
   * Detecta y marca el párrafo o título donde se encuentra actualmente el cursor.
   * Garantiza que ÚNICAMENTE un bloque en todo el santuario tenga la clase is-active-focus.
   */
  public updateActiveParagraph(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    let node: Node | null = selection.anchorNode;
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    let newActive: HTMLElement | null = null;

    // A. ¿Está en el Título Principal?
    if (this.titleElement && (this.titleElement === node || this.titleElement.contains(node))) {
      newActive = this.titleElement;
    }
    // B. ¿Está dentro del Cuerpo de Prosa?
    else if (this.trackedElement && (this.trackedElement === node || this.trackedElement.contains(node))) {
      // Localizamos el hijo DIRECTO de trackedElement (p, div, blockquote, etc.) que contiene al nodo
      let curr: Node | null = node;
      while (curr && curr.parentNode !== this.trackedElement && curr !== document.body) {
        curr = curr.parentNode;
      }

      if (curr instanceof HTMLElement && curr.parentNode === this.trackedElement) {
        newActive = curr;
      } else if (node === this.trackedElement) {
        // Si el cursor está en la raíz, buscar el hijo en el offset o el primer elemento
        const childAtOffset = this.trackedElement.children[selection.anchorOffset];
        newActive = (childAtOffset as HTMLElement) || (this.trackedElement.firstElementChild as HTMLElement) || null;
      }
    }

    // Fallback si el foco está activo en el editor
    if (!newActive && document.activeElement === this.trackedElement) {
      newActive = (this.trackedElement?.firstElementChild as HTMLElement) || null;
    }

    // LIMPIEZA TOTAL: Remover 'is-active-focus' de CUALQUIER elemento en el santuario que no sea newActive
    const root = this.scrollContainer || document.body;
    root.querySelectorAll('.is-active-focus').forEach((el) => {
      if (el !== newActive) {
        el.classList.remove('is-active-focus');
      }
    });

    if (newActive) {
      newActive.classList.add('is-active-focus');
      this.activeBlock = newActive;
    }
  }

  /**
   * Desplaza suavemente el contenedor para mantener el párrafo activo centrado (~40% de la ventana).
   */
  private triggerTypewriterScroll(immediate: boolean = false): void {
    if (!this.scrollContainer || !this.activeBlock) return;

    if (this.typewriterTimer) {
      window.clearTimeout(this.typewriterTimer);
      this.typewriterTimer = null;
    }

    const doScroll = () => {
      if (!this.scrollContainer || !this.activeBlock) return;

      const sRect = this.scrollContainer.getBoundingClientRect();
      const bRect = this.activeBlock.getBoundingClientRect();

      // Posición del bloque dentro del flujo de scroll
      const relativeTop = bRect.top - sRect.top;
      const targetHeight = this.scrollContainer.clientHeight;
      const eyeLevel = targetHeight * 0.40;

      // Solo desplazar si la desviación es notable (> 35px) para evitar temblores
      const drift = relativeTop - eyeLevel;
      if (Math.abs(drift) > 35 || immediate) {
        const targetScrollTop = this.scrollContainer.scrollTop + drift;
        this.scrollContainer.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        });
      }
    };

    if (immediate) {
      doScroll();
    } else {
      this.typewriterTimer = window.setTimeout(doScroll, 80);
    }
  }

  /**
   * Activa el estado de hiperfoco en el cuerpo de la página.
   */
  private enterHyperfocus(): void {
    this.isHyperfocusActive = true;
    document.body.classList.add('hyperfocus-active');
    this.presenceHalo.classList.add('active-typing');
  }

  /**
   * Restaura la interfaz periférica cuando el usuario se detiene a reflexionar.
   */
  private exitHyperfocus(): void {
    this.isHyperfocusActive = false;
    document.body.classList.remove('hyperfocus-active');
    this.presenceHalo.classList.remove('active-typing');

    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Calcula la posición exacta del cursor de texto en pantalla y mueve el halo de luz.
   */
  public updatePresencePosition(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    let x = 0;
    let y = 0;
    let height = 22;
    let found = false;

    // 1. getClientRects
    const rects = range.getClientRects();
    if (rects.length > 0) {
      const r = rects[rects.length - 1];
      if (r.height > 0 && (r.top !== 0 || r.left !== 0)) {
        x = r.left;
        y = r.top;
        height = r.height;
        found = true;
      }
    }

    // 2. getBoundingClientRect
    if (!found) {
      const r = range.getBoundingClientRect();
      if (r.height > 0 && (r.top !== 0 || r.left !== 0)) {
        x = r.left;
        y = r.top;
        height = r.height;
        found = true;
      }
    }

    // 3. Fallback en línea vacía
    if (!found || (x === 0 && y === 0)) {
      try {
        const marker = document.createElement('span');
        marker.appendChild(document.createTextNode('\u200B'));
        marker.style.display = 'inline-block';
        marker.style.width = '0px';
        marker.style.height = '1em';
        marker.style.lineHeight = 'normal';

        const clone = range.cloneRange();
        clone.insertNode(marker);
        const markerRect = marker.getBoundingClientRect();
        marker.parentNode?.removeChild(marker);

        if (markerRect.top !== 0 || markerRect.left !== 0) {
          x = markerRect.left;
          y = markerRect.top;
          height = markerRect.height || 22;
          found = true;
        }
      } catch {
        // Fallback silencioso
      }
    }

    if (found) {
      this.presenceHalo.style.display = 'block';
      const opticalX = Math.round(x);
      const opticalY = Math.round(y + 2);
      this.presenceHalo.style.transform = `translate3d(${opticalX}px, ${opticalY}px, 0)`;
      this.presenceHalo.style.height = `${Math.max(height - 4, 18)}px`;
    }
  }

  public showPresenceHalo(): void {
    this.presenceHalo.style.display = 'block';
  }

  public hidePresenceHalo(): void {
    this.presenceHalo.style.display = 'none';
  }

  public isInHyperfocus(): boolean {
    return this.isHyperfocusActive;
  }

  public isFocusPinned(): boolean {
    return this.isPinned;
  }

  /**
   * Llamado al entrar o retornar al Modo Prosa (100%).
   * Asegura que el texto vuelva a iluminarse plenamente al 100% si no está anclado.
   */
  public onEnterProseView(): void {
    if (!this.isPinned) {
      this.isAutoDimActive = false;
      this.scrollContainer?.classList.remove('focus-dim-mode');
      if (this.idleTimer !== null) {
        window.clearTimeout(this.idleTimer);
        this.idleTimer = null;
      }
    } else {
      this.scrollContainer?.classList.add('focus-dim-mode');
    }

    this.showPresenceHalo();
    setTimeout(() => {
      this.updateActiveParagraph();
      this.updatePresencePosition();
    }, 50);
  }

  /**
   * Llamado al salir de Prosa hacia Tesis (50%) o Estructura (20%).
   */
  public onLeaveProseView(): void {
    this.hidePresenceHalo();
    if (!this.isPinned) {
      this.isAutoDimActive = false;
      this.scrollContainer?.classList.remove('focus-dim-mode');
      if (this.idleTimer !== null) {
        window.clearTimeout(this.idleTimer);
        this.idleTimer = null;
      }
    }
  }
}
