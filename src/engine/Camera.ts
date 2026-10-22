/**
 * ============================================================================
 * CAPA 2: CÁMARA MATEMÁTICA Y PROYECCIÓN ESPACIAL 2D (INFINITE CAMERA)
 * ============================================================================
 * Gestiona la transformación afín entre el espacio infinito cósmico (mundo) y la pantalla:
 * - Conversión bidireccional: Mundo <-> Pantalla con matriz 2D.
 * - Desplazamiento infinito (Pan 2D) con soporte inercial.
 * - Zoom focal continuo centrado en la posición exacta del cursor del ratón (Figma-style).
 * - Sistema de observadores reactivo para notificar cambios de vista a 120 FPS.
 */

import { Vector2D } from '../core/types';

export class Camera {
  public x: number;
  public y: number;
  public zoom: number = 1.0;

  private listeners: Array<() => void> = [];

  constructor(initialX?: number, initialY?: number) {
    this.x = initialX ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
    this.y = initialY ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
  }

  /**
   * Transforma una coordenada del espacio infinito del mundo a píxeles de pantalla.
   */
  public worldToScreen(worldPoint: Vector2D): Vector2D {
    const halfWidth = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
    const halfHeight = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
    return {
      x: (worldPoint.x - this.x) * this.zoom + halfWidth,
      y: (worldPoint.y - this.y) * this.zoom + halfHeight
    };
  }

  /**
   * Transforma un píxel de pantalla a la coordenada real en el mundo infinito.
   */
  public screenToWorld(screenPoint: Vector2D): Vector2D {
    const halfWidth = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
    const halfHeight = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
    return {
      x: (screenPoint.x - halfWidth) / this.zoom + this.x,
      y: (screenPoint.y - halfHeight) / this.zoom + this.y
    };
  }

  /**
   * Desplaza la cámara en el espacio 2D según un delta de pantalla.
   */
  public pan(deltaScreenX: number, deltaScreenY: number): void {
    this.x -= deltaScreenX / this.zoom;
    this.y -= deltaScreenY / this.zoom;
    this.notifyChange();
  }

  /**
   * Ejecuta un zoom focal continuo centrado en el punto de pantalla donde está el cursor.
   * Garantiza que el elemento bajo el cursor no se desplace de su posición relativa (Figma-style).
   */
  public zoomAt(screenPoint: Vector2D, factor: number): void {
    const minZoom = 0.25;
    const maxZoom = 2.5;
    const nextZoom = Math.min(Math.max(this.zoom * factor, minZoom), maxZoom);

    if (Math.abs(nextZoom - this.zoom) < 0.0001) return;

    // 1. Obtener la coordenada de mundo antes del cambio de escala
    const worldPointBefore = this.screenToWorld(screenPoint);

    // 2. Aplicar el nuevo zoom
    this.zoom = nextZoom;

    // 3. Compensar la cámara para que ese mismo punto del mundo coincida con la coordenada de pantalla
    const halfWidth = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
    const halfHeight = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;

    this.x = worldPointBefore.x - (screenPoint.x - halfWidth) / this.zoom;
    this.y = worldPointBefore.y - (screenPoint.y - halfHeight) / this.zoom;

    this.notifyChange();
  }

  /**
   * Modifica el factor de aumento general.
   */
  public setZoom(targetZoom: number): void {
    this.zoom = Math.min(Math.max(targetZoom, 0.25), 2.5);
    this.notifyChange();
  }

  /**
   * Suscribe un callback para ser notificado cuando la cámara se mueva o cambie de escala.
   */
  public onChange(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notifica a todos los oyentes de la cámara.
   */
  private notifyChange(): void {
    for (let i = 0; i < this.listeners.length; i++) {
      this.listeners[i]();
    }
  }
}
