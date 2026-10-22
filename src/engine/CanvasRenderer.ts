/**
 * ============================================================================
 * CAPA 2: MOTOR DE RENDERIZADO PRINCIPAL (CANVAS RENDERER)
 * ============================================================================
 * Orquesta el bucle de animación a 120 FPS.
 * Coordina la cámara, las partículas de polvo, los orbes vivos y los puentes.
 */

import { Camera } from './Camera';
import { AmbientDust } from './AmbientDust';
import { PortalOrbs } from './PortalOrbs';
import { FluidBridges } from './FluidBridges';
import { StateMachine } from '../core/StateMachine';
import { DocumentGraph } from '../core/DocumentGraph';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private dust: AmbientDust;
  private orbs: PortalOrbs;
  private bridges: FluidBridges;
  private stateMachine: StateMachine;
  private graph: DocumentGraph;

  private width: number = 0;
  private height: number = 0;
  private time: number = 0;
  private isRunning: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    camera: Camera,
    stateMachine: StateMachine,
    graph: DocumentGraph
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo inicializar el contexto 2D del Canvas');
    this.ctx = context;

    this.camera = camera;
    this.stateMachine = stateMachine;
    this.graph = graph;

    this.dust = new AmbientDust(55);
    this.orbs = new PortalOrbs();
    this.bridges = new FluidBridges();

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  /**
   * Obtiene la referencia a la cámara espacial del lienzo.
   */
  public getCamera(): Camera {
    return this.camera;
  }

  /**
   * Calibra la resolución del canvas para pantallas Retina / alta densidad (DPI).
   */
  public handleResize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  /**
   * Inicia el bucle continuo de animación sincronizado con el refresco de pantalla.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Pinta el primer fotograma de inmediato (0ms de retraso)
    this.tick();

    const loop = () => {
      if (!this.isRunning) return;
      this.tick();
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  /**
   * Ejecuta un fotograma del motor de renderizado.
   */
  private tick(): void {
    this.time += 0.016;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Dibuja el polvo cósmico ambiental
    this.dust.render(this.ctx, this.width, this.height);

    const phase = this.stateMachine.getPhase();

    // 2. Dibuja los orbes si estamos en el portal de bienvenida
    if (phase === 'portal') {
      this.orbs.render(this.ctx, this.time);
    }

    // 3. Dibuja los puentes de tensión si estamos en estado Fluido
    if (phase === 'liquid') {
      this.bridges.render(this.ctx, this.graph.getAllNodes(), this.time);
    }
  }

  /**
   * Detiene el bucle de renderizado.
   */
  public stop(): void {
    this.isRunning = false;
  }
}
