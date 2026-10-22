/**
 * ============================================================================
 * CAPA 3: SANTUARIO EDITORIAL MONÁSTICO (EDITORIAL EDITOR)
 * ============================================================================
 * Gestiona el entorno de escritura pura en estado Cristal:
 * - Título y cuerpo de prosa con tipografía calibrada.
 * - Métricas de ritmo en tiempo real (palabras y tiempo de lectura).
 * - Bandeja de "Materia Prima" con las ideas destiladas en fases previas.
 * - Ciclo de consumo: al usar una idea, se integra en la prosa y desaparece de la bandeja.
 * - Intercepta el borrado intencional de frases hacia el Margen de Descartes.
 */

import { DocumentGraph } from '../../core/DocumentGraph';
import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';
import { DiscardGutter } from '../margin/DiscardGutter';

export class EditorialEditor {
  private container: HTMLDivElement;
  private bodyElement: HTMLDivElement;
  private wordCountEl: HTMLSpanElement;
  private readTimeEl: HTMLSpanElement;
  private chipsContainer: HTMLDivElement;
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

    this.initMetrics();
    this.initDeletionInterceptor();
    this.updateChips();

    // Actualiza los chips cuando el grafo de ideas cambie
    this.graph.subscribe(() => this.updateChips());
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
   * Muestra u oculta el santuario editorial según la fase activa.
   */
  public setVisible(visible: boolean): void {
    if (visible) {
      this.container.classList.add('active');
      this.updateChips();
      if (this.gutter) this.gutter.setVisible(true);
    } else {
      this.container.classList.remove('active');
      if (this.gutter) this.gutter.setVisible(false);
    }
  }

  /**
   * Conecta los escuchadores para el recuento rítmico en tiempo real.
   */
  private initMetrics(): void {
    if (!this.bodyElement) return;

    this.bodyElement.addEventListener('input', () => {
      const text = this.bodyElement.innerText.trim();
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

    // 2. Corte de texto seleccionado (Ctrl+X / Cmd+X)
    this.bodyElement.addEventListener('cut', () => {
      this.captureSelectionToGutter();
    });

    // 3. Borrado contextual sin selección previa (ej: Ctrl+Backspace para borrar palabras enteras)
    this.bodyElement.addEventListener('beforeinput', (e: Event) => {
      const inputEv = e as InputEvent;
      if (inputEv.inputType && inputEv.inputType.startsWith('delete')) {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
          this.captureSelectionToGutter();
          return;
        }

        // Si la selección estaba colapsada pero se borra una palabra o línea entera
        if (inputEv.inputType === 'deleteWordBackward' || inputEv.inputType === 'deleteWordForward' || inputEv.inputType === 'deleteHardLineBackward') {
          try {
            const targetRanges = (inputEv as unknown as { getTargetRanges?: () => Range[] }).getTargetRanges?.();
            if (targetRanges && targetRanges.length > 0) {
              const range = targetRanges[0];
              const text = range.toString().trim();
              if (text.length >= 3 && this.gutter) {
                const rect = range.getBoundingClientRect();
                this.gutter.addDiscard(text, rect.top);
              }
            }
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
    // Captura cualquier selección intencional de al menos 3 caracteres
    if (text.length >= 3 && this.gutter) {
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
      const editorText = this.bodyElement.innerText;
      this.graph.getAllNodes().forEach(node => {
        if (!node.consumed && node.text.trim().length > 15 && editorText.includes(node.text.trim())) {
          node.consumed = true;
        }
      });
    }

    const availableNodes = this.graph.getAvailableRawNodes();

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
