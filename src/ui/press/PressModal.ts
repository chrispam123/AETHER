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

  // Elementos del DOM del pliego
  private sheetEl!: HTMLDivElement;
  private sheetHeaderEl!: HTMLDivElement;
  private sheetTitleEl!: HTMLDivElement;
  private sheetContentEl!: HTMLDivElement;
  private sheetFooterEl!: HTMLDivElement;
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
              <div class="press-print-hint">Listo para papel A4 y PDF a 300 DPI</div>
            </div>
          </aside>

          <!-- Escenario del Pliego Físico Real -->
          <main class="press-stage">
            <article class="press-sheet margin-academic font-serif" id="press-sheet">
              <header class="press-sheet-header" id="press-sheet-header">
                <span class="press-sheet-doc-title">Aether · Manuscrito</span>
                <span class="press-sheet-date">${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </header>

              <h1 class="press-sheet-title" id="press-sheet-title">Título del Manuscrito</h1>

              <div class="press-sheet-content" id="press-sheet-content">
                <p>Contenido del documento...</p>
              </div>

              <footer class="press-sheet-footer" id="press-sheet-footer">
                <span>Aether Editorial Engine</span>
                <span>Página 1</span>
              </footer>
            </article>
          </main>
        </div>
      </div>
    `;

    // Cachear referencias DOM del pliego
    this.sheetEl = this.backdropEl.querySelector('#press-sheet') as HTMLDivElement;
    this.sheetHeaderEl = this.backdropEl.querySelector('#press-sheet-header') as HTMLDivElement;
    this.sheetTitleEl = this.backdropEl.querySelector('#press-sheet-title') as HTMLDivElement;
    this.sheetContentEl = this.backdropEl.querySelector('#press-sheet-content') as HTMLDivElement;
    this.sheetFooterEl = this.backdropEl.querySelector('#press-sheet-footer') as HTMLDivElement;
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
   * Actualiza el pliego físico con los ajustes cosméticos en tiempo real.
   */
  private updateSheetStyles(): void {
    // 1. Tipografía y caja
    this.sheetContentEl.style.fontSize = this.fontSize;
    this.sheetContentEl.style.lineHeight = this.lineHeight;
    this.sheetContentEl.style.textAlign = this.textAlign;

    // 2. Familia tipográfica
    this.sheetEl.classList.remove('font-serif', 'font-sans', 'font-mono');
    this.sheetEl.classList.add(`font-${this.fontFamily}`);

    // 3. Márgenes
    this.sheetEl.classList.remove('margin-monastic', 'margin-academic', 'margin-compact');
    this.sheetEl.classList.add(`margin-${this.marginPreset}`);

    // 4. Sangría
    if (this.hasIndent) {
      this.sheetEl.classList.add('has-indent');
    } else {
      this.sheetEl.classList.remove('has-indent');
    }

    // 5. Encabezado y Pie
    this.sheetHeaderEl.classList.toggle('is-hidden', !this.showCoverHeader);
    this.sheetFooterEl.classList.toggle('is-hidden', !this.showPageNumber);

    const dateEl = this.sheetHeaderEl.querySelector('.press-sheet-date') as HTMLElement | null;
    if (dateEl) {
      dateEl.style.display = this.showDate ? 'inline' : 'none';
    }
  }

  /**
   * Abre La Prensa inyectando el contenido vivo desde Cristal.
   */
  public open(data: PressDocumentData): void {
    this.isOpen = true;

    // Actualizar contenido del pliego
    const title = data.title.trim() || 'Sin Título';
    this.sheetTitleEl.innerText = title;

    const docTitleLabel = this.sheetHeaderEl.querySelector('.press-sheet-doc-title');
    if (docTitleLabel) docTitleLabel.textContent = title;

    const dateLabel = this.sheetHeaderEl.querySelector('.press-sheet-date');
    if (dateLabel) {
      dateLabel.textContent = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    // Renderizar párrafos respetando saltos
    if (data.paragraphs.length > 0) {
      this.sheetContentEl.innerHTML = data.paragraphs
        .map((p) => `<p>${p.trim()}</p>`)
        .join('');
    } else {
      this.sheetContentEl.innerHTML = `<p style="font-style: italic; color: #888;">El santuario está en blanco. Escribe primero en Cristal para generar el pliego.</p>`;
    }

    this.updateSheetStyles();
    this.backdropEl.classList.add('is-open');
    this.audio.play(432, 'triangle', 0.4, 0.12);
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
