/**
 * ============================================================================
 * CAPA 2: CONTROLADOR DE INTERACCIÓN ESPACIAL (INTERACTION CONTROLLER)
 * ============================================================================
 * Implementa la navegación ergonómica de lienzo infinito al estilo Miro / Figma:
 * - Cursor artesanal de Mano Cósmica Abierta en el lienzo vacío para denotar espacio navegable.
 * - Cursor artesanal de Mano Cósmica Cerrada durante el arrastre físico.
 * - Desplazamiento (Pan 2D) con un simple clic y arrastre sobre el fondo del lienzo.
 * - Zoom focal continuo centrado en el cursor con la rueda del ratón o trackpad.
 * - CREACIÓN DELIBERADA MEDIANTE DOBLE CLIC en el fondo vacío.
 * - Activo exclusivamente en fases espaciales (Niebla y Fluido).
 */

import { Camera } from './Camera';
import { StateMachine } from '../core/StateMachine';
import { DocumentGraph } from '../core/DocumentGraph';
import { HarmonicSynthesizer } from '../audio/HarmonicSynthesizer';
import { CURSORS } from '../ui/cursors/CursorAssets';

export class InteractionController {
  private camera: Camera;
  private stateMachine: StateMachine;
  private graph: DocumentGraph;
  private audio: HarmonicSynthesizer;
  private canvas: HTMLCanvasElement;

  private isPanning: boolean = false;
  private isSpacePressed: boolean = false;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;

  constructor(
    canvas: HTMLCanvasElement,
    camera: Camera,
    stateMachine: StateMachine,
    graph: DocumentGraph,
    audio: HarmonicSynthesizer
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.stateMachine = stateMachine;
    this.graph = graph;
    this.audio = audio;

    this.bindEvents();
    this.bindPhaseObserver();
  }

  /**
   * Actualiza el cursor visual según la fase activa del editor.
   */
  private bindPhaseObserver(): void {
    this.stateMachine.onPhaseChange((phase) => {
      if (phase === 'vapor' || phase === 'liquid') {
        this.updateCursor(CURSORS.COSMIC_OPEN);
      } else {
        this.updateCursor('');
      }
    });
  }

  /**
   * Conecta los escuchadores de teclado y puntero para la navegación infinita.
   */
  private bindEvents(): void {
    // 1. Detección de la tecla Espacio para paneo explícito
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
      }

      if (e.code === 'Space' && !this.isSpacePressed) {
        if (!this.isSpatialPhase()) return;
        this.isSpacePressed = true;
        this.updateCursor(CURSORS.COSMIC_OPEN);
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        if (!this.isPanning && this.isSpatialPhase()) {
          this.updateCursor(CURSORS.COSMIC_OPEN);
        }
      }
    });

    // 2. Zoom focal continuo con rueda del ratón (Figma-style)
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.isSpatialPhase()) return;

        // Evita el scroll predeterminado de la página
        e.preventDefault();

        const screenPoint = { x: e.clientX, y: e.clientY };

        // Si se mantiene Shift, panear horizontalmente
        if (e.shiftKey) {
          this.camera.pan(-e.deltaY, 0);
          return;
        }

        // Si se pulsa con dos dedos en trackpad (con componente X) y sin Ctrl, panear en 2D
        if (Math.abs(e.deltaX) > 0 && !e.ctrlKey) {
          this.camera.pan(-e.deltaX, -e.deltaY);
          return;
        }

        // Zoom focal: rueda arriba acerca (zoom in), rueda abajo aleja (zoom out)
        const zoomDelta = -e.deltaY;
        const factor = zoomDelta > 0 ? 1.09 : 0.91;
        this.camera.zoomAt(screenPoint, factor);
      },
      { passive: false }
    );

    // 3. Inicio del arrastre (Pan 2D) con Mano Cósmica Cerrada
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.isSpatialPhase()) return;

      const isMiddleButton = e.button === 1;
      const isLeftButton = e.button === 0;

      if (isMiddleButton || (isLeftButton && (this.isSpacePressed || e.target === this.canvas))) {
        this.isPanning = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;

        this.updateCursor(CURSORS.COSMIC_CLOSED);
        e.preventDefault();
      }
    });

    // 4. Movimiento durante el arrastre a 120 FPS
    window.addEventListener('mousemove', (e) => {
      if (!this.isPanning) return;

      const deltaX = e.clientX - this.lastPointerX;
      const deltaY = e.clientY - this.lastPointerY;

      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      // Desplaza la cámara en el espacio cósmico
      this.camera.pan(deltaX, deltaY);
    });

    // 5. Finalización del arrastre: restaura la mano cósmica abierta
    window.addEventListener('mouseup', () => {
      if (!this.isPanning) return;

      this.isPanning = false;
      if (this.isSpatialPhase()) {
        this.updateCursor(CURSORS.COSMIC_OPEN);
      } else {
        this.updateCursor('');
      }
    });

    // 6. CREACIÓN INTENCIONAL MEDIANTE DOBLE CLIC EN EL FONDO VACÍO
    this.canvas.addEventListener('dblclick', (e) => {
      if (!this.isSpatialPhase()) return;

      // Conversión matemática de píxeles de pantalla a coordenadas del mundo infinito
      const worldPoint = this.camera.screenToWorld({ x: e.clientX, y: e.clientY });

      const phase = this.stateMachine.getPhase();
      const tag = phase === 'vapor' ? 'Chispa libre' : 'Corriente nodal';
      this.graph.addNode('', worldPoint, tag);
      this.audio.play(432, 'sine', 0.4, 0.12);
    });
  }

  /**
   * Actualiza el cursor visual de la ventana y el canvas de manera coherente.
   */
  private updateCursor(cursor: string): void {
    this.canvas.style.cursor = cursor;
    document.body.style.cursor = cursor;
  }

  /**
   * Comprueba si la fase actual es un estado espacial bidimensional.
   */
  private isSpatialPhase(): boolean {
    const phase = this.stateMachine.getPhase();
    return phase === 'vapor' || phase === 'liquid';
  }
}
