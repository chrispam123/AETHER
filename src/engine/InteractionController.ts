/**
 * ============================================================================
 * CAPA 2: CONTROLADOR DE INTERACCIÓN ESPACIAL (INTERACTION CONTROLLER)
 * ============================================================================
 * Implementa la navegación de lienzo infinito al estilo Figma / Miro:
 * - Zoom focal continuo con rueda de ratón o gesto de pinza centrado en el cursor.
 * - Desplazamiento infinito (Pan 2D) con:
 *   1. Arrastre directo en el fondo vacío del lienzo.
 *   2. Barra espaciadora + arrastre con botón izquierdo.
 *   3. Botón central del ratón (rueda pulsada).
 * - Distinción precisa entre clic para crear ideas vs. arrastre para panear (umbral de 4px).
 * - Activo exclusivamente en fases espaciales (Niebla y Fluido).
 */

import { Camera } from './Camera';
import { StateMachine } from '../core/StateMachine';
import { DocumentGraph } from '../core/DocumentGraph';
import { HarmonicSynthesizer } from '../audio/HarmonicSynthesizer';

export class InteractionController {
  private camera: Camera;
  private stateMachine: StateMachine;
  private graph: DocumentGraph;
  private audio: HarmonicSynthesizer;
  private canvas: HTMLCanvasElement;

  private isPanning: boolean = false;
  private isSpacePressed: boolean = false;
  private startPointerX: number = 0;
  private startPointerY: number = 0;
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
  }

  /**
   * Conecta los escuchadores de teclado y puntero para la navegación infinita.
   */
  private bindEvents(): void {
    // 1. Detección de la tecla Espacio para paneo
    window.addEventListener('keydown', (e) => {
      // Si el usuario está tecleando en un input o contenteditable, no interceptar
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
      }

      if (e.code === 'Space' && !this.isSpacePressed) {
        if (!this.isSpatialPhase()) return;
        this.isSpacePressed = true;
        document.body.style.cursor = 'grab';
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        if (!this.isPanning) {
          document.body.style.cursor = '';
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

    // 3. Inicio del arrastre (Pan o Clic en fondo)
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.isSpatialPhase()) return;

      const isMiddleButton = e.button === 1;
      const isLeftButton = e.button === 0;

      if (isMiddleButton || (isLeftButton && (this.isSpacePressed || e.target === this.canvas))) {
        this.isPanning = true;
        this.startPointerX = e.clientX;
        this.startPointerY = e.clientY;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;


        document.body.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });

    // 4. Movimiento durante el arrastre
    window.addEventListener('mousemove', (e) => {
      if (!this.isPanning) return;

      const deltaX = e.clientX - this.lastPointerX;
      const deltaY = e.clientY - this.lastPointerY;


      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      // Desplaza la cámara en el espacio
      this.camera.pan(deltaX, deltaY);
    });

    // 5. Finalización del arrastre o Clic en fondo para crear idea
    window.addEventListener('mouseup', (e) => {
      if (!this.isPanning) return;

      this.isPanning = false;
      document.body.style.cursor = this.isSpacePressed ? 'grab' : '';

      // Si el desplazamiento total fue menor a 5 píxeles y fue botón izquierdo sin barra espaciadora:
      // se interpreta como un clic deliberado en el lienzo para soltar una chispa
      const totalDisplacement = Math.hypot(e.clientX - this.startPointerX, e.clientY - this.startPointerY);
      if (totalDisplacement < 5 && e.button === 0 && !this.isSpacePressed) {
        this.handleCanvasClick(e.clientX, e.clientY);
      }
    });
  }

  /**
   * Crea una nueva idea en las coordenadas universales exactas del mundo cósmico.
   */
  private handleCanvasClick(screenX: number, screenY: number): void {
    const phase = this.stateMachine.getPhase();
    if (phase !== 'vapor' && phase !== 'liquid') return;

    // Conversión matemática de píxeles de pantalla a coordenadas del mundo infinito
    const worldPoint = this.camera.screenToWorld({ x: screenX, y: screenY });

    const tag = phase === 'vapor' ? 'Chispa libre' : 'Corriente nodal';
    this.graph.addNode('', worldPoint, tag);
    this.audio.play(432, 'sine', 0.4, 0.12);
  }

  /**
   * Comprueba si la fase actual es un estado espacial bidimensional.
   */
  private isSpatialPhase(): boolean {
    const phase = this.stateMachine.getPhase();
    return phase === 'vapor' || phase === 'liquid';
  }
}
