/**
 * ============================================================================
 * CAPA 2: PUENTES DE TENSIÓN Y CORRIENTES DE ENERGÍA (FLUID BRIDGES)
 * ============================================================================
 * Dibuja los cauces del Río Narrativo en estado Fluido:
 * - Diseñado para no distraer la lectura: susurro acuático tenue, lento y sereno.
 * - Cauce fino y translúcido (opacidad ~28%) en segundo plano.
 * - Gotas sutiles que flotan lentamente (speed 0.07) con desvanecimiento orgánico (envelope).
 * - Cabezal de dirección discreto en la desembocadura.
 */

import { DocumentGraph } from '../core/DocumentGraph';
import { Vector2D } from '../core/types';

export class FluidBridges {
  /**
   * Dibuja las corrientes vivas del río narrativo con cadencia lenta y atenuada.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    graph: DocumentGraph,
    time: number,
    dragStream?: { sourcePos: Vector2D; currentPos: Vector2D } | null
  ): void {
    const bridges = graph.getBridges();

    // 1. Dibuja los cauces consolidados del río
    bridges.forEach((bridge, idx) => {
      const source = graph.getNode(bridge.sourceId);
      const target = graph.getNode(bridge.targetId);
      if (!source || !target) return;

      const a = source.position;
      const b = target.position;

      // Respiración hidráulica muy lenta (0.5x) y de baja amplitud (8px) para cero distracción
      const midX = (a.x + b.x) / 2 + Math.sin(time * 0.5 + idx) * 8;
      const midY = (a.y + b.y) / 2 + Math.cos(time * 0.5 + idx) * 8 + 18;

      ctx.save();

      // Cauce fino y translúcido de fondo (no compite con el texto de las tarjetas)
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(midX, midY, b.x, b.y);
      ctx.strokeStyle = 'rgba(126, 168, 149, 0.25)';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = 'rgba(126, 168, 149, 0.18)';
      ctx.shadowBlur = 5;
      ctx.stroke();

      // Flecha / Cabezal de dirección discreto y pequeño en la desembocadura
      const dx = b.x - midX;
      const dy = b.y - midY;
      const angle = Math.atan2(dy, dx);
      const arrowDist = 76; // Retroceso para apoyar suavemente en el borde de la tarjeta
      const arrowX = b.x - Math.cos(angle) * arrowDist;
      const arrowY = b.y - Math.sin(angle) * arrowDist;

      ctx.fillStyle = 'rgba(126, 168, 149, 0.38)';
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - 9 * Math.cos(angle - Math.PI / 6),
        arrowY - 9 * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        arrowX - 9 * Math.cos(angle + Math.PI / 6),
        arrowY - 9 * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      // Corriente lenta y serena: 2 gotas pequeñas con desvanecimiento en extremos
      const dropCount = 2;
      for (let k = 0; k < dropCount; k++) {
        // Velocidad pausada (0.07): un ciclo completo tarda ~14 segundos
        const speed = 0.07;
        const offset = k / dropCount;
        const t = (time * speed + offset) % 1;

        // Suavizado en extremos (desvanece a 0 al salir de A y al llegar a B)
        const alpha = Math.sin(t * Math.PI) * 0.42;
        if (alpha <= 0.01) continue;

        // Posición paramétrica en la curva bezier cuadrática
        const px =
          Math.pow(1 - t, 2) * a.x +
          2 * (1 - t) * t * midX +
          Math.pow(t, 2) * b.x;
        const py =
          Math.pow(1 - t, 2) * a.y +
          2 * (1 - t) * t * midY +
          Math.pow(t, 2) * b.y;

        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160, 215, 195, ${alpha})`;
        ctx.shadowColor = `rgba(126, 168, 149, ${alpha * 0.6})`;
        ctx.shadowBlur = 4;
        ctx.fill();
      }

      ctx.restore();
    });

    // 2. Trazado interactivo en tiempo real al arrastrar (tenue y claro)
    if (dragStream) {
      const a = dragStream.sourcePos;
      const b = dragStream.currentPos;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2 + 20;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(midX, midY, b.x, b.y);
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 5]);
      ctx.shadowColor = 'rgba(212, 175, 55, 0.25)';
      ctx.shadowBlur = 6;
      ctx.stroke();

      ctx.restore();
    }
  }
}
