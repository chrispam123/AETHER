/**
 * ============================================================================
 * CAPA 3: SANTUARIO EDITORIAL MONÁSTICO (EDITORIAL EDITOR)
 * ============================================================================
 * Gestiona el entorno de escritura pura en estado Cristal:
 * - Título y cuerpo de prosa con tipografía monástica y scroll vertical natural.
 * - Pilar 3 (Zoom Semántico de Bret Victor):
 *   * Nivel 100% ('prose'): Edición de prosa completa.
 *   * Nivel 50% ('thesis'): Frases nucleares con acordeón plegado.
 *   * Nivel 20% ('map'): Cartografía de bloques argumentales.
 * - Elección de la Tesis Nuclear por el autor mediante CLIC DERECHO sobre cualquier frase.
 * - Estante Flotante Colapsable de "Materia Prima" con ideas destiladas.
 * - Margen de Descartes permanente e interceptación de borrado/corte.
 */

import { DocumentGraph } from '../../core/DocumentGraph';
import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';
import { DiscardGutter } from '../margin/DiscardGutter';
import { RawGutter } from '../margin/RawGutter';
import { SemanticZoomController } from '../../engine/SemanticZoomController';
import { SemanticLevel, ThoughtNode } from '../../core/types';
import { SemanticZoomView, ParagraphBlock } from './SemanticZoomView';
import { TextHud } from './TextHud';
import { FocusManager } from '../focus/FocusManager';
import { PressModal } from '../press/PressModal';

export class EditorialEditor {
  private container: HTMLDivElement;
  private bodyElement: HTMLDivElement;
  private wordCountEl: HTMLSpanElement;
  private readTimeEl: HTMLSpanElement;
  private pageCountEl: HTMLSpanElement | null;
  private chipsContainer: HTMLDivElement;
  private rawShelf: HTMLDivElement | null;
  private rawToggleBtn: HTMLButtonElement | null;
  private rawLabel: HTMLSpanElement | null;

  // Elementos del Zoom Semántico
  private thesisContainer: HTMLDivElement;
  private mapContainer: HTMLDivElement;
  private thesisToast: HTMLDivElement | null;
  private semanticView: SemanticZoomView;
  private zoomController: SemanticZoomController | null = null;
  private manualTheses: Map<number, string> = new Map();
  private toastTimer: number | null = null;
  private cachedRawText: string = '';
  private textHud: TextHud | null = null;
  private focusManager: FocusManager | null = null;
  private pressModal: PressModal;
  private savedCaret: {
    isTitle: boolean;
    paragraphIndex: number;
    nodeId?: string;
    charOffset: number;
  } | null = null;

  private graph: DocumentGraph;
  private audio: HarmonicSynthesizer;
  private gutter: DiscardGutter | null = null;
  private rawGutter: RawGutter | null = null;

  constructor(graph: DocumentGraph, audio: HarmonicSynthesizer) {
    this.graph = graph;
    this.audio = audio;

    this.container = document.getElementById('crystal-sanctuary') as HTMLDivElement;
    this.bodyElement = document.querySelector('.crystal-body') as HTMLDivElement;
    this.wordCountEl = document.getElementById('word-count') as HTMLSpanElement;
    this.readTimeEl = document.getElementById('read-time') as HTMLSpanElement;
    this.pageCountEl = document.getElementById('page-count') as HTMLSpanElement | null;
    this.chipsContainer = document.getElementById('crystal-chips-container') as HTMLDivElement;
    this.rawShelf = document.getElementById('crystal-raw-shelf') as HTMLDivElement | null;
    this.rawToggleBtn = document.getElementById('raw-shelf-toggle') as HTMLButtonElement | null;
    this.rawLabel = document.getElementById('raw-shelf-label') as HTMLSpanElement | null;

    // Inicialización de contenedores para el Zoom Semántico
    this.thesisContainer = document.getElementById('crystal-thesis-view') as HTMLDivElement;
    this.mapContainer = document.getElementById('crystal-map-view') as HTMLDivElement;
    this.thesisToast = document.getElementById('crystal-thesis-toast') as HTMLDivElement | null;

    this.semanticView = new SemanticZoomView(
      this.thesisContainer,
      this.mapContainer,
      this.audio
    );

    // Salto al hacer clic en un bloque de tesis hacia el modo prosa enfocado
    this.semanticView.onJumpToParagraph((pIndex, targetEl) => this.jumpToParagraph(pIndex, targetEl));

    const titleEl = document.getElementById('crystal-title');
    if (this.bodyElement) {
      const blocks = this.getStructuredBlocks();
      this.cachedRawText = blocks.length > 0 ? blocks.map((b) => b.text).join('\n\n') : this.bodyElement.innerText;
      this.textHud = new TextHud(this.bodyElement, titleEl, this.audio);
    }

    this.initMetrics();
    this.initDeletionInterceptor();
    this.initRawShelfToggle();
    this.initRightClickThesisSelection();
    this.updateChips();

    // La Prensa Editorial (Maquetación e Impresión para Sociedad/Empresa)
    this.pressModal = new PressModal(this.audio);
    this.initPressButton();

    // Actualiza los chips cuando el grafo de ideas cambie
    this.graph.subscribe(() => this.updateChips());

    // Persistencia del cursor: registra la posición exacta del cursor en todo momento
    document.addEventListener('selectionchange', () => {
      if (this.container?.classList.contains('active')) {
        this.saveCaretPosition();
      }
    });
  }

  /**
   * Conecta el botón de La Prensa y el atajo global Ctrl+P en modo Cristal.
   */
  private initPressButton(): void {
    const pressBtn = document.getElementById('btn-press-open');
    pressBtn?.addEventListener('click', () => {
      this.openPress();
    });

    // Atajo global Ctrl+P / Cmd+P cuando estamos en el Santuario
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        // Solo interceptar si el santuario de Cristal está activo y visible
        if (this.container && this.container.style.display !== 'none') {
          e.preventDefault();
          this.openPress();
        }
      }
    });
  }

  /**
   * Abre La Prensa inyectando el contenido vivo de Cristal al pliego físico.
   */
  public openPress(): void {
    const titleEl = this.getTitleElement();
    const title = titleEl?.innerText.trim() || 'Sin Título';
    const blocks = this.getStructuredBlocks();
    const paragraphs =
      blocks.length > 0
        ? blocks.map((b) => b.text)
        : this.bodyElement?.innerText.trim()
        ? [this.bodyElement.innerText.trim()]
        : [];

    this.pressModal.open({ title, paragraphs });
  }

  /**
   * Conecta el controlador de Zoom Semántico con la vista editorial.
   */
  public setSemanticZoomController(controller: SemanticZoomController): void {
    this.zoomController = controller;
    this.zoomController.onChange((state) => {
      this.applySemanticZoom(state.level);
    });
  }

  /**
   * Conecta el gestor de foco monástico.
   */
  public setFocusManager(fm: FocusManager): void {
    this.focusManager = fm;
  }

  /**
   * Conecta los manejadores de exportación de La Prensa.
   */
  public setPressExportHandlers(handlers: { onExportMarkdown?: () => void; onExportAether?: () => void }): void {
    this.pressModal.setExportHandlers(handlers);
  }

  /**
   * Vía 2: Regla del Doble Enter Explícito
   * Extrae los bloques argumentales directamente del DOM:
   * - Saltos de línea simples (Enter) continúan la idea dentro del mismo bloque.
   * - Solo un salto de línea doble (párrafo vacío / Doble Enter explícito) genera un nuevo bloque argumental.
   */
  /**
   * Extrae el texto legible de un elemento preservando los saltos de línea internos (<br>).
   */
  private extractElementText(el: HTMLElement): string {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    return (clone.textContent || '')
      .replace(/[\u200B\u00A0]/g, ' ')
      .trim();
  }

  /**
   * Vía 2: Regla del Doble Enter Explícito y Agrupación de Líneas Contiguas
   * Extrae los bloques argumentales directamente del DOM:
   * - Saltos de línea simples (Enter simple / renglones contiguos) forman parte de la misma tarjeta/idea.
   * - Solo un salto de línea doble (renglón en blanco / <p><br></p>) separa y da a luz a una nueva tarjeta.
   */
  public getStructuredBlocks(): { text: string; targetElement: HTMLElement; elements: HTMLElement[] }[] {
    if (!this.bodyElement) return [];

    const blocks: { text: string; targetElement: HTMLElement; elements: HTMLElement[] }[] = [];
    const children = Array.from(this.bodyElement.children) as HTMLElement[];

    if (children.length === 0) {
      const raw = this.bodyElement.innerText.trim();
      if (raw.length > 0) {
        const rawBlocks = raw.split(/\r?\n\s*\r?\n+/).map((b) => b.trim()).filter((b) => b.length > 0);
        return rawBlocks.map((b) => ({ text: b, targetElement: this.bodyElement, elements: [this.bodyElement] }));
      }
      return [];
    }

    let currentGroup: { texts: string[]; primaryElement: HTMLElement; elements: HTMLElement[] } | null = null;

    const commitCurrentGroup = () => {
      if (currentGroup && currentGroup.texts.length > 0) {
        const combinedText = currentGroup.texts.join('\n').trim();
        if (combinedText.length > 0) {
          blocks.push({
            text: combinedText,
            targetElement: currentGroup.primaryElement,
            elements: currentGroup.elements
          });
        }
      }
      currentGroup = null;
    };

    for (const child of children) {
      const cleanText = this.extractElementText(child);

      // Si el elemento no tiene texto (es un renglón en blanco / párrafo vacío de Doble Enter)
      if (cleanText.length === 0) {
        commitCurrentGroup();
      } else {
        if (!currentGroup) {
          currentGroup = {
            texts: [cleanText],
            primaryElement: child,
            elements: [child]
          };
        } else {
          // Renglón contiguo sin línea en blanco intermedia: pertenece al mismo bloque argumental
          currentGroup.texts.push(cleanText);
          currentGroup.elements.push(child);
        }
      }
    }

    commitCurrentGroup();
    return blocks;
  }

  /**
   * Obtiene el texto en prosa del autor garantizando que nunca se degrade
   * al alternar entre vistas cuando el elemento DOM está temporalmente oculto (display: none).
   */
  public getRawText(): string {
    if (this.bodyElement && this.bodyElement.style.display !== 'none') {
      const blocks = this.getStructuredBlocks();
      if (blocks.length > 0) {
        this.cachedRawText = blocks.map((b) => b.text).join('\n\n');
      } else {
        const raw = this.bodyElement.innerText.trim();
        if (raw.length > 0) {
          this.cachedRawText = raw;
        }
      }
    }
    return this.cachedRawText || this.bodyElement?.innerText || '';
  }

  /**
   * Conecta la selección deliberada de Frase Tesis mediante CLIC DERECHO.
   */
  private initRightClickThesisSelection(): void {
    if (!this.bodyElement) return;

    this.bodyElement.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();

      // 1. Obtener la posición del texto bajo el puntero
      let range: Range | null = null;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
      }

      const text = this.getRawText();
      // Los párrafos se delimitan por líneas en blanco (doble salto de línea / doble Enter)
      const paragraphs = text.split(/\r?\n\s*\r?\n+/).map(p => p.trim()).filter(p => p.length > 0);
      if (paragraphs.length === 0) return;

      // 2. Si hay texto seleccionado por el usuario, usarlo directamente
      const selection = window.getSelection();
      const selectedText = selection && !selection.isCollapsed ? selection.toString().trim() : '';

      let targetSentence = '';
      let targetPIndex = 0;

      if (selectedText.length >= 3) {
        targetSentence = selectedText;
        for (let i = 0; i < paragraphs.length; i++) {
          if (paragraphs[i].includes(selectedText)) {
            targetPIndex = i;
            break;
          }
        }
      } else {
        // Localizar el offset de carácter global del clic para determinar el párrafo exacto
        let clickedCharIndex = -1;
        if (range) {
          try {
            const preRange = document.createRange();
            preRange.selectNodeContents(this.bodyElement);
            preRange.setEnd(range.startContainer, range.startOffset);
            clickedCharIndex = preRange.toString().length;
          } catch {
            clickedCharIndex = -1;
          }
        }

        if (clickedCharIndex >= 0) {
          let searchOffset = 0;
          for (let i = 0; i < paragraphs.length; i++) {
            const pText = paragraphs[i];
            const pStart = text.indexOf(pText, searchOffset);
            const pEnd = pStart !== -1 ? pStart + pText.length : searchOffset + pText.length;
            if (pStart !== -1) searchOffset = pEnd;

            // Verificamos si el clic ocurrió dentro de este párrafo
            if (clickedCharIndex >= pStart && clickedCharIndex <= pEnd + 2) {
              targetPIndex = i;
              const offsetInP = Math.max(0, clickedCharIndex - (pStart !== -1 ? pStart : 0));
              const sentences = pText
                .split(/(?<=[.!?])\s+|\r?\n+/)
                .map(s => s.trim())
                .filter(s => s.length > 0);

              let sSearchOffset = 0;
              targetSentence = sentences[0] || pText;
              for (const s of sentences) {
                const sStart = pText.indexOf(s, sSearchOffset);
                const sEnd = sStart !== -1 ? sStart + s.length : sSearchOffset + s.length;
                if (sStart !== -1) sSearchOffset = sEnd;

                if (offsetInP >= sStart && offsetInP <= sEnd + 2) {
                  targetSentence = s;
                  break;
                }
              }
              break;
            }
          }
        }

        // Respaldo por contenedor de texto directo si el rango está disponible
        if (!targetSentence && range?.startContainer?.textContent) {
          const containerText = range.startContainer.textContent.trim();
          for (let i = 0; i < paragraphs.length; i++) {
            if (paragraphs[i].includes(containerText)) {
              targetPIndex = i;
              const sentences = paragraphs[i]
                .split(/(?<=[.!?])\s+|\r?\n+/)
                .map(s => s.trim())
                .filter(s => s.length > 0);
              const found = sentences.find(s => s.includes(containerText) || containerText.includes(s));
              if (found) {
                targetSentence = found;
                break;
              }
            }
          }
        }

        // Fallback robusto
        if (!targetSentence) {
          targetPIndex = Math.min(targetPIndex, paragraphs.length - 1);
          targetSentence = paragraphs[targetPIndex] || paragraphs[0];
        }
      }

      // 3. Alternar la frase como Tesis elegida
      const currentManual = this.manualTheses.get(targetPIndex);
      if (currentManual === targetSentence) {
        // Si ya era la tesis, se desmarca y vuelve a la primera por defecto
        this.manualTheses.delete(targetPIndex);
        this.showToast('↩️ Tesis restaurada a la primera frase por defecto');
        this.audio.play(380, 'sine', 0.25, 0.08);
      } else {
        // Se establece como la nueva tesis nuclear
        this.manualTheses.set(targetPIndex, targetSentence);
        this.showToast('✨ Frase elegida como Tesis del párrafo');
        this.audio.play(580, 'sine', 0.45, 0.16);
      }

      // Si nos encontramos en modo Tesis o Mapa, refrescamos la vista de inmediato
      const activeLevel = this.zoomController?.getLevel() || 'prose';
      if (activeLevel !== 'prose') {
        this.applySemanticZoom(activeLevel);
      }
    });
  }

  /**
   * Muestra un aviso mineral flotante en pantalla.
   */
  public showToast(message: string, durationMs: number = 2800): void {
    if (!this.thesisToast) return;

    this.thesisToast.innerText = message;
    this.thesisToast.classList.add('visible');

    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.thesisToast?.classList.remove('visible');
    }, durationMs);
  }

  /**
   * Aplica la transformación de densidad conceptual según el nivel de zoom (Vía 2: Regla del Doble Enter).
   */
  public applySemanticZoom(level: SemanticLevel): void {
    const blocksData = this.getStructuredBlocks();
    let blocks: ParagraphBlock[];

    if (blocksData.length > 0) {
      this.cachedRawText = blocksData.map((b) => b.text).join('\n\n');
      blocks = this.semanticView.parseBlocks(blocksData, this.manualTheses);
    } else {
      const rawText = this.getRawText();
      blocks = this.semanticView.parseParagraphs(rawText, this.manualTheses);
    }

    if (level !== 'prose') {
      this.textHud?.hideImmediately();
      this.focusManager?.onLeaveProseView();
    } else {
      this.focusManager?.onEnterProseView();
    }

    if (level === 'prose') {
      // 100%: Prosa continua completa
      this.bodyElement.style.display = 'block';
      this.thesisContainer.style.display = 'none';
      this.mapContainer.style.display = 'none';
      if (this.wordCountEl) this.wordCountEl.parentElement!.style.display = 'flex';
      this.gutter?.setVisible(true);
      this.rawGutter?.setVisible(true);
    } else if (level === 'thesis') {
      // 50%: Frases tesis destacadas y relleno secundario plegado
      this.bodyElement.style.display = 'none';
      this.thesisContainer.style.display = 'flex';
      this.mapContainer.style.display = 'none';
      this.semanticView.renderThesisView(blocks);
      if (this.wordCountEl) this.wordCountEl.parentElement!.style.display = 'none';
      this.gutter?.setVisible(false);
      this.rawGutter?.setVisible(false);
    } else if (level === 'map') {
      // 20%: Cartografía modular de bloques argumentales
      this.bodyElement.style.display = 'none';
      this.thesisContainer.style.display = 'none';
      this.mapContainer.style.display = 'flex';
      this.semanticView.renderMapView(blocks);
      if (this.wordCountEl) this.wordCountEl.parentElement!.style.display = 'none';
      this.gutter?.setVisible(false);
      this.rawGutter?.setVisible(false);
    }
  }

  /**
   * Salta al modo Prosa enfocado exactamente en el elemento DOM de ese bloque argumental.
   */
  private jumpToParagraph(pIndex: number, targetEl?: HTMLElement | null): void {
    // 1. Cambia el zoom de regreso al 100% (Prosa)
    if (this.zoomController) {
      this.zoomController.setLevel('prose');
    }

    // 2. Coloca el foco en el editor de texto y sitúa el cursor en el párrafo real
    setTimeout(() => {
      this.bodyElement.focus();
      let target: HTMLElement | null = targetEl || null;

      if (!target || !this.bodyElement.contains(target)) {
        const blocks = this.getStructuredBlocks();
        target = blocks[pIndex]?.targetElement || (this.bodyElement.firstElementChild as HTMLElement);
      }

      if (target) {
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);

        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      this.focusManager?.onEnterProseView();
    }, 60);
  }

  /**
   * Conecta el botón para colapsar o expandir el estante flotante de Materia Prima.
   */
  private initRawShelfToggle(): void {
    if (this.rawToggleBtn && this.rawShelf) {
      this.rawToggleBtn.addEventListener('click', () => {
        const isExpanded = this.rawShelf?.classList.toggle('expanded');
        this.audio.play(isExpanded ? 440 : 360, 'sine', 0.25, 0.08);
      });
    }
  }

  /**
   * Conecta el canalón del margen de descartes con el editor.
   */
  public setDiscardGutter(gutter: DiscardGutter): void {
    this.gutter = gutter;
    this.gutter.onRestore((text) => this.insertRestoredText(text));
  }

  /**
   * Conecta el canalón simétrico derecho de Materia Prima (Vía A).
   */
  public setRawGutter(gutter: RawGutter): void {
    this.rawGutter = gutter;
    this.rawGutter.onFuse((text) => this.insertFusedThought(text));
  }

  /**
   * Obtiene la referencia al elemento editable del cuerpo de texto.
   */
  public getBodyElement(): HTMLDivElement {
    return this.bodyElement;
  }

  /**
   * Hidrata el título y cuerpo de Cristal con los datos persistidos o importados.
   */
  public hydrateDocument(title: string, bodyHtml: string): void {
    const titleEl = this.getTitleElement();
    if (titleEl) {
      titleEl.innerText = (!title || title === 'Sin título') ? '' : title;
    }
    if (this.bodyElement) {
      this.bodyElement.innerHTML = bodyHtml || '';
      this.cachedRawText = this.bodyElement.innerText;
      this.updateMetrics();
      this.updateChips();
    }
  }

  /**
   * Obtiene la referencia al elemento del título noble.
   */
  public getTitleElement(): HTMLElement | null {
    return document.getElementById('crystal-title');
  }

  /**
   * Guarda la posición exacta del cursor en el editor antes de cambiar de fase.
   */
  public saveCaretPosition(): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const titleEl = this.getTitleElement();
    const anchor = sel.anchorNode;
    if (!anchor) return;

    if (titleEl && (titleEl === anchor || titleEl.contains(anchor))) {
      this.savedCaret = {
        isTitle: true,
        paragraphIndex: -1,
        charOffset: sel.anchorOffset
      };
      return;
    }

    if (this.bodyElement && this.bodyElement.contains(anchor)) {
      const children = Array.from(this.bodyElement.children) as HTMLElement[];
      let targetChild: HTMLElement | null = null;
      let node: Node | null = anchor;

      while (node && node !== this.bodyElement) {
        if (node.parentElement === this.bodyElement) {
          if (node instanceof HTMLElement) {
            targetChild = node;
          }
          break;
        }
        node = node.parentElement;
      }

      if (targetChild) {
        const pIndex = children.indexOf(targetChild);
        const nodeId = targetChild.dataset?.nodeId;
        let charOffset = 0;
        try {
          const range = sel.getRangeAt(0);
          const preRange = range.cloneRange();
          preRange.selectNodeContents(targetChild);
          preRange.setEnd(range.startContainer, range.startOffset);
          charOffset = preRange.toString().length;
        } catch {
          charOffset = sel.anchorOffset;
        }

        this.savedCaret = {
          isTitle: false,
          paragraphIndex: pIndex !== -1 ? pIndex : 0,
          nodeId,
          charOffset
        };
      }
    }
  }

  /**
   * Restaura con fidelidad milimétrica el cursor exactamente donde el autor lo dejó.
   */
  public restoreCaretPosition(): void {
    if (!this.savedCaret) {
      // Si no había cursor previo, colocar al final del primer párrafo
      const firstChild = this.bodyElement?.firstElementChild as HTMLElement | null;
      if (firstChild) {
        this.setCaretInNode(firstChild, firstChild.innerText.length);
      }
      return;
    }

    if (this.savedCaret.isTitle) {
      const titleEl = this.getTitleElement();
      if (titleEl) {
        titleEl.focus();
        this.setCaretInNode(titleEl, this.savedCaret.charOffset);
      }
      return;
    }

    if (!this.bodyElement) return;

    const children = Array.from(this.bodyElement.children) as HTMLElement[];
    if (children.length === 0) {
      this.bodyElement.focus();
      return;
    }

    let targetEl: HTMLElement | null = null;

    // 1. Intentar encontrar por nodeId si existía
    if (this.savedCaret.nodeId) {
      targetEl = children.find((c) => c?.dataset?.nodeId === this.savedCaret?.nodeId) || null;
    }

    // 2. Si no, por índice del párrafo
    if (!targetEl) {
      const idx = Math.min(Math.max(0, this.savedCaret.paragraphIndex), children.length - 1);
      targetEl = children[idx] || null;
    }

    if (targetEl) {
      this.bodyElement.focus();
      this.setCaretInNode(targetEl, this.savedCaret.charOffset);
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      this.focusManager?.updateActiveParagraph();
      this.focusManager?.updatePresencePosition();
    }
  }

  /**
   * Sitúa el caret en el nodo de texto adecuado según el offset de caracteres.
   */
  private setCaretInNode(element: HTMLElement, targetOffset: number): void {
    const sel = window.getSelection();
    if (!sel) return;

    const range = document.createRange();

    // Si el elemento está vacío (ej. nueva línea <p><br></p>)
    if (!element.textContent || element.textContent.trim().length === 0) {
      range.selectNodeContents(element);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }

    let currentOffset = 0;
    let found = false;

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    let textNode: Text | null = walker.nextNode() as Text | null;

    while (textNode) {
      const len = textNode.nodeValue ? textNode.nodeValue.length : 0;
      if (currentOffset + len >= targetOffset) {
        const offsetInNode = Math.min(Math.max(0, targetOffset - currentOffset), len);
        range.setStart(textNode, offsetInNode);
        range.collapse(true);
        found = true;
        break;
      }
      currentOffset += len;
      textNode = walker.nextNode() as Text | null;
    }

    if (!found) {
      range.selectNodeContents(element);
      range.collapse(false);
    }

    sel.removeAllRanges();
    sel.addRange(range);
  }

  /**
   * Obtiene la referencia al contenedor con scroll del santuario.
   */
  public getScrollContainer(): HTMLDivElement {
    return this.container;
  }

  /**
   * Muestra u oculta el santuario editorial y los márgenes según la fase activa.
   */
  public setVisible(visible: boolean): void {
    const pressTrigger = document.getElementById('btn-press-open');
    if (pressTrigger) {
      pressTrigger.style.display = visible ? 'inline-flex' : 'none';
    }

    this.container.style.display = visible ? 'flex' : 'none';
    this.container.style.pointerEvents = visible ? 'auto' : 'none';

    if (visible) {
      this.container.classList.add('active');
      if (this.rawShelf) this.rawShelf.classList.add('active');
      this.updateChips();
      if (this.gutter) this.gutter.setVisible(true);
      if (this.rawGutter) this.rawGutter.setVisible(true);
      // Al entrar a Cristal, asegura que arrancamos en modo Prosa
      this.applySemanticZoom(this.zoomController?.getLevel() || 'prose');

      // Restaurar el cursor exactamente donde el autor lo dejó
      setTimeout(() => {
        this.restoreCaretPosition();
      }, 50);
    } else {
      this.saveCaretPosition();
      this.container.classList.remove('active');
      if (this.rawShelf) {
        this.rawShelf.classList.remove('active');
        this.rawShelf.classList.remove('expanded');
      }
      if (this.gutter) this.gutter.setVisible(false);
      if (this.rawGutter) this.rawGutter.setVisible(false);
      this.textHud?.hideImmediately();
    }
  }

  /**
   * Funde una chispa de Materia Prima en el cursor de la prosa y despierta un pulso
   * de luz cálida mineral en el párrafo receptor que se asienta suavemente.
   */
  public insertFusedThought(text: string): void {
    if (!this.bodyElement) return;
    this.bodyElement.focus();

    let targetP: HTMLElement | null = null;
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0 && this.bodyElement.contains(selection.anchorNode)) {
      // Localiza el bloque <p> o <div> directo hijo que contiene el cursor
      let node: Node | null = selection.anchorNode;
      while (node && node !== this.bodyElement) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).parentElement === this.bodyElement) {
          targetP = node as HTMLElement;
          break;
        }
        node = node.parentNode;
      }

      // Si hay texto antes del cursor y no termina en espacio, añadimos espacio de cortesía
      const needsLeadingSpace =
        selection.anchorOffset > 0 &&
        selection.anchorNode?.textContent?.charAt(selection.anchorOffset - 1) !== ' ';
      const formatted = (needsLeadingSpace ? ' ' : '') + text;

      const success = document.execCommand('insertText', false, formatted);
      if (!success) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(formatted);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      // Si el cursor no estaba en el texto, añade un nuevo párrafo limpio al final
      const newP = document.createElement('p');
      newP.innerText = text;
      this.bodyElement.appendChild(newP);
      targetP = newP;

      const range = document.createRange();
      range.selectNodeContents(newP);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    if (!targetP) {
      targetP =
        (this.bodyElement.querySelector('.is-active-focus') as HTMLElement) ||
        (this.bodyElement.lastElementChild as HTMLElement);
    }

    // Disparo del pulso de luz cálida mineral que se asienta suavemente
    if (targetP) {
      targetP.classList.remove('fusing-pulse');
      void targetP.offsetWidth; // Reflow para reiniciar la animación
      targetP.classList.add('fusing-pulse');

      setTimeout(() => {
        targetP?.classList.remove('fusing-pulse');
      }, 1900);

      targetP.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    this.focusManager?.updateActiveParagraph();
    this.focusManager?.triggerTypewriterScroll();
    this.bodyElement.dispatchEvent(new Event('input'));
  }

  /**
   * ==========================================================================
   * DERRETIR EL CRISTAL (Cristal -> Fluido / Niebla)
   * ==========================================================================
   * Desacopla la prosa de Cristal en barcas/tarjetas navegables en el lienzo 2D.
   * Si el usuario redactó nuevos párrafos en Cristal, se sincronizan limpiamente al grafo.
   */
  public syncBlocksWithGraph(): void {
    if (!this.bodyElement) return;

    const blocks = this.getStructuredBlocks();
    if (blocks.length === 0) return;

    const linkedNodeIds: string[] = [];
    const usedNodeIds = new Set<string>();

    blocks.forEach((block, index) => {
      const cleanText = block.text.trim();
      if (!cleanText) return;

      let nodeId = block.targetElement.dataset.nodeId;
      let existingNode = nodeId ? this.graph.getNode(nodeId) : null;

      // Si no tiene ID o no existe en el grafo, intentamos encontrarlo por coincidencia de texto (solo si no fue asignado a otro bloque)
      if (!existingNode) {
        const allNodes = this.graph.getAllNodes();
        const found = allNodes.find((n) => !usedNodeIds.has(n.id) && n.inDocument && n.text.trim() === cleanText);
        if (found) {
          existingNode = found;
          nodeId = found.id;
          block.targetElement.dataset.nodeId = nodeId;
        }
      }

      if (existingNode && !usedNodeIds.has(existingNode.id)) {
        usedNodeIds.add(existingNode.id);
        existingNode.inDocument = true;
        block.elements.forEach((el) => {
          el.dataset.nodeId = existingNode!.id;
        });
        // Actualiza el texto si el autor lo editó en la prosa
        if (existingNode.text.trim() !== cleanText) {
          this.graph.updateNodeText(existingNode.id, cleanText);
        }
        linkedNodeIds.push(existingNode.id);
      } else {
        // Crea una nueva barca/tarjeta en el río de ideas
        const tag =
          index === 0
            ? 'Premisa'
            : index === blocks.length - 1
            ? 'Síntesis'
            : `Afluente ${index + 1}`;

        // Posición armónica en cascada en el lienzo 2D en espacios despejados
        const basePos = {
          x: -320 + index * 440,
          y: -60 + (index % 2 === 0 ? -40 : 60)
        };
        const clearPos = this.graph.findClearPosition(basePos);

        const newNode = this.graph.addNode(cleanText, clearPos, tag, true);
        block.elements.forEach((el) => {
          el.dataset.nodeId = newNode.id;
        });
        usedNodeIds.add(newNode.id);
        linkedNodeIds.push(newNode.id);
      }
    });

    // Enlaza la corriente lineal A -> B -> C SOLO si el grafo aún no tenía ningún puente configurado
    if (this.graph.getBridges().length === 0 && linkedNodeIds.length > 1) {
      for (let i = 0; i < linkedNodeIds.length - 1; i++) {
        this.graph.addBridge(linkedNodeIds[i], linkedNodeIds[i + 1]);
      }
    }
  }

  /**
   * Helper que formatea el texto de un nodo a contenido HTML de párrafo preservando saltos de línea internos (<br>).
   */
  private formatNodeTextToHtml(text: string): string {
    return text
      .split('\n')
      .map((line) => line.trim())
      .join('<br>');
  }

  /**
   * ==========================================================================
   * SOLIDIFICAR LA CORRIENTE (Fluido / Niebla -> Cristal)
   * ==========================================================================
   * Toma el orden del río trazado en Fluido y reordena los párrafos en Cristal.
   * Si una tarjeta cambió de orden o es nueva, emite el pulso mineral cálido.
   * Garantiza CERO DUPLICADOS y preservación total de la prosa.
   */
  public applyFlowOrder(orderedNodes: ThoughtNode[]): void {
    if (!this.bodyElement || orderedNodes.length === 0) return;

    // Obtener los elementos hijos directos
    const currentElements = Array.from(this.bodyElement.children) as HTMLElement[];
    const elementMapByNodeId = new Map<string, HTMLElement>();
    const elementMapByText = new Map<string, HTMLElement>();

    currentElements.forEach((el) => {
      const id = el.dataset.nodeId;
      if (id) elementMapByNodeId.set(id, el);
      const txt = (el.innerText || el.textContent || '').trim();
      if (txt) elementMapByText.set(txt, el);
    });

    const usedElements = new Set<HTMLElement>();
    const reorderedElements: HTMLElement[] = [];
    let orderChanged = false;

    orderedNodes.forEach((node) => {
      const nodeText = node.text.trim();
      if (!nodeText) return;

      let targetEl = elementMapByNodeId.get(node.id);
      if (!targetEl) {
        targetEl = elementMapByText.get(nodeText);
      }
      if (targetEl && usedElements.has(targetEl)) {
        targetEl = undefined;
      }

      if (targetEl) {
        usedElements.add(targetEl);
        if (targetEl.innerText.trim() !== nodeText) {
          targetEl.innerHTML = this.formatNodeTextToHtml(nodeText);
          orderChanged = true;
        }
        targetEl.dataset.nodeId = node.id;
        reorderedElements.push(targetEl);
      } else {
        // Verificar que no tengamos ya este nodo o exactamente este texto en los elementos ordenados
        const alreadyIncluded = reorderedElements.some(
          (el) => el.dataset.nodeId === node.id || el.innerText.trim() === nodeText
        );
        if (!alreadyIncluded) {
          const newP = document.createElement('p');
          newP.dataset.nodeId = node.id;
          newP.innerHTML = this.formatNodeTextToHtml(nodeText);
          reorderedElements.push(newP);
          orderChanged = true;
        }
      }
    });

    // Preservar cualquier párrafo existente de Cristal que no esté conectado al río (cero duplicados ni pérdidas)
    const orderedNodeIds = new Set<string>(orderedNodes.map((n) => n.id));

    currentElements.forEach((el) => {
      if (usedElements.has(el)) return;
      // Si el elemento ya forma parte de un nodo ordenado, NO duplicarlo
      if (el?.dataset?.nodeId && orderedNodeIds.has(el.dataset.nodeId)) return;

      const clean = this.extractElementText(el);
      if (!clean) return;

      const isSubsumed = reorderedElements.some(
        (r) =>
          (r?.dataset?.nodeId && el?.dataset?.nodeId && r.dataset.nodeId === el.dataset.nodeId) ||
          r.innerText.trim() === clean ||
          r.innerText.includes(clean)
      );

      if (!isSubsumed) {
        reorderedElements.push(el);
        usedElements.add(el);
      }
    });

    // Comprobar si las posiciones o cantidad cambiaron
    if (reorderedElements.length !== currentElements.length) {
      orderChanged = true;
    } else {
      for (let i = 0; i < reorderedElements.length; i++) {
        if (currentElements[i] !== reorderedElements[i]) {
          orderChanged = true;
          break;
        }
      }
    }

    if (!orderChanged) return;

    // Reensambla el documento según la nueva corriente del río
    const fragment = document.createDocumentFragment();
    reorderedElements.forEach((el, newIdx) => {
      const oldIdx = currentElements.indexOf(el);
      fragment.appendChild(el);

      // Si cambió de lugar por el río en Fluido, iluminar con pulso mineral
      if (oldIdx !== -1 && oldIdx !== newIdx) {
        el.classList.remove('fusing-pulse');
        void el.offsetWidth;
        el.classList.add('fusing-pulse');
        setTimeout(() => el.classList.remove('fusing-pulse'), 1900);
      }
    });

    this.bodyElement.innerHTML = '';
    this.bodyElement.appendChild(fragment);

    // Actualiza métricas y foco
    this.bodyElement.dispatchEvent(new Event('input'));
    this.focusManager?.updateActiveParagraph();
    this.focusManager?.triggerTypewriterScroll();
  }

  /**
   * Conecta los escuchadores para el recuento rítmico en tiempo real.
   */
  private initMetrics(): void {
    if (!this.bodyElement) return;

    this.bodyElement.addEventListener('input', () => {
      this.updateMetrics();
    });
  }

  /**
   * Recalcula las métricas de palabras y tiempo de lectura.
   */
  public updateMetrics(): void {
    if (!this.bodyElement) return;

    const blocks = this.getStructuredBlocks();
    if (blocks.length > 0) {
      this.cachedRawText = blocks.map((b) => b.text).join('\n\n');
    } else {
      this.cachedRawText = this.bodyElement.innerText;
    }
    const text = this.cachedRawText.trim();
    const words = text ? text.split(/\s+/).length : 0;
    if (this.wordCountEl) this.wordCountEl.innerText = `${words} palabras`;

    const seconds = Math.ceil((words / 200) * 60);
    if (this.readTimeEl) this.readTimeEl.innerText = `Lectura: ${seconds} seg`;

    // Estándar editorial internacional de cuartilla (1 página = 250 palabras)
    const pages = Math.max(1, Math.ceil(words / 250));
    if (this.pageCountEl) {
      this.pageCountEl.innerText = pages === 1 ? '1 página' : `${pages} páginas`;
    }
  }

  /**
   * Intercepta el borrado o corte intencional de texto para preservarlo en el Margen de Descartes.
   */
  private initDeletionInterceptor(): void {
    if (!this.bodyElement) return;

    // 1. Borrado con teclado de texto seleccionado (Backspace o Supr) y captura de Shift+Enter
    this.bodyElement.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        this.captureSelectionToGutter();
        return;
      }

      // Salto de línea suave (Shift + Enter): Inserta un salto de línea dentro del mismo párrafo
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const br = document.createElement('br');
          range.insertNode(br);
          range.setStartAfter(br);
          range.setEndAfter(br);
          sel.removeAllRanges();
          sel.addRange(range);
          this.bodyElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    });

    // 2. Intercepta borrado o corte por evento de entrada nativo (Ctrl+X o corte con ratón)
    this.bodyElement.addEventListener('beforeinput', (e: InputEvent) => {
      if (e.inputType === 'deleteByCut' || e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') {
        this.captureSelectionToGutter();
      }
    });

    // 3. Captura explícita de atajo Ctrl+X / Cmd+X
    this.bodyElement.addEventListener('copy', () => {});
    this.bodyElement.addEventListener('cut', () => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        const text = selection.toString().trim();
        if (text.length >= 6 && this.gutter) {
          try {
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            this.gutter.addDiscard(text, rect.top);
          } catch {
            // Fallback silencioso
          }
        }
      }
    });
  }

  /**
   * Captura la selección activa antes de que el navegador la destruya.
   */
  private captureSelectionToGutter(): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    // Umbral de 6+ caracteres: filtra artículos o erratas menores y preserva ideas reales
    if (text.length >= 6 && this.gutter) {
      let clientY: number | undefined;
      try {
        if (selection.rangeCount > 0) {
          clientY = selection.getRangeAt(0).getBoundingClientRect().top;
        }
      } catch {
        // Fallback silencioso
      }

      this.gutter.addDiscard(text, clientY);
    }
  }

  /**
   * Reinserta una viruta descartada en la posición del cursor de texto.
   */
  public insertRestoredText(text: string): void {
    if (!this.bodyElement) return;
    this.bodyElement.focus();

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && this.bodyElement.contains(selection.anchorNode)) {
      // Inserción nativa con preservación de historial deshacer/rehacer
      const success = document.execCommand('insertText', false, text);
      if (!success) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      this.bodyElement.innerText += '\n\n' + text;
    }

    this.bodyElement.dispatchEvent(new Event('input'));
  }

  /**
   * Refresca las gemas de ideas previas en la bandeja de materia prima.
   * Únicamente muestra ideas vírgenes (no consumidas).
   */
  public updateChips(): void {
    if (!this.chipsContainer) return;
    this.chipsContainer.innerHTML = '';

    // Si el texto del editor ya contiene alguna de las frases iniciales, marcarla como consumida
    if (this.bodyElement) {
      const editorText = this.getRawText();
      this.graph.getAllNodes().forEach(node => {
        if (!node.consumed && node.text.trim().length > 15 && editorText.includes(node.text.trim())) {
          node.consumed = true;
        }
      });
    }

    const availableNodes = this.graph.getAvailableRawNodes();

    // Actualiza la etiqueta del botón con el contador de ideas disponibles
    if (this.rawLabel) {
      this.rawLabel.innerText = availableNodes.length > 0 
        ? `Materia Prima (${availableNodes.length})` 
        : 'Materia Prima (0)';
    }

    // Si todas las ideas han sido consumidas, muestra un aviso sereno
    if (availableNodes.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'crystal-empty-raw';
      emptyMsg.innerText = 'Toda la materia prima ha sido cristalizada · Ve a Niebla para concebir nuevas chispas';
      this.chipsContainer.appendChild(emptyMsg);
      return;
    }

    availableNodes.forEach(node => {
      const chip = document.createElement('div');
      chip.className = 'crystal-chip';
      chip.innerText = node.text.length > 50 ? node.text.substring(0, 48) + '...' : node.text;
      chip.title = 'Haz clic para insertar en el cursor y consumir esta materia prima';

      chip.onclick = () => {
        // 1. Inserta en la posición del cursor de la prosa
        this.insertRestoredText(node.text);
        // 2. Marca la materia prima como consumida para que desaparezca definitivamente de la bandeja
        this.graph.markAsConsumed(node.id);
        // 3. Sonido armónico de cristalización
        this.audio.play(540, 'sine', 0.4, 0.14);
      };

      this.chipsContainer.appendChild(chip);
    });
  }
}
