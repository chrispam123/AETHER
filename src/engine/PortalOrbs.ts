/**
 * ============================================================================
 * CAPA 2: RENDERIZADOR DE LOS ORBES DE LLEGADA (PORTAL ORBS)
 * ============================================================================
 * Renderiza los tres orbes vivos con física diferenciada en la bienvenida:
 * - ☁️ Niebla: Halo estocástico difuso con aura dispersa.
 * - 💧 Fluido: Gota líquida con deformación oscilatoria de onda.
 * - 💎 Cristal: Prisma geométrico rotatorio con refracción y facetas nítidas.
 */

interface OrbDefinition {
  color: [number, number, number];
  baseR: number;
}

export class PortalOrbs {
  private orbs: Record<'vapor' | 'liquid' | 'crystal', OrbDefinition> = {
    vapor: { color: [184, 169, 201], baseR: 30 },
    liquid: { color: [126, 168, 149], baseR: 30 },
    crystal: { color: [217, 186, 133], baseR: 30 }
  };

  /**
   * Dibuja los tres orbes alineados con las tarjetas de anclaje de la UI.
   */
  public render(ctx: CanvasRenderingContext2D, time: number): void {
    const anchors = {
      vapor: this.getAnchorCenter('anchor-vapor'),
      liquid: this.getAnchorCenter('anchor-liquid'),
      crystal: this.getAnchorCenter('anchor-crystal')
    };

    (Object.keys(this.orbs) as Array<keyof typeof this.orbs>).forEach(key => {
      const o = this.orbs[key];
      const pos = anchors[key];
      if (!pos) return;

      const [r, g, b] = o.color;
      const breath = Math.sin(time * 2.3 + (key === 'vapor' ? 0 : key === 'liquid' ? 2 : 4)) * 3.5;
      const currentR = o.baseR + breath;

      // 1. Aura translúcida radial
      const grad = ctx.createRadialGradient(pos.x, pos.y, 4, pos.x, pos.y, currentR * 2.2);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.75)`);
      grad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.18)`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, currentR * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // 2. Núcleo con física específica según la materia
      ctx.beginPath();
      if (key === 'vapor') {
        // Vapor: Halo difuso
        ctx.arc(pos.x, pos.y, currentR * 0.75, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(232, 229, 222, 0.92)`;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.7)`;
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (key === 'liquid') {
        // Fluido: Gota con ondulación de bordes
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2; a += 0.2) {
          const wave = Math.sin(a * 4 + time * 3.5) * 2.5;
          const rad = currentR * 0.8 + wave;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(232, 229, 222, 0.92)`;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.7)`;
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.restore();
      } else {
        // Cristal: Facetas hexagonales y rotación angular
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(time * 0.5);
        ctx.beginPath();
        const sides = 6;
        for (let i = 0; i < sides; i++) {
          const angle = (i * 2 * Math.PI) / sides;
          const rad = currentR * 0.8;
          const px = Math.cos(angle) * rad;
          const py = Math.sin(angle) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(232, 229, 222, 0.95)`;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.restore();
      }
    });
  }

  private getAnchorCenter(elementId: string): { x: number; y: number } | null {
    const el = document.getElementById(elementId);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }
}
