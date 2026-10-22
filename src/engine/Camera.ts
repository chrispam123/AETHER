/**
 * ============================================================================
 * CAPA 2: CÁMARA MATEMÁTICA Y PROYECCIÓN ESPACIAL 2D
 * ============================================================================
 * Gestiona la transformación afín entre el espacio infinito (mundo) y la pantalla:
 * - Conversión de coordenadas: Mundo -> Pantalla y Pantalla -> Mundo.
 * - Desplazamiento (Pan) con inercia.
 * - Factor de aumento (Zoom) continuo.
 */

import { Vector2D } from '../core/types';

export class Camera {
  public x: number = 0;
  public y: number = 0;
  public zoom: number = 1.0;

  /**
   * Transforma una coordenada del espacio infinito del mundo a píxeles de pantalla.
   */
  public worldToScreen(worldPoint: Vector2D): Vector2D {
    return {
      x: (worldPoint.x - this.x) * this.zoom + window.innerWidth / 2,
      y: (worldPoint.y - this.y) * this.zoom + window.innerHeight / 2
    };
  }

  /**
   * Transforma un clic de pantalla (píxeles) a la coordenada real en el mundo infinito.
   */
  public screenToWorld(screenPoint: Vector2D): Vector2D {
    return {
      x: (screenPoint.x - window.innerWidth / 2) / this.zoom + this.x,
      y: (screenPoint.y - window.innerHeight / 2) / this.zoom + this.y
    };
  }

  /**
   * Desplaza la cámara suavemente.
   */
  public pan(deltaX: number, deltaY: number): void {
    this.x -= deltaX / this.zoom;
    this.y -= deltaY / this.zoom;
  }

  /**
   * Modifica el zoom centrándolo en una coordenada específica de pantalla.
   */
  public setZoom(targetZoom: number): void {
    this.zoom = Math.min(Math.max(targetZoom, 0.2), 3.0);
  }
}
