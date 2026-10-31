/**
 * ============================================================================
 * CAPA 3: MARGEN DE MATERIA PRIMA (RAW GUTTER - ALJIBE DERECHO)
 * ============================================================================
 * Implementa la Vía A: La Despensa Simétrica en el Margen Derecho.
 * - Muestra las ideas y pensamientos nacidos en Niebla/Fluido como gemas minerales.
 * - Flota en simetría con el Margen de Descartes de la izquierda.
 * - En reposo permanece en penumbra serena (15% opacidad) para no distraer.
 * - Al acercar el cursor se ilumina con presencia cristalina (100%).
 * - Al pulsar sobre una gema, se disuelve hacia el cursor de la prosa y
 *   despierta un pulso de luz cálida en el párrafo receptor.
 * - Una vez consumida, queda incorporada y jamás resucita en la bandeja.
 */

import { DocumentGraph } from '../../core/DocumentGraph';
import { ThoughtNode } from '../../core/types';
import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';

export type FuseCallback = (text: string, nodeId: string) => void;

export class RawGutter {
  private container: HTMLDivElement;
  private graph: DocumentGraph;
  private audio: HarmonicSynthesizer;
  private fuseCallbacks: Set<FuseCallback> = new Set();

  constructor(graph: DocumentGraph, audio: HarmonicSynthesizer) {
    this.graph = graph;
    this.audio = audio;
    this.container = this.getOrCreateContainer();

    // Actualiza la despensa cada vez que el grafo de ideas cambie
    this.graph.subscribe(() => {
      this.render();
    });

    this.render();
  }

  /**
   * Obtiene o crea el contenedor del margen derecho en el DOM.
   */
  private getOrCreateContainer(): HTMLDivElement {
    let gutter = document.getElementById('raw-gutter') as HTMLDivElement;
    if (!gutter) {
      gutter = document.createElement('div');
      gutter.id = 'raw-gutter';
      gutter.className = 'raw-gutter';
      gutter.style.display = 'none'; // Oculto de fábrica: solo despierta en fase Cristal
      document.body.appendChild(gutter);
    } else {
      gutter.style.display = 'none';
    }
    return gutter;
  }

  /**
   * Registra el callback que se invocará al fundir una gema en la prosa.
   */
  public onFuse(callback: FuseCallback): void {
    this.fuseCallbacks.add(callback);
  }

  /**
   * Ejecuta la fusión de la gema hacia el texto.
   */
  private triggerFuse(node: ThoughtNode, chipElement: HTMLElement): void {
    // 1. Animación de disolución orgánica hacia la izquierda
    chipElement.classList.add('is-dissolving');

    // 2. Tono de cristalización armónica (528 Hz - Solfeggio de transformación)
    this.audio.play(528, 'sine', 0.45, 0.16);

    setTimeout(() => {
      // 3. Notifica al editor para insertar el texto y disparar el pulso de luz en el párrafo
      this.fuseCallbacks.forEach((fn) => fn(node.text, node.id));

      // 4. Marca como consumida definitivamente en el grafo
      this.graph.markAsConsumed(node.id);
    }, 200);
  }

  /**
   * Renderiza las gemas de materia prima vírgenes en el canalón derecho.
   */
  public render(): void {
    this.container.innerHTML = '';

    // Obtiene las notas ordenadas según el Río Narrativo trazado en Fluido
    const availableNodes = this.graph.getOrderedFlowNodes();

    if (availableNodes.length === 0) {
      // Estado Zen: Todo ha sido cristalizado
      const emptyEl = document.createElement('div');
      emptyEl.className = 'raw-empty-zen';
      emptyEl.innerHTML = `
        <span class="raw-empty-icon">✧</span>
        <span>Toda la materia prima ha sido cristalizada</span>
      `;
      this.container.appendChild(emptyEl);
      return;
    }

    // Cabecera discreta del aljibe
    const header = document.createElement('div');
    header.className = 'raw-gutter-header';
    header.innerHTML = `<span>✦</span> Materia Prima (${availableNodes.length})`;
    this.container.appendChild(header);

    // Listado de gemas minerales en el orden del cauce
    availableNodes.forEach((node) => {
      const chip = document.createElement('div');
      chip.className = 'raw-chip';
      chip.id = `raw-chip-${node.id}`;

      const previewText =
        node.text.length > 76 ? node.text.substring(0, 74) + '…' : node.text;

      const flowRole = this.graph.getNodeFlowRole(node.id);
      const badgeText = flowRole.sequenceTitle
        ? `${flowRole.sequenceTitle} · ${node.tag || 'Intuición'}`
        : (node.tag || 'Intuición');

      chip.innerHTML = `
        <div class="raw-chip-badge">${badgeText}</div>
        <div class="raw-chip-text" title="Haz clic para fundir en el cursor">${previewText}</div>
        <div class="raw-chip-footer">
          <span class="raw-chip-action">Fundir en prosa ↵</span>
        </div>
      `;

      chip.addEventListener('click', () => {
        this.triggerFuse(node, chip);
      });

      this.container.appendChild(chip);
    });
  }

  /**
   * Muestra u oculta el margen según la fase activa del editor (Modo Cristal).
   */
  public setVisible(visible: boolean): void {
    if (visible) {
      this.container.style.display = 'flex';
      this.render();
    } else {
      this.container.style.display = 'none';
    }
  }

  /**
   * Retorna el elemento contenedor DOM.
   */
  public getContainer(): HTMLDivElement {
    return this.container;
  }
}
