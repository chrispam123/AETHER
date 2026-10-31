/**
 * ============================================================================
 * CAPA 3: HUD DE TEXTO FLOTANTE ("EL ALIENTO" · FORMATO LOCAL Y SECCIONES)
 * ============================================================================
 * Menú etéreo que se materializa tenuemente al seleccionar texto:
 * - Soporta tanto el TÍTULO (.crystal-title) como el CUERPO (.crystal-body).
 * - Aparición orgánica con MouseUp Delay (~160ms).
 * - Desaparición instantánea (0ms) ante cualquier tecla (keydown/input) o clic derecho.
 * - En el CUERPO:
 *   • Negrita (B · Gravedad / Masa de la palabra)
 *   • Cursiva (I · Voz interna / Susurro)
 *   • Escala de Voz: [ Íntimo (T⁻ 16px) | Prosa (T 20px) | Sección/Capítulo (T⁺ 28px) ]
 *     * T⁺ eleva el bloque a Título de Sección / Capítulo orgánico (Vía A).
 * - En el TÍTULO PRINCIPAL:
 *   • Modula la jerarquía completa del título: [ Íntimo (T⁻ 21px) | Clásico (T 32px) | Monumento (T⁺ 42px) ]
 *   • Permite también B e I.
 */

import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';

export type TextScale = 'small' | 'normal' | 'large';

export class TextHud {
  private container: HTMLDivElement;
  private editorElement: HTMLElement;
  private titleElement: HTMLElement | null;
  private audio: HarmonicSynthesizer;
  private mouseUpTimer: number | null = null;
  private isVisible: boolean = false;
  private activeTarget: 'body' | 'title' = 'body';

  private btnBold!: HTMLButtonElement;
  private btnItalic!: HTMLButtonElement;
  private scaleButtons: Map<TextScale, HTMLButtonElement> = new Map();

  constructor(
    editorElement: HTMLElement,
    titleElement: HTMLElement | null,
    audio: HarmonicSynthesizer
  ) {
    this.editorElement = editorElement;
    this.titleElement = titleElement;
    this.audio = audio;

    this.container = this.createHudElement();
    document.body.appendChild(this.container);

    this.bindEvents();
  }

  /**
   * Crea el elemento DOM del HUD con diseño esbelto.
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
      e.preventDefault();
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

    // 2. Grupo de Escala de Voz (Íntimo · Prosa · Sección/Capítulo)
    const scaleGroup = document.createElement('div');
    scaleGroup.className = 'hud-group hud-scale-group';

    const scales: Array<{ id: TextScale; label: string; title: string }> = [
      { id: 'small', label: 'T⁻', title: 'Íntimo / Discreto' },
      { id: 'normal', label: 'T', title: 'Prosa Serena / Título Clásico' },
      { id: 'large', label: 'T⁺', title: 'Sección / Capítulo Orgánico / Monumento' }
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

    return hud;
  }

  private createSeparator(): HTMLDivElement {
    const sep = document.createElement('div');
    sep.className = 'hud-separator';
    return sep;
  }

  /**
   * Conecta los escuchadores del ratón, selección y teclado en ambos elementos.
   */
  private bindEvents(): void {
    const targets = [this.editorElement, this.titleElement].filter(Boolean) as HTMLElement[];

    targets.forEach((el) => {
      el.addEventListener('mouseup', () => {
        if (this.mouseUpTimer) window.clearTimeout(this.mouseUpTimer);
        this.mouseUpTimer = window.setTimeout(() => {
          this.evaluateSelection();
        }, 160);
      });

      el.addEventListener('keydown', () => {
        this.hideImmediately();
      });

      el.addEventListener('beforeinput', () => {
        this.hideImmediately();
      });

      el.addEventListener('contextmenu', () => {
        this.hideImmediately();
      });
    });

    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.toString().trim().length === 0) {
        if (this.isVisible) {
          this.hideSoftly();
        }
      }
    });

    const scrollContainer = this.editorElement.parentElement;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', () => {
        if (this.isVisible) {
          this.hideImmediately();
        }
      }, { passive: true });
    }

    document.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideTargets = targets.some((el) => el.contains(target));
      if (!this.container.contains(target) && !isInsideTargets) {
        this.hideImmediately();
      }
    });
  }

  /**
   * Evalúa si hay texto seleccionado en el cuerpo o en el título.
   */
  private evaluateSelection(): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      this.hideSoftly();
      return;
    }

    const anchor = selection.anchorNode;
    const isInsideBody = this.editorElement.contains(anchor);
    const isInsideTitle = this.titleElement ? this.titleElement.contains(anchor) : false;

    if (!isInsideBody && !isInsideTitle) {
      this.hideSoftly();
      return;
    }

    this.activeTarget = isInsideTitle ? 'title' : 'body';

    const text = selection.toString().trim();
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

    const hudWidth = this.container.offsetWidth || 180;
    const hudHeight = this.container.offsetHeight || 38;

    let left = rect.left + rect.width / 2 - hudWidth / 2;
    left = Math.max(16, Math.min(window.innerWidth - hudWidth - 16, left));

    let top = rect.top - hudHeight - 10;
    if (top < 70) {
      top = rect.bottom + 12;
    }

    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;

    requestAnimationFrame(() => {
      this.container.classList.add('visible');
      this.isVisible = true;
    });
  }

  public hideImmediately(): void {
    if (this.mouseUpTimer) window.clearTimeout(this.mouseUpTimer);
    this.container.classList.remove('visible');
    this.container.style.display = 'none';
    this.isVisible = false;
  }

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
      // Fallback
    }

    // Reflejar escala activa si es en título
    if (this.activeTarget === 'title' && this.titleElement) {
      const currentScale = this.titleElement.dataset.titleScale || 'normal';
      this.scaleButtons.forEach((btn, s) => {
        btn.classList.toggle('active', s === currentScale);
      });
    }
  }

  private toggleBold(): void {
    document.execCommand('bold', false);
    this.updateActiveStates();
    this.audio.play(260, 'sine', 0.25, 0.1);
  }

  private toggleItalic(): void {
    document.execCommand('italic', false);
    this.updateActiveStates();
    this.audio.play(540, 'triangle', 0.25, 0.08);
  }

  /**
   * Modula la escala de voz:
   * - En TÍTULO: Modula la jerarquía completa del título (Íntimo 21px, Clásico 32px, Monumental 42px).
   * - En CUERPO: Modula fragmentos de texto o eleva el bloque a Sección/Capítulo Orgánico (Vía A).
   */
  private applyTextScale(scale: TextScale): void {
    this.scaleButtons.forEach((btn, s) => {
      btn.classList.toggle('active', s === scale);
    });

    if (this.activeTarget === 'title' && this.titleElement) {
      // 1. Modulación armónica del Título Principal
      this.titleElement.dataset.titleScale = scale;
      this.titleElement.classList.remove('scale-small', 'scale-normal', 'scale-large');
      this.titleElement.classList.add(`scale-${scale}`);

      const freq = scale === 'small' ? 320 : scale === 'normal' ? 440 : 540;
      this.audio.play(freq, 'sine', 0.3, 0.1);
      return;
    }

    // 2. Modulación dentro del Cuerpo (Vía A: Capítulos y Secciones Orgánicas)
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);

    // 1. Extraemos el texto y desarmamos cualquier span de voz interno previo
    const frag = range.cloneContents();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(frag);

    // Si había spans de voz anidados dentro del fragmento, los desarmamos
    tempDiv.querySelectorAll('.prose-voice-small, .prose-voice-normal, .prose-voice-large').forEach((el) => {
      const parent = el.parentNode;
      while (el.firstChild) {
        parent?.insertBefore(el.firstChild, el);
      }
      parent?.removeChild(el);
    });

    const cleanFragment = document.createDocumentFragment();
    while (tempDiv.firstChild) {
      cleanFragment.appendChild(tempDiv.firstChild);
    }

    // 2. Comprobamos si el ancestro directo es un span de voz
    let ancestor = range.commonAncestorContainer as HTMLElement;
    if (ancestor.nodeType === Node.TEXT_NODE) {
      ancestor = ancestor.parentElement as HTMLElement;
    }
    const isInsideVoiceSpan = Boolean(
      ancestor &&
      (ancestor.classList.contains('prose-voice-small') ||
       ancestor.classList.contains('prose-voice-normal') ||
       ancestor.classList.contains('prose-voice-large'))
    );

    let replacementNode: Node;

    if (isInsideVoiceSpan && ancestor) {
      // Si el contenedor padre ya es un span de voz, simplemente cambiamos su clase
      ancestor.classList.remove('prose-voice-small', 'prose-voice-normal', 'prose-voice-large');
      if (scale !== 'normal') {
        ancestor.classList.add(`prose-voice-${scale}`);
      } else {
        // En normal, quitamos el contenedor y dejamos el texto plano
        const p = ancestor.parentNode;
        while (ancestor.firstChild) {
          p?.insertBefore(ancestor.firstChild, ancestor);
        }
        p?.removeChild(ancestor);
      }
      replacementNode = ancestor;
    } else {
      range.deleteContents();
      if (scale === 'normal') {
        range.insertNode(cleanFragment);
        replacementNode = cleanFragment;
      } else {
        const span = document.createElement('span');
        span.className = `prose-voice-${scale}`;
        span.appendChild(cleanFragment);
        range.insertNode(span);
        replacementNode = span;
      }
    }

    // 3. Volvemos a seleccionar el nodo reemplazado para que el usuario pueda seguir pulsando T⁻, T, T⁺
    try {
      const newRange = document.createRange();
      newRange.selectNodeContents(replacementNode);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } catch {
      // Fallback
    }

    const freq = scale === 'small' ? 380 : scale === 'normal' ? 440 : 580;
    this.audio.play(freq, 'sine', 0.25, 0.1);

    this.editorElement.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
