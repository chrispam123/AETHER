/**
 * ============================================================================
 * CAPA 3: LA PRENSA EDITORIAL DE AETHER (PRESS MODAL)
 * ============================================================================
 * Salón de Maquetación, Tipografía y Salida Física (Impresión / PDF).
 * Desacoplado 100% del Santuario de Cristal:
 * - Lee la prosa viva de Cristal unidireccionalmente.
 * - Los ajustes corporativos (12px, justificado, márgenes A4) SOLO afectan al pliego.
 * - El Santuario permanece monástico, puro e intocado.
 */

import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';

export interface PressDocumentData {
  title: string;
  paragraphs: string[];
}

export interface PressExportHandlers {
  onExportMarkdown?: () => void;
  onExportAether?: () => void;
}

export type FontFamilyChoice = 'serif' | 'sans' | 'mono';
export type MarginChoice = 'monastic' | 'academic' | 'compact';
export type TextAlignChoice = 'justify' | 'left';

export class PressModal {
  private backdropEl: HTMLDivElement;
  private audio: HarmonicSynthesizer;
  private isOpen: boolean = false;

  // Estado cosmético de maquetación (solo vive en La Prensa)
  private fontSize: string = '12pt';
  private lineHeight: string = '1.5';
  private fontFamily: FontFamilyChoice = 'serif';
  private textAlign: TextAlignChoice = 'justify';
  private marginPreset: MarginChoice = 'academic';
  private hasIndent: boolean = false;
  private showCoverHeader: boolean = true;
  private showPageNumber: boolean = true;
  private showDate: boolean = true;

  // Elementos del DOM del visor y estado del documento
  private stageEl!: HTMLElement;
  private printHintEl!: HTMLElement;
  private currentData: PressDocumentData = { title: '', paragraphs: [] };
  private exportHandlers: PressExportHandlers | null = null;

  constructor(audio: HarmonicSynthesizer) {
    this.audio = audio;
    this.backdropEl = document.createElement('div');
    this.backdropEl.className = 'press-backdrop';
    this.render();
    document.body.appendChild(this.backdropEl);
    this.bindEvents();
  }

  /**
   * Renderiza la estructura estricta del salón de maquetación.
   */
  private render(): void {
    this.backdropEl.innerHTML = `
      <div class="press-modal-container">
        <!-- 1. Cabecera Noble -->
        <header class="press-header">
          <div class="press-header-title">
            <span class="press-icon-lead">⎙</span>
            <span>La Prensa Editorial</span>
            <span class="press-header-tagline">Composición Tipográfica para Sociedad & Empresa</span>
          </div>
          <button class="press-close-btn" id="press-btn-close" title="Cerrar Prensa (Esc)">
            <span>Volver al Santuario</span>
            <kbd style="font-size: 8px; opacity: 0.7; padding: 1px 3px; border: 1px solid currentColor; border-radius: 2px;">ESC</kbd>
          </button>
        </header>

        <!-- 2. Cuerpo: Controles a la Izquierda, Pliego a la Derecha -->
        <div class="press-body">
          <aside class="press-sidebar">
            <!-- Sección: Tipografía y Escala -->
            <div class="press-control-group">
              <div class="press-section-label">Tipografía & Escala</div>
              <div class="press-pills-row" id="pills-font-size">
                <button class="press-pill-btn" data-val="11pt">11pt</button>
                <button class="press-pill-btn is-active" data-val="12pt">12pt</button>
                <button class="press-pill-btn" data-val="13pt">13pt</button>
                <button class="press-pill-btn" data-val="14pt">14pt</button>
              </div>

              <div class="press-pills-row" id="pills-font-family" style="margin-top: 6px;">
                <button class="press-pill-btn is-active" data-val="serif">Serif</button>
                <button class="press-pill-btn" data-val="sans">Sans</button>
                <button class="press-pill-btn" data-val="mono">Mono</button>
              </div>
            </div>

            <!-- Sección: Interlineado y Alineación -->
            <div class="press-control-group">
              <div class="press-section-label">Alineación y Caja</div>
              <div class="press-pills-row" id="pills-text-align">
                <button class="press-pill-btn is-active" data-val="justify">Justificado</button>
                <button class="press-pill-btn" data-val="left">Izquierda</button>
              </div>

              <div class="press-pills-row" id="pills-line-height" style="margin-top: 6px;">
                <button class="press-pill-btn" data-val="1.3">1.3 Denso</button>
                <button class="press-pill-btn is-active" data-val="1.5">1.5 Editorial</button>
                <button class="press-pill-btn" data-val="1.8">1.8 Aire</button>
              </div>
            </div>

            <!-- Sección: Márgenes de Pliego (A4) -->
            <div class="press-control-group">
              <div class="press-section-label">Márgenes de Hoja</div>
              <div class="press-pills-row" id="pills-margins">
                <button class="press-pill-btn" data-val="compact">Económico</button>
                <button class="press-pill-btn is-active" data-val="academic">Académico</button>
                <button class="press-pill-btn" data-val="monastic">Monástico</button>
              </div>
            </div>

            <!-- Sección: Estructura Editorial -->
            <div class="press-control-group">
              <div class="press-section-label">Elementos de Salida</div>
              <label class="press-toggle-row">
                <span>Cornisa con título superior</span>
                <input type="checkbox" class="press-checkbox" id="chk-header" checked>
              </label>
              <label class="press-toggle-row">
                <span>Fecha de emisión</span>
                <input type="checkbox" class="press-checkbox" id="chk-date" checked>
              </label>
              <label class="press-toggle-row">
                <span>Numeración de página</span>
                <input type="checkbox" class="press-checkbox" id="chk-footer" checked>
              </label>
              <label class="press-toggle-row">
                <span>Sangría en párrafos</span>
                <input type="checkbox" class="press-checkbox" id="chk-indent">
              </label>
            </div>

            <!-- Footer: Botón Maestro de Impresión y Exportación -->
            <div class="press-sidebar-footer">
              <button class="press-action-print" id="press-btn-print">
                <span>⎙ Imprimir / Guardar PDF</span>
              </button>
              <div class="press-exports-row">
                <button class="press-action-secondary" id="press-btn-export-md" type="button">
                  <span>↓ Markdown (.md)</span>
                </button>
                <button class="press-action-secondary" id="press-btn-export-aether" type="button">
                  <span>✦ Respaldo (.aether)</span>
                </button>
              </div>
              <div class="press-print-hint" id="press-print-hint">Listo para papel A4 y PDF a 300 DPI</div>
            </div>
          </aside>

          <!-- Escenario del Pliego Físico Real en Cascada -->
          <main class="press-stage" id="press-stage">
            <!-- Las hojas físicas A4 se inyectan dinámicamente -->
          </main>
        </div>
      </div>
    `;

    // Cachear referencias DOM del escenario
    this.stageEl = this.backdropEl.querySelector('#press-stage') as HTMLElement;
    this.printHintEl = this.backdropEl.querySelector('#press-print-hint') as HTMLElement;
  }

  /**
   * Conecta los eventos de control reactivos a 120 FPS.
   */
  private bindEvents(): void {
    // 1. Cerrar Prensa
    const closeBtn = this.backdropEl.querySelector('#press-btn-close');
    closeBtn?.addEventListener('click', () => this.close());

    // Clic en el backdrop exterior cierra
    this.backdropEl.addEventListener('click', (e) => {
      if (e.target === this.backdropEl) this.close();
    });

    // Tecla Escape cierra
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // 2. Control de Tamaño de Fuente
    this.bindPills('pills-font-size', (val) => {
      this.fontSize = val;
      this.updateSheetStyles();
      this.audio.play(440, 'triangle', 0.2, 0.04);
    });

    // 3. Control de Tipografía (Serif, Sans, Mono)
    this.bindPills('pills-font-family', (val) => {
      this.fontFamily = val as FontFamilyChoice;
      this.updateSheetStyles();
      this.audio.play(480, 'triangle', 0.2, 0.04);
    });

    // 4. Control de Alineación
    this.bindPills('pills-text-align', (val) => {
      this.textAlign = val as TextAlignChoice;
      this.updateSheetStyles();
      this.audio.play(380, 'sine', 0.2, 0.04);
    });

    // 5. Control de Interlineado
    this.bindPills('pills-line-height', (val) => {
      this.lineHeight = val;
      this.updateSheetStyles();
      this.audio.play(400, 'sine', 0.2, 0.04);
    });

    // 6. Control de Márgenes
    this.bindPills('pills-margins', (val) => {
      this.marginPreset = val as MarginChoice;
      this.updateSheetStyles();
      this.audio.play(340, 'sine', 0.25, 0.05);
    });

    // 7. Toggles de checkboxes
    const chkHeader = this.backdropEl.querySelector('#chk-header') as HTMLInputElement;
    chkHeader?.addEventListener('change', () => {
      this.showCoverHeader = chkHeader.checked;
      this.updateSheetStyles();
      this.audio.play(520, 'sine', 0.15, 0.03);
    });

    const chkDate = this.backdropEl.querySelector('#chk-date') as HTMLInputElement;
    chkDate?.addEventListener('change', () => {
      this.showDate = chkDate.checked;
      this.updateSheetStyles();
      this.audio.play(520, 'sine', 0.15, 0.03);
    });

    const chkFooter = this.backdropEl.querySelector('#chk-footer') as HTMLInputElement;
    chkFooter?.addEventListener('change', () => {
      this.showPageNumber = chkFooter.checked;
      this.updateSheetStyles();
      this.audio.play(520, 'sine', 0.15, 0.03);
    });

    const chkIndent = this.backdropEl.querySelector('#chk-indent') as HTMLInputElement;
    chkIndent?.addEventListener('change', () => {
      this.hasIndent = chkIndent.checked;
      this.updateSheetStyles();
      this.audio.play(520, 'sine', 0.15, 0.03);
    });

    // 8. Botón Maestro de Impresión y Exportación
    const printBtn = this.backdropEl.querySelector('#press-btn-print');
    printBtn?.addEventListener('click', () => {
      this.triggerPrint();
    });

    const exportMdBtn = this.backdropEl.querySelector('#press-btn-export-md');
    exportMdBtn?.addEventListener('click', () => {
      this.exportHandlers?.onExportMarkdown?.();
    });

    const exportAetherBtn = this.backdropEl.querySelector('#press-btn-export-aether');
    exportAetherBtn?.addEventListener('click', () => {
      this.exportHandlers?.onExportAether?.();
    });
  }

  public setExportHandlers(handlers: PressExportHandlers): void {
    this.exportHandlers = handlers;
  }

  /**
   * Helper para enlazar un grupo de pastillas excluyentes.
   */
  private bindPills(containerId: string, onSelect: (value: string) => void): void {
    const container = this.backdropEl.querySelector(`#${containerId}`);
    if (!container) return;

    container.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.press-pill-btn') as HTMLButtonElement | null;
      if (!btn) return;

      container.querySelectorAll('.press-pill-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      const val = btn.dataset.val || '';
      onSelect(val);
    });
  }

  /**
   * Actualiza los pliegos físicos reactivamente ante cualquier cambio de control.
   */
  private updateSheetStyles(): void {
    this.paginate();
  }

  /**
   * Abre La Prensa inyectando el contenido vivo desde Cristal.
   */
  public open(data: PressDocumentData): void {
    this.isOpen = true;
    this.currentData = data;
    this.backdropEl.classList.add('is-open');
    this.audio.play(432, 'triangle', 0.4, 0.12);

    // Medición exacta tras montaje visual en el DOM
    requestAnimationFrame(() => {
      this.paginate();
    });
  }

  /**
   * Fábrica de hojas físicas A4 individuales.
   */
  private createSheet(
    pageIndex: number,
    totalPages: number,
    title: string,
    formattedDate: string
  ): HTMLElement {
    const sheet = document.createElement('article');
    sheet.className = `press-sheet margin-${this.marginPreset} font-${this.fontFamily}`;
    if (this.hasIndent) {
      sheet.classList.add('has-indent');
    }
    sheet.dataset.page = String(pageIndex);

    const header = `
      <header class="press-sheet-header ${this.showCoverHeader ? '' : 'is-hidden'}">
        <span class="press-sheet-doc-title">${title}</span>
        <span class="press-sheet-date" style="${this.showDate ? '' : 'display: none;'}">${formattedDate}</span>
      </header>
    `;

    // El título de portada principal solo se imprime en la primera hoja física
    const titleH1 = pageIndex === 1
      ? `<h1 class="press-sheet-title">${title}</h1>`
      : '';

    const footer = `
      <footer class="press-sheet-footer ${this.showPageNumber ? '' : 'is-hidden'}">
        <span>Aether Editorial Engine</span>
        <span class="press-sheet-page-num">Página ${pageIndex} de ${totalPages}</span>
      </footer>
    `;

    sheet.innerHTML = `
      ${header}
      ${titleH1}
      <div class="press-sheet-content" style="font-size: ${this.fontSize}; line-height: ${this.lineHeight}; text-align: ${this.textAlign};"></div>
      ${footer}
    `;

    return sheet;
  }

  /**
   * Actualiza el indicador de páginas en el pie del panel de control.
   */
  private updateHint(totalPages: number): void {
    if (this.printHintEl) {
      this.printHintEl.textContent = `Listo para papel A4 (${totalPages} ${totalPages === 1 ? 'página' : 'páginas'}) y PDF a 300 DPI`;
    }
  }

  /**
   * Motor de Imposición Editorial en Cascada (WYSIWYG 100%).
   * Mide el desbordamiento real en el DOM a 120 FPS y genera pliegos A4 exactos.
   */
  private paginate(): void {
    if (!this.stageEl) return;
    this.stageEl.innerHTML = '';

    const title = this.currentData.title.trim() || 'Sin Título';
    const paragraphs = this.currentData.paragraphs;
    const formattedDate = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    if (!paragraphs || paragraphs.length === 0) {
      const sheet = this.createSheet(1, 1, title, formattedDate);
      const content = sheet.querySelector('.press-sheet-content') as HTMLElement;
      content.innerHTML = `<p style="font-style: italic; color: #888;">El santuario está en blanco. Escribe primero en Cristal para generar el pliego.</p>`;
      this.stageEl.appendChild(sheet);
      this.updateHint(1);
      return;
    }

    // Dividir cada párrafo en líneas no vacías respetando saltos de línea internos
    const blocks: string[][] = paragraphs
      .map((p) =>
        p
          .trim()
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
      )
      .filter((lines) => lines.length > 0);

    if (blocks.length === 0) {
      const sheet = this.createSheet(1, 1, title, formattedDate);
      this.stageEl.appendChild(sheet);
      this.updateHint(1);
      return;
    }

    const sheets: HTMLElement[] = [];

    const addNewSheet = (): { sheet: HTMLElement; contentEl: HTMLElement } => {
      const pageIndex = sheets.length + 1;
      const sheet = this.createSheet(pageIndex, 1, title, formattedDate);
      this.stageEl.appendChild(sheet);
      sheets.push(sheet);
      const contentEl = sheet.querySelector('.press-sheet-content') as HTMLElement;
      return { sheet, contentEl };
    };

    let current = addNewSheet();

    for (let b = 0; b < blocks.length; b++) {
      let lines = [...blocks[b]];

      while (lines.length > 0) {
        const pEl = document.createElement('p');
        pEl.innerHTML = lines.join('<br>');
        current.contentEl.appendChild(pEl);

        // Tolerancia de 1px para evitar desbordes falsos por redondeo de subpíxeles en pantallas HiDPI / Windows
        if (current.contentEl.scrollHeight <= current.contentEl.clientHeight + 1) {
          lines = [];
          break;
        }

        // Si no cupo completo, remover y buscar corte óptimo de líneas o palabras
        current.contentEl.removeChild(pEl);

        // 1. Si el párrafo tiene múltiples líneas explícitas (\n), intentar corte por líneas
        let fittedLineCount = 0;
        if (lines.length > 1) {
          for (let count = 1; count < lines.length; count++) {
            pEl.innerHTML = lines.slice(0, count).join('<br>');
            current.contentEl.appendChild(pEl);
            const fits = current.contentEl.scrollHeight <= current.contentEl.clientHeight + 1;
            current.contentEl.removeChild(pEl);

            if (fits) {
              fittedLineCount = count;
            } else {
              break;
            }
          }
        }

        if (fittedLineCount > 0) {
          pEl.innerHTML = lines.slice(0, fittedLineCount).join('<br>');
          current.contentEl.appendChild(pEl);
          lines = lines.slice(fittedLineCount);
          current = addNewSheet();
        } else {
          // 2. Si no hay múltiples renglones o ninguna línea entera cupo:
          // Ajuste de alta fidelidad por palabras (Búsqueda binaria a 120 FPS)
          const words = lines[0].split(/\s+/);
          let bestWordCount = 0;

          if (words.length > 3) {
            let low = 1;
            let high = words.length - 1;

            while (low <= high) {
              const mid = Math.floor((low + high) / 2);
              pEl.innerHTML = words.slice(0, mid).join(' ');
              current.contentEl.appendChild(pEl);
              const fits = current.contentEl.scrollHeight <= current.contentEl.clientHeight + 1;
              current.contentEl.removeChild(pEl);

              if (fits) {
                bestWordCount = mid;
                low = mid + 1;
              } else {
                high = mid - 1;
              }
            }
          }

          // Se exigen al menos 3 palabras para no dejar palabras huérfanas
          if (bestWordCount >= 3) {
            pEl.innerHTML = words.slice(0, bestWordCount).join(' ');
            current.contentEl.appendChild(pEl);
            lines[0] = words.slice(bestWordCount).join(' ');
            current = addNewSheet();
          } else {
            // El espacio restante en la hoja actual no permite ni una frase corta
            if (current.contentEl.children.length > 0) {
              current = addNewSheet();
            } else {
              // Hoja vacía y ni 3 palabras caben (ej. palabra colosal): forzarla
              pEl.innerHTML = lines.shift()!;
              current.contentEl.appendChild(pEl);
              if (lines.length > 0) {
                current = addNewSheet();
              }
            }
          }
        }
      }
    }

    // Actualizar números de página: "Página X de Y"
    const totalPages = sheets.length;
    sheets.forEach((sheet, idx) => {
      const pageIndex = idx + 1;
      const numSpan = sheet.querySelector('.press-sheet-page-num');
      if (numSpan) {
        numSpan.textContent = `Página ${pageIndex} de ${totalPages}`;
      }
    });

    this.updateHint(totalPages);
  }

  /**
   * Cierra La Prensa y regresa al Santuario de Cristal.
   */
  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.backdropEl.classList.remove('is-open');
    this.audio.play(260, 'sine', 0.25, 0.08);
  }

  /**
   * Lanza la impresión nativa de alta fidelidad.
   */
  public triggerPrint(): void {
    this.audio.play(528, 'sine', 0.5, 0.15);
    // Un retardo de 80ms permite que el sintetizador de audio suene antes del bloqueo modal de impresión
    setTimeout(() => {
      window.print();
    }, 80);
  }
}
