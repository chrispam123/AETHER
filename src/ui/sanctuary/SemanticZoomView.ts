/**
 * ============================================================================
 * CAPA 3: VISTA DE ZOOM SEMÁNTICO (SEMANTIC ZOOM VIEW)
 * ============================================================================
 * Renderiza los niveles de abstracción conceptual del Pilar 3 (Bret Victor):
 * - Nivel 50% ('thesis'): Muestra la Frase Tesis de cada párrafo en tipografía
 *   destacada y pliega el texto secundario en un acordeón orgánico tenue.
 * - Nivel 20% ('map'): Transforma el ensayo en una cartografía de bloques
 *   estructurales en cascada (Premisa -> Tensión -> Evidencia -> Conclusión).
 * - Permite al autor pulsar sobre cualquier bloque para descender instantáneamente
 *   al 100% (Modo Prosa) enfocado en ese párrafo.
 */

import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';

export interface ParagraphBlock {
  index: number;
  fullText: string;
  sentences: string[];
  thesisSentence: string;
  isManualThesis: boolean;
  roleLabel: string;
  sectionTitle?: string;
}

export type JumpToParagraphCallback = (paragraphIndex: number) => void;

export class SemanticZoomView {
  private thesisContainer: HTMLDivElement;
  private mapContainer: HTMLDivElement;
  private audio: HarmonicSynthesizer;
  private onJumpCallback: JumpToParagraphCallback | null = null;

  constructor(
    thesisContainer: HTMLDivElement,
    mapContainer: HTMLDivElement,
    audio: HarmonicSynthesizer
  ) {
    this.thesisContainer = thesisContainer;
    this.mapContainer = mapContainer;
    this.audio = audio;
  }

  /**
   * Registra el callback para cuando el autor hace clic en una tesis y desea saltar a la prosa.
   */
  public onJumpToParagraph(cb: JumpToParagraphCallback): void {
    this.onJumpCallback = cb;
  }

  /**
   * Parsea el texto del cuerpo en bloques de párrafos y oraciones,
   * detectando de forma inteligente títulos de sección / lemas breves para agruparlos armónicamente.
   */
  public parseParagraphs(text: string, manualTheses: Map<number, string>): ParagraphBlock[] {
    const rawParagraphs = text
      .split(/\r?\n\s*\r?\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const roles = [
      '01 · Premisa Fundamental',
      '02 · Tensión Dialéctica',
      '03 · Evidencia / Desarrollo',
      '04 · Punto de Inflexión',
      '05 · Síntesis / Conclusión',
      '06 · Resonancia Final'
    ];

    const result: ParagraphBlock[] = [];
    let pendingSectionTitle: string | undefined = undefined;
    let blockIndex = 0;

    for (let i = 0; i < rawParagraphs.length; i++) {
      const pText = rawParagraphs[i];

      // Detección de encabezado de sección o lema:
      // Corto (hasta 48 caracteres), sin punto final, y seguido de otro bloque
      const isHeaderLike = pText.length <= 48 && !/[.!?:]\s*$/.test(pText) && i < rawParagraphs.length - 1;

      if (isHeaderLike) {
        pendingSectionTitle = pText;
        continue; // Este encabezado se une como estandarte del párrafo siguiente
      }

      // Divide en oraciones respetando puntos (.!?), o saltos de línea internos simples (\n)
      const sentences = pText
        .split(/(?<=[.!?])\s+|\r?\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const manual = manualTheses.get(blockIndex);
      const thesis = manual || (sentences.length > 0 ? sentences[0] : pText);
      const isManual = Boolean(manual);
      const roleLabel = roles[blockIndex] || `${(blockIndex + 1).toString().padStart(2, '0')} · Bloque Argumental`;

      result.push({
        index: blockIndex,
        fullText: pText,
        sentences: sentences.length > 0 ? sentences : [pText],
        thesisSentence: thesis,
        isManualThesis: isManual,
        roleLabel,
        sectionTitle: pendingSectionTitle
      });

      pendingSectionTitle = undefined;
      blockIndex++;
    }

    // Fallback si todos los bloques eran cortos y quedó vacío
    if (result.length === 0 && rawParagraphs.length > 0) {
      const pText = rawParagraphs[0];
      result.push({
        index: 0,
        fullText: pText,
        sentences: [pText],
        thesisSentence: pText,
        isManualThesis: false,
        roleLabel: roles[0]
      });
    }

    return result;
  }

  /**
   * Renderiza el nivel 50% ('thesis'): Frases nucleares destacadas y relleno plegado.
   */
  public renderThesisView(blocks: ParagraphBlock[]): void {
    this.thesisContainer.innerHTML = '';

    if (blocks.length === 0) {
      this.thesisContainer.innerHTML = `
        <div class="crystal-empty-thesis">Escribe en el santuario para ver el esqueleto de tus ideas...</div>
      `;
      return;
    }

    blocks.forEach((block) => {
      const card = document.createElement('div');
      card.className = 'thesis-card';
      card.dataset.index = block.index.toString();

      // Si tiene título de sección asociado, lo mostramos como insignia noble
      if (block.sectionTitle) {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'thesis-section-tag';
        sectionEl.innerText = `§ ${block.sectionTitle}`;
        card.appendChild(sectionEl);
      }

      // Frase tesis principal
      const thesisEl = document.createElement('div');
      thesisEl.className = `thesis-sentence ${block.isManualThesis ? 'manual-chosen' : ''}`;
      thesisEl.innerHTML = `
        <span class="thesis-marker">${block.isManualThesis ? '✨' : '●'}</span>
        <span class="thesis-text">${block.thesisSentence}</span>
      `;
      thesisEl.title = 'Haz clic para descender a este párrafo en Modo Prosa';

      thesisEl.addEventListener('click', () => {
        this.audio.play(528, 'sine', 0.3, 0.1);
        if (this.onJumpCallback) this.onJumpCallback(block.index);
      });

      // Texto secundario del párrafo (plegado en reposo, legible al pasar el cursor)
      const secondarySentences = block.sentences.filter((s) => s !== block.thesisSentence);
      const secondaryEl = document.createElement('div');
      secondaryEl.className = 'thesis-secondary-text';

      if (secondarySentences.length > 0) {
        secondaryEl.innerText = secondarySentences.join(' ');
        secondaryEl.title = 'Texto secundario plegado (pasa el ratón para asomarte)';
      } else {
        secondaryEl.style.display = 'none';
      }

      card.appendChild(thesisEl);
      if (secondarySentences.length > 0) {
        card.appendChild(secondaryEl);
      }

      this.thesisContainer.appendChild(card);
    });
  }

  /**
   * Renderiza el nivel 20% ('map'): Cartografía pura de bloques arquitectónicos con puentes.
   */
  public renderMapView(blocks: ParagraphBlock[]): void {
    this.mapContainer.innerHTML = '';

    if (blocks.length === 0) {
      this.mapContainer.innerHTML = `
        <div class="crystal-empty-thesis">No hay suficientes bloques para generar la cartografía...</div>
      `;
      return;
    }

    const flowWrapper = document.createElement('div');
    flowWrapper.className = 'argument-flow-wrapper';

    blocks.forEach((block, idx) => {
      const nodeEl = document.createElement('div');
      nodeEl.className = 'argument-node-card';
      nodeEl.dataset.index = block.index.toString();

      // Recorta la tesis si es muy extensa para que se mantenga como bloque visual nítido
      const shortThesis =
        block.thesisSentence.length > 110
          ? block.thesisSentence.substring(0, 106) + '...'
          : block.thesisSentence;

      const sectionBadge = block.sectionTitle ? `<div class="map-section-tag">§ ${block.sectionTitle}</div>` : '';

      nodeEl.innerHTML = `
        ${sectionBadge}
        <div class="argument-node-tag">${block.roleLabel}</div>
        <div class="argument-node-body">${shortThesis}</div>
        <div class="argument-node-footer">
          <span>${block.isManualThesis ? '✨ Tesis elegida por autor' : 'Tesis inicial'}</span>
          <span class="jump-prompt">Descender ↵</span>
        </div>
      `;

      nodeEl.addEventListener('click', () => {
        this.audio.play(528, 'sine', 0.4, 0.12);
        if (this.onJumpCallback) this.onJumpCallback(block.index);
      });

      flowWrapper.appendChild(nodeEl);

      // Si no es el último bloque, dibuja un puente de flujo conector
      if (idx < blocks.length - 1) {
        const connector = document.createElement('div');
        connector.className = 'argument-flow-connector';
        connector.innerHTML = `
          <div class="connector-line"></div>
          <div class="connector-arrow">▼</div>
        `;
        flowWrapper.appendChild(connector);
      }
    });

    this.mapContainer.appendChild(flowWrapper);
  }
}
