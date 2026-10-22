/**
 * ============================================================================
 * CAPA 3: SANTUARIO EDITORIAL MONÁSTICO (EDITORIAL EDITOR)
 * ============================================================================
 * Gestiona el entorno de escritura pura en estado Cristal:
 * - Título y cuerpo de prosa con tipografía calibrada.
 * - Métricas de ritmo en tiempo real (palabras y tiempo de lectura).
 * - Bandeja de "Materia Prima" con las ideas destiladas en fases previas.
 */

import { DocumentGraph } from '../../core/DocumentGraph';
import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';

export class EditorialEditor {
  private container: HTMLDivElement;
  private bodyElement: HTMLDivElement;
  private wordCountEl: HTMLSpanElement;
  private readTimeEl: HTMLSpanElement;
  private chipsContainer: HTMLDivElement;
  private graph: DocumentGraph;
  private audio: HarmonicSynthesizer;

  constructor(graph: DocumentGraph, audio: HarmonicSynthesizer) {
    this.graph = graph;
    this.audio = audio;

    this.container = document.getElementById('crystal-sanctuary') as HTMLDivElement;
    this.bodyElement = document.querySelector('.crystal-body') as HTMLDivElement;
    this.wordCountEl = document.getElementById('word-count') as HTMLSpanElement;
    this.readTimeEl = document.getElementById('read-time') as HTMLSpanElement;
    this.chipsContainer = document.getElementById('crystal-chips-container') as HTMLDivElement;

    this.initMetrics();
    this.updateChips();

    // Actualiza los chips cuando el grafo de ideas cambie
    this.graph.subscribe(() => this.updateChips());
  }

  /**
   * Muestra u oculta el santuario editorial según la fase activa.
   */
  public setVisible(visible: boolean): void {
    if (visible) {
      this.container.classList.add('active');
      this.updateChips();
    } else {
      this.container.classList.remove('active');
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
   * Refresca las gemas de ideas previas en la bandeja de materia prima.
   */
  public updateChips(): void {
    if (!this.chipsContainer) return;
    this.chipsContainer.innerHTML = '';

    const nodes = this.graph.getAllNodes();
    nodes.forEach(node => {
      if (!node.text.trim()) return;

      const chip = document.createElement('div');
      chip.className = 'crystal-chip';
      chip.innerText = node.text.length > 50 ? node.text.substring(0, 48) + '...' : node.text;
      chip.title = 'Haz clic para insertar este pensamiento en tu texto';

      chip.onclick = () => {
        if (this.bodyElement) {
          this.bodyElement.innerText += '\n\n' + node.text;
          this.bodyElement.dispatchEvent(new Event('input'));
          this.audio.play(540, 'sine', 0.4, 0.14);
        }
      };

      this.chipsContainer.appendChild(chip);
    });
  }
}
