/**
 * ============================================================================
 * CAPA 2: POLVO CÓSMICO Y PARTÍCULAS AMBIENTALES DEL ÉTER
 * ============================================================================
 * Simula partículas microscópicas de luz que flotan en el vacío.
 * Otorga profundidad espacial al sustrato mineral.
 */

interface Particle {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  alpha: number;
}

export class AmbientDust {
  private particles: Particle[] = [];

  constructor(count: number = 55) {
    this.init(count);
  }

  private init(count: number): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.3 + 0.4,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      alpha: Math.random() * 0.35 + 0.08
    }));
  }

  /**
   * Actualiza y dibuja las partículas en el contexto 2D del Canvas.
   */
  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      // Envoltura toroidal en los bordes de la pantalla
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(232, 229, 222, ${p.alpha * 0.28})`;
      ctx.fill();
    }
    ctx.restore();
  }
}
