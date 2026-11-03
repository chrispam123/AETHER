/**
 * ============================================================================
 * CAPA DE ALMACENAMIENTO: TRANSPILADOR SEMÁNTICO DOM -> MARKDOWN (HTML TO MD)
 * ============================================================================
 * Transpilador puro de cero dependencias que convierte el DOM enriquecido
 * de Santuario Cristal en Markdown puro con fidelidad tipográfica:
 * - Cursivas: <em>, <i> -> *énfasis*
 * - Negritas: <strong>, <b> -> **fuerza**
 * - Encabezados: <h1>, <h2>, <h3> -> #, ##, ###
 * - Citas monásticas: <blockquote> -> > cita
 * - Saltos y párrafos: <p>, <div>, <br> -> \n\n y \n
 * - Listas: <ul>, <ol>, <li> -> - item y 1. item
 * - Código: <code>, <pre> -> `código`
 * - Enlaces: <a> -> [texto](url)
 */

export class HtmlToMarkdown {
  /**
   * Convierte un HTML string o un HTMLElement en Markdown sintáctico puro.
   */
  public static convert(input: string | HTMLElement): string {
    if (!input) return '';

    let root: HTMLElement;
    if (typeof input === 'string') {
      if (typeof document === 'undefined') return input;
      const container = document.createElement('div');
      container.innerHTML = input;
      root = container;
    } else {
      root = input;
    }

    const blocks: string[] = [];
    const children = Array.from(root.childNodes);

    // Si no hay nodos hijos, retorna texto vacío
    if (children.length === 0) {
      return '';
    }

    // Detectar si el contenedor tiene elementos de bloque estructurados
    const hasBlocks = children.some(node => 
      node.nodeType === Node.ELEMENT_NODE && 
      this.isBlockTag((node as HTMLElement).tagName)
    );

    if (hasBlocks) {
      for (const node of children) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = (node.textContent || '').replace(/[\u200B\u00A0]/g, ' ').trim();
          if (text.length > 0) {
            blocks.push(text);
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const blockMd = this.processBlock(el);
          if (blockMd !== null) {
            blocks.push(blockMd);
          }
        }
      }
    } else {
      // Contenido plano / inline directo
      const inlineMd = this.processInline(root).trim();
      if (inlineMd.length > 0) {
        blocks.push(inlineMd);
      }
    }

    // Unir bloques con separación estándar de doble salto de línea
    const markdown = blocks
      .filter(b => b.trim().length > 0)
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return markdown;
  }

  /**
   * Determina si una etiqueta HTML es un bloque estructural.
   */
  private static isBlockTag(tag: string): boolean {
    const t = tag.toUpperCase();
    return ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'HR', 'PRE'].includes(t);
  }

  /**
   * Procesa un elemento a nivel de bloque estructural.
   */
  private static processBlock(el: HTMLElement): string | null {
    const tag = el.tagName.toUpperCase();

    // Separador horizontal
    if (tag === 'HR') {
      return '---';
    }

    // Párrafo vacío / salto intencional (Doble Enter)
    const rawContent = el.innerHTML.trim();
    if (rawContent === '' || rawContent === '<br>') {
      return '';
    }

    // Encabezados
    if (tag === 'H1') return `# ${this.processInline(el).trim()}`;
    if (tag === 'H2') return `## ${this.processInline(el).trim()}`;
    if (tag === 'H3') return `### ${this.processInline(el).trim()}`;
    if (tag === 'H4') return `#### ${this.processInline(el).trim()}`;
    if (tag === 'H5') return `##### ${this.processInline(el).trim()}`;
    if (tag === 'H6') return `###### ${this.processInline(el).trim()}`;

    // Cita en bloque (blockquote)
    if (tag === 'BLOCKQUOTE') {
      const inner = this.processInline(el).trim();
      return inner
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n');
    }

    // Bloque de código (pre)
    if (tag === 'PRE') {
      const codeText = el.textContent || '';
      return `\`\`\`\n${codeText.trim()}\n\`\`\``;
    }

    // Lista desordenada (ul)
    if (tag === 'UL') {
      const items = Array.from(el.querySelectorAll(':scope > li'));
      return items.map(li => `- ${this.processInline(li as HTMLElement).trim()}`).join('\n');
    }

    // Lista ordenada (ol)
    if (tag === 'OL') {
      const items = Array.from(el.querySelectorAll(':scope > li'));
      return items.map((li, idx) => `${idx + 1}. ${this.processInline(li as HTMLElement).trim()}`).join('\n');
    }

    // Párrafos (p) y divisiones de línea (div)
    const inner = this.processInline(el).trim();
    return inner.length > 0 ? inner : '';
  }

  /**
   * Recorre recursivamente los nodos inline preservando la semántica tipográfica.
   */
  private static processInline(parent: Node): string {
    let result = '';

    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        // Sustituir espacios duros no separables y espacios invisibles
        result += (node.textContent || '').replace(/[\u200B\u00A0]/g, ' ');
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toUpperCase();

        if (tag === 'BR') {
          result += '\n';
        } else if (tag === 'EM' || tag === 'I') {
          const text = this.processInline(el);
          result += this.wrapFormat(text, '*');
        } else if (tag === 'STRONG' || tag === 'B') {
          const text = this.processInline(el);
          result += this.wrapFormat(text, '**');
        } else if (tag === 'CODE') {
          const text = el.textContent || '';
          result += `\`${text}\``;
        } else if (tag === 'A') {
          const text = this.processInline(el).trim();
          const href = el.getAttribute('href') || '';
          result += href ? `[${text}](${href})` : text;
        } else if (tag === 'SPAN') {
          // Si es un span con estilo inline
          const text = this.processInline(el);
          const fontStyle = el.style.fontStyle;
          const fontWeight = el.style.fontWeight;

          if (fontStyle === 'italic') {
            result += this.wrapFormat(text, '*');
          } else if (fontWeight === 'bold' || parseInt(fontWeight, 10) >= 600) {
            result += this.wrapFormat(text, '**');
          } else {
            result += text;
          }
        } else {
          // Elemento genérico: seguir procesando hijos
          result += this.processInline(el);
        }
      }
    }

    return result;
  }

  /**
   * Encamisa un texto con el delimitador Markdown correspondiente sin romper espacios en los bordes.
   * Ej: " palabra " + "*" -> " *palabra* " (en lugar de "* palabra *", que rompería Markdown).
   */
  private static wrapFormat(text: string, delimiter: string): string {
    if (!text || text.trim().length === 0) return text;

    const leadingSpace = text.match(/^\s*/)?.[0] || '';
    const trailingSpace = text.match(/\s*$/)?.[0] || '';
    const cleanContent = text.trim();

    return `${leadingSpace}${delimiter}${cleanContent}${delimiter}${trailingSpace}`;
  }
}
