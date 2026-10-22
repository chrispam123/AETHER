/**
 * ============================================================================
 * CAPA 2: PUENTES DE TENSIÓN Y CORRIENTES DE ENERGÍA (FLUID BRIDGES)
 * ============================================================================
 * Dibuja los filamentos elásticos y pulsos luminosos entre ideas en estado Fluido.
 * Detecta proximidad y calcula la tensión dialéctica entre nodos contiguos.
 */

import { ThoughtNode } from '../core/types';

export class FluidBridges {
  /**
   * Dibuja los filamentos bezier dinámicos y los pulsos de energía.
   */
  public render(ctx: CanvasRenderingContext2D, nodes: ThoughtNode[], time: number): void {
    const maxConnectionDistance = 600;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].position;
        const b = nodes[j].position;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxConnectionDistance) {
          // Intensidad proporcional a la cercanía
          const alpha = Math.max(0.08, (1 - dist / maxConnectionDistance) * 0.75);

          // Punto de control bezier con oscilación armónica viva
          const midX = (a.x + b.x) / 2 + Math.sin(time * 2 + i) * 20;
          const midY = (a.y + b.y) / 2 + Math.cos(time * 2 + j) * 20;

          // 1. Filamento elástico
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(midX, midY, b.x, b.y);
          ctx.strokeStyle = `rgba(126, 168, 149, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          // 2. Pulso cuántico que viaja por la línea
          const pulsePos = (time * 0.4) % 1;
          const px = Math.pow(1 - pulsePos, 2) * a.x + 2 * (1 - pulsePos) * pulsePos * midX + Math.pow(pulsePos, 2) * b.x;
          const py = Math.pow(1 - pulsePos, 2) * a.y + 2 * (1 - pulsePos) * pulsePos * midY + Math.pow(pulsePos, 2) * b.y;

          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(126, 168, 149, 0.95)`;
          ctx.shadowColor = `rgba(126, 168, 149, 0.8)`;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }
  }
}
