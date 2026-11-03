/**
 * ============================================================================
 * CAPA DE ALMACENAMIENTO: GESTOR DE EXPORTACIÓN E IMPORTACIÓN (EXPORT MANAGER)
 * ============================================================================
 * Permite la portabilidad absoluta de los pensamientos del autor:
 * 1. Formato Universal .aether (Topología Cognitiva Completa):
 *    - Nodos de Niebla y Fluido con coordenadas duales preservadas.
 *    - Puentes semánticos del Río Narrativo.
 *    - Prosa del Santuario Cristal y título.
 *    - Descartes podados pero preservados en el margen izquierdo.
 *    - Estado del espacio de trabajo (fase y encuadres de cámara).
 * 2. Formato Markdown Puro .md (Interoperabilidad con Obsidian / Typora):
 *    - YAML Frontmatter con metadatos de condensación.
 *    - Jerarquía de encabezados limpia y texto tipográfico.
 * 3. Importador Bidireccional seguro con validación de esquema.
 */

import { ThoughtNode, ConnectionBridge, Phase, DiscardItem } from '../../core/types';
import { HtmlToMarkdown } from './HtmlToMarkdown';

export interface AetherTopologyBackup {
  version: 1;
  schema: 'aether_thought_topology';
  exportedAt: string;
  document: {
    title: string;
    bodyHtml: string;
    bodyText: string;
  };
  nodes: ThoughtNode[];
  bridges: ConnectionBridge[];
  discards?: DiscardItem[];
  workspace: {
    activePhase: Phase;
    cameraStates?: Partial<Record<Phase, { x: number; y: number; zoom: number }>>;
    atmosphereLandscapeId?: string | null;
  };
}

export class ExportManager {
  /**
   * Sanitiza un título para ser usado como nombre de archivo seguro en cualquier SO.
   */
  private static sanitizeFilename(title: string): string {
    const clean = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quita tildes
      .replace(/[^a-z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    return clean || 'aether_document';
  }

  /**
   * Descarga un archivo en el navegador mediante un enlace efímero.
   */
  private static downloadBlob(blob: Blob, filename: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // Liberar URL tras 100 ms
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Exporta la topología completa a un archivo nativo .aether (JSON enriquecido).
   */
  public static exportToAetherFile(data: {
    title: string;
    bodyHtml: string;
    bodyText: string;
    nodes: ThoughtNode[];
    bridges: ConnectionBridge[];
    discards?: DiscardItem[];
    activePhase: Phase;
    cameraStates?: Partial<Record<Phase, { x: number; y: number; zoom: number }>>;
    atmosphereLandscapeId?: string | null;
  }): void {
    const backup: AetherTopologyBackup = {
      version: 1,
      schema: 'aether_thought_topology',
      exportedAt: new Date().toISOString(),
      document: {
        title: data.title,
        bodyHtml: data.bodyHtml,
        bodyText: data.bodyText
      },
      nodes: data.nodes,
      bridges: data.bridges,
      discards: data.discards || [],
      workspace: {
        activePhase: data.activePhase,
        cameraStates: data.cameraStates,
        atmosphereLandscapeId: data.atmosphereLandscapeId
      }
    };

    const jsonString = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const filename = `${this.sanitizeFilename(data.title)}_${Date.now()}.aether`;

    this.downloadBlob(blob, filename);
  }

  /**
   * Exporta la obra en prosa a un archivo Markdown estándar (.md) con Frontmatter y fidelidad tipográfica.
   */
  public static exportToMarkdownFile(data: {
    title: string;
    bodyHtml?: string;
    bodyText: string;
    nodesCount?: number;
    activePhase?: Phase;
  }): void {
    const nowIso = new Date().toISOString().split('T')[0];
    const cleanTitle = data.title.trim() || 'Sin título';

    // Transpilar con fidelidad semántica real si disponemos de bodyHtml
    const proseMarkdown = data.bodyHtml
      ? HtmlToMarkdown.convert(data.bodyHtml)
      : data.bodyText.trim();

    const frontmatter = [
      '---',
      `title: "${cleanTitle.replace(/"/g, '\\"')}"`,
      `date: "${nowIso}"`,
      `generator: "Aether"`,
      '---',
      '',
      `# ${cleanTitle}`,
      '',
      proseMarkdown,
      ''
    ].join('\n');

    const blob = new Blob([frontmatter], { type: 'text/markdown;charset=utf-8' });
    const filename = `${this.sanitizeFilename(cleanTitle)}.md`;

    this.downloadBlob(blob, filename);
  }

  /**
   * Abre de forma programática el selector de archivos del navegador.
   */
  public static selectFile(accept: string = '.aether'): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.display = 'none';

      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          resolve(input.files[0]);
        } else {
          resolve(null);
        }
        document.body.removeChild(input);
      };

      input.oncancel = () => {
        resolve(null);
        document.body.removeChild(input);
      };

      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * Lee y valida un archivo .aether cargado por el usuario.
   */
  public static async parseAetherFile(file: File): Promise<AetherTopologyBackup> {
    const content = await file.text();
    let data: any;

    try {
      data = JSON.parse(content);
    } catch {
      throw new Error('El archivo no es un JSON válido.');
    }

    if (data.schema !== 'aether_thought_topology' || data.version !== 1) {
      throw new Error('El formato o la versión del archivo .aether no es compatible.');
    }

    if (!data.document || !Array.isArray(data.nodes)) {
      throw new Error('El archivo .aether está incompleto o dañado.');
    }

    return data as AetherTopologyBackup;
  }
}
