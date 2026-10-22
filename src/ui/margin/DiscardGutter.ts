/**
 * ============================================================================
 * CAPA 3: MARGEN DE DESCARTES Y MEMORIA MUSCULAR (DISCARD GUTTER)
 * ============================================================================
 * Implementa la inercia y masa del texto:
 * - Captura frases o párrafos borrados intencionalmente por el usuario.
 * - Los almacena como "virutas de pensamiento" en el canalón lateral izquierdo.
 * - Permite restaurar cualquier idea descartada con un solo clic.
 */

import { DiscardItem } from '../../core/types';
import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';

export type RestoreCallback = (text: string) => void;

export class DiscardGutter {
  private container: HTMLDivElement;
  private items: DiscardItem[] = [];
  private restoreCallbacks: Set<RestoreCallback> = new Set();
  private audio: HarmonicSynthesizer;

  constructor(audio: HarmonicSynthesizer) {
    this.audio = audio;
    this.container = this.getOrCreateContainer();
  }

  /**
   * Obtiene o crea el elemento contenedor del margen de descartes en el DOM.
   */
  private getOrCreateContainer(): HTMLDivElement {
    let gutter = document.getElementById('discard-gutter') as HTMLDivElement;
    if (!gutter) {
      gutter = document.createElement('div');
      gutter.id = 'discard-gutter';
      gutter.className = 'discard-gutter';
      
      const sanctuary = document.getElementById('crystal-sanctuary');
      if (sanctuary) {
        sanctuary.appendChild(gutter);
      } else {
        document.body.appendChild(gutter);
      }
    }
    return gutter;
  }

  /**
   * Añade una viruta de texto descartada al margen.
   */
  public addDiscard(text: string, originalY?: number): void {
    const cleanText = text.trim();
    if (!cleanText || cleanText.length < 3) return;

    // Evita duplicar exactamente el mismo fragmento consecutivo
    if (this.items.length > 0 && this.items[0].text === cleanText) {
      return;
    }

    const newItem: DiscardItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      text: cleanText,
      timestamp: Date.now(),
      originalY
    };

    // Añade al inicio (el descarte más reciente arriba)
    this.items.unshift(newItem);

    // Mantiene un máximo de 12 virutas para no saturar la vista
    if (this.items.length > 12) {
      this.items.pop();
    }

    // Asegura visibilidad del contenedor al recibir un nuevo descarte
    this.container.style.display = 'flex';
    this.render();
    // Sonido suave de deslizamiento de papel
    this.audio.play(260, 'sine', 0.35, 0.08);
  }

  /**
   * Registra un observador que se ejecutará cuando el autor restaure una viruta.
   */
  public onRestore(callback: RestoreCallback): void {
    this.restoreCallbacks.add(callback);
  }

  /**
   * Restaura una viruta hacia el texto principal.
   */
  private triggerRestore(item: DiscardItem): void {
    this.restoreCallbacks.forEach(fn => fn(item.text));
    // Elimina la viruta del margen una vez recuperada
    this.removeDiscard(item.id);
    this.audio.play(520, 'sine', 0.4, 0.12);
  }

  /**
   * Elimina una viruta del margen.
   */
  public removeDiscard(id: string): void {
    this.items = this.items.filter(it => it.id !== id);
    this.render();
  }

  /**
   * Limpia todo el margen de descartes.
   */
  public clear(): void {
    this.items = [];
    this.render();
  }

  /**
   * Renderiza las virutas de pensamiento en el canalón lateral izquierdo.
   */
  private render(): void {
    this.container.innerHTML = '';

    if (this.items.length === 0) {
      this.container.classList.remove('has-items');
      return;
    }

    this.container.style.display = 'flex';
    this.container.classList.add('has-items');

    // Título discreto del canalón
    const header = document.createElement('div');
    header.className = 'discard-gutter-header';
    header.innerHTML = `<span>⤺</span> Descartes (${this.items.length})`;
    this.container.appendChild(header);

    this.items.forEach(item => {
      const chip = document.createElement('div');
      chip.className = 'discard-chip';
      chip.id = `discard-${item.id}`;

      // Vista previa recortada a 70 caracteres
      const previewText = item.text.length > 70 
        ? item.text.substring(0, 68) + '…' 
        : item.text;

      chip.innerHTML = `
        <div class="discard-chip-text" title="Haz clic para reinsertar en el cursor">${previewText}</div>
        <button class="discard-chip-dismiss" title="Purgar definitivamente">×</button>
      `;

      // Clic en el texto para restaurar
      const textEl = chip.querySelector('.discard-chip-text');
      if (textEl) {
        textEl.addEventListener('click', () => {
          this.triggerRestore(item);
        });
      }

      // Clic en la cruz para eliminar permanentemente
      const dismissBtn = chip.querySelector('.discard-chip-dismiss');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeDiscard(item.id);
        });
      }

      this.container.appendChild(chip);
    });
  }

  /**
   * Muestra u oculta el margen según la fase activa del editor.
   */
  public setVisible(visible: boolean): void {
    if (visible) {
      this.container.style.display = 'flex';
      if (this.items.length > 0) {
        this.container.classList.add('has-items');
      }
    } else {
      this.container.style.display = 'none';
      this.container.classList.remove('has-items');
    }
  }
}
