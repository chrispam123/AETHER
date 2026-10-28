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
import { SemanticZoomController } from '../../engine/SemanticZoomController';
import { SemanticLevel } from '../../core/types';
import { SemanticZoomView } from './SemanticZoomView';
import { TextHud } from './TextHud';

export class EditorialEditor {
  private container: HTMLDivElement;
  private bodyElement: HTMLDivElement;
  private wordCountEl: HTMLSpanElement;
  private readTimeEl: HTMLSpanElement;
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

  private graph: DocumentGraph;
  private audio: HarmonicSynthesizer;
  private gutter: DiscardGutter | null = null;

  constructor(graph: DocumentGraph, audio: HarmonicSynthesizer) {
    this.graph = graph;
    this.audio = audio;

    this.container = document.getElementById('crystal-sanctuary') as HTMLDivElement;
    this.bodyElement = document.querySelector('.crystal-body') as HTMLDivElement;
    this.wordCountEl = document.getElementById('word-count') as HTMLSpanElement;
    this.readTimeEl = document.getElementById('read-time') as HTMLSpanElement;
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
    this.semanticView.onJumpToParagraph((pIndex) => this.jumpToParagraph(pIndex));

    if (this.bodyElement) {
      this.cachedRawText = this.bodyElement.innerText;
      this.textHud = new TextHud(this.bodyElement, this.audio);
    }

    this.initMetrics();
    this.initDeletionInterceptor();
    this.initRawShelfToggle();
    this.initRightClickThesisSelection();
    this.updateChips();

    // Actualiza los chips cuando el grafo de ideas cambie
    this.graph.subscribe(() => this.updateChips());
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
   * Obtiene el texto en prosa del autor garantizando que nunca se degrade
   * al alternar entre vistas cuando el elemento DOM está temporalmente oculto (display: none).
   */
  public getRawText(): string {
    if (this.bodyElement && this.bodyElement.style.display !== 'none') {
      const current = this.bodyElement.innerText;
      if (current.trim().length > 0) {
        this.cachedRawText = current;
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
  private showToast(message: string): void {
    if (!this.thesisToast) return;

    this.thesisToast.innerText = message;
    this.thesisToast.classList.add('visible');

    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.thesisToast?.classList.remove('visible');
    }, 2200);
  }

  /**
   * Aplica la transformación de densidad conceptual según el nivel de zoom.
   */
  public applySemanticZoom(level: SemanticLevel): void {
    const rawText = this.getRawText();
    const blocks = this.semanticView.parseParagraphs(rawText, this.manualTheses);
    if (level !== 'prose') { this.textHud?.hideImmediately(); }

    if (level === 'prose') {
      // 100%: Prosa continua completa
      this.bodyElement.style.display = 'block';
      this.thesisContainer.style.display = 'none';
      this.mapContainer.style.display = 'none';
      if (this.wordCountEl) this.wordCountEl.parentElement!.style.display = 'flex';
    } else if (level === 'thesis') {
      // 50%: Frases tesis destacadas y relleno secundario plegado
      this.bodyElement.style.display = 'none';
      this.thesisContainer.style.display = 'flex';
      this.mapContainer.style.display = 'none';
      this.semanticView.renderThesisView(blocks);
      if (this.wordCountEl) this.wordCountEl.parentElement!.style.display = 'none';
    } else if (level === 'map') {
      // 20%: Cartografía modular de bloques argumentales
      this.bodyElement.style.display = 'none';
      this.thesisContainer.style.display = 'none';
      this.mapContainer.style.display = 'flex';
      this.semanticView.renderMapView(blocks);
      if (this.wordCountEl) this.wordCountEl.parentElement!.style.display = 'none';
    }
  }

  /**
   * Salta al modo Prosa enfocado en un párrafo específico.
   */
  private jumpToParagraph(pIndex: number): void {
    // 1. Cambia el zoom de regreso al 100% (Prosa)
    if (this.zoomController) {
      this.zoomController.setLevel('prose');
    }

    // 2. Coloca el foco en el editor de texto
    setTimeout(() => {
      this.bodyElement.focus();
      // Desplaza suavemente hacia el párrafo
      const scrollY = Math.max(0, pIndex * 180);
      this.container.scrollTo({ top: scrollY, behavior: 'smooth' });
    }, 50);
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
   * Obtiene la referencia al elemento editable del cuerpo de texto.
   */
  public getBodyElement(): HTMLDivElement {
    return this.bodyElement;
  }

  /**
   * Obtiene la referencia al contenedor con scroll del santuario.
   */
  public getScrollContainer(): HTMLDivElement {
    return this.container;
  }

  /**
   * Muestra u oculta el santuario editorial y el estante flotante según la fase activa.
   */
  public setVisible(visible: boolean): void {
    if (visible) {
      this.container.classList.add('active');
      if (this.rawShelf) this.rawShelf.classList.add('active');
      this.updateChips();
      if (this.gutter) this.gutter.setVisible(true);
      // Al entrar a Cristal, asegura que arrancamos en modo Prosa
      this.applySemanticZoom(this.zoomController?.getLevel() || 'prose');
    } else {
      this.container.classList.remove('active');
      if (this.rawShelf) {
        this.rawShelf.classList.remove('active');
        this.rawShelf.classList.remove('expanded');
      }
      if (this.gutter) this.gutter.setVisible(false);
      this.textHud?.hideImmediately();
    }
  }

  /**
   * Conecta los escuchadores para el recuento rítmico en tiempo real.
   */
  private initMetrics(): void {
    if (!this.bodyElement) return;

    this.bodyElement.addEventListener('input', () => {
      this.cachedRawText = this.bodyElement.innerText;
      const text = this.cachedRawText.trim();
      const words = text ? text.split(/\s+/).length : 0;
      if (this.wordCountEl) this.wordCountEl.innerText = `${words} palabras`;

      const seconds = Math.ceil((words / 200) * 60);
      if (this.readTimeEl) this.readTimeEl.innerText = `Lectura: ${seconds} seg`;
    });
  }

  /**
   * Intercepta el borrado o corte intencional de texto para preservarlo en el Margen de Descartes.
   */
  private initDeletionInterceptor(): void {
    if (!this.bodyElement) return;

    // 1. Borrado con teclado de texto seleccionado (Backspace o Supr)
    this.bodyElement.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        this.captureSelectionToGutter();
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
