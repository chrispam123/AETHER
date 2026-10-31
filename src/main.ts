/**
 * ============================================================================
 * AETHER: PUNTO DE ENTRADA PRINCIPAL (APPLICATION BOOTSTRAP)
 * ============================================================================
 * Inicializa y orquesta todas las capas del sistema:
 * - Capa 1 (Core): Grafo de pensamientos y máquina de estados.
 * - Capa 2 (Engine): Cámara matemática y motor Canvas a 120 FPS.
 * - Capa 3 (UI): Puente de proyección DOM, santuario editorial y dock.
 * - Pilar 2: Foco Gravitatorio e Hiperfoco + Margen de Descartes.
 * - Sistema Sensorial: Síntesis de audio armónico.
 */

import './styles/tokens.css';
import './styles/canvas.css';
import './styles/sanctuary.css';
import './styles/atmospheres.css';
import { AtmosphereSelector } from './ui/dock/AtmosphereSelector';

import { DocumentGraph } from './core/DocumentGraph';
import { StateMachine } from './core/StateMachine';
import { Camera } from './engine/Camera';
import { CanvasRenderer } from './engine/CanvasRenderer';
import { InteractionController } from './engine/InteractionController';
import { HarmonicSynthesizer } from './audio/HarmonicSynthesizer';
import { DomProjectionBridge } from './ui/DomProjectionBridge';
import { EditorialEditor } from './ui/sanctuary/EditorialEditor';
import { PhaseDock } from './ui/dock/PhaseDock';
import { FocusManager } from './ui/focus/FocusManager';
import { DiscardGutter } from './ui/margin/DiscardGutter';
import { RawGutter } from './ui/margin/RawGutter';
import { SemanticZoomController } from './engine/SemanticZoomController';
import { ZoomDial } from './ui/dock/ZoomDial';
import { Phase } from './core/types';

class AetherApp {
  private graph: DocumentGraph;
  private stateMachine: StateMachine;
  private camera: Camera;
  private interactionController: InteractionController;
  private renderer: CanvasRenderer;
  private audio: HarmonicSynthesizer;
  private bridge: DomProjectionBridge;
  private editor: EditorialEditor;
  private dock: PhaseDock;
  private focusManager: FocusManager;
  private gutter: DiscardGutter;
  private rawGutter: RawGutter;
  private zoomController: SemanticZoomController;
  private zoomDial: ZoomDial;
  private atmosphereSelector: AtmosphereSelector;

  constructor() {
    // 1. Inicialización de Capa 1: Modelo puro de datos
    const initialWidth = window.innerWidth;
    const initialHeight = window.innerHeight;

    this.graph = new DocumentGraph(
      [
        {
          id: '1',
          tag: 'Premisa Inicial',
          text: 'El lenguaje no es un inventario estático; es la prótesis viva de la imaginación humana.',
          position: { x: initialWidth * 0.32, y: initialHeight * 0.36 },
          timestamp: Date.now() - 3000
        },
        {
          id: '2',
          tag: 'Tensión Dialéctica',
          text: 'La máquina de escribir nos obligó a pensar en una sola dimensión lineal.',
          position: { x: initialWidth * 0.65, y: initialHeight * 0.42 },
          timestamp: Date.now() - 2000
        },
        {
          id: '3',
          tag: 'Síntesis Final',
          text: 'Si el pensamiento pasa de vapor a líquido y a cristal, el software debe obedecer esa física.',
          position: { x: initialWidth * 0.46, y: initialHeight * 0.66 },
          timestamp: Date.now() - 1000
        }
      ],
      [
        { id: '1->2', sourceId: '1', targetId: '2', timestamp: Date.now() },
        { id: '2->3', sourceId: '2', targetId: '3', timestamp: Date.now() }
      ]
    );

    this.stateMachine = new StateMachine('portal');

    // 2. Inicialización de Capa 2: Motor Gráfico Canvas
    const canvasElement = document.getElementById('canvas-layer') as HTMLCanvasElement;
    this.camera = new Camera();
    this.renderer = new CanvasRenderer(canvasElement, this.camera, this.stateMachine, this.graph);
    this.audio = new HarmonicSynthesizer();
    this.interactionController = new InteractionController(
      canvasElement,
      this.camera,
      this.stateMachine,
      this.graph,
      this.audio
    );

    // 4. Inicialización de Capa 3: Overlay DOM y componentes
    const cardsContainer = document.getElementById('cards-container') as HTMLDivElement;
    this.bridge = new DomProjectionBridge(
      cardsContainer,
      this.camera,
      this.graph,
      this.stateMachine,
      this.audio,
      (stream) => this.renderer.setDragStream(stream)
    );

    this.editor = new EditorialEditor(this.graph, this.audio);
    this.dock = new PhaseDock(this.stateMachine);

    // Pilar 2: El Margen de Descartes (Inercia y Masa del Texto)
    this.gutter = new DiscardGutter(this.audio);
    this.editor.setDiscardGutter(this.gutter);

    // Pilar 1 & 3: El Aljibe de Materia Prima (Vía A: Margen Derecho Simétrico)
    this.rawGutter = new RawGutter(this.graph, this.audio);
    this.editor.setRawGutter(this.rawGutter);

    // Ocultos en el arranque (solo deben despertar al entrar en fase Cristal)
    this.gutter.setVisible(false);
    this.rawGutter.setVisible(false);
    this.editor.setVisible(false);

    // Pilar 2: El Foco Gravitatorio, Hiperfoco Sensorial y Enfoque Monástico (Alt + Z)
    this.focusManager = new FocusManager({ idleDelayMs: 2500 });
    this.focusManager.attach(
      this.editor.getBodyElement(),
      this.editor.getScrollContainer(),
      this.editor.getTitleElement(),
      this.audio
    );
    this.editor.setFocusManager(this.focusManager);

    // Pilar 3: Zoom Semántico (Bret Victor) y Dial de Abstracción
    this.zoomController = new SemanticZoomController(this.stateMachine, this.audio);
    this.zoomDial = new ZoomDial(this.zoomController, this.stateMachine);
    this.editor.setSemanticZoomController(this.zoomController);

    // Sistema de Atmósferas Editoriales: Tríptico de luz en el logo (ATMÓSFERA, AURA, HALO)
    this.atmosphereSelector = new AtmosphereSelector(this.audio, this.stateMachine);
    const brandContainer = document.querySelector('.brand');
    const brandDot = document.getElementById('brand-dot');
    if (brandContainer) {
      // Si estamos en cristal, el tríptico de 3 perlas sustituye armoniosamente al brand-dot único
      brandContainer.insertBefore(this.atmosphereSelector.getElement(), brandDot);
    }

    this.initPhaseOrchestration();
    this.initAudioButton();
    this.initPortalCards();

    // Arranca el bucle a 120 FPS
    this.renderer.start();
  }

  public getZoomDial(): ZoomDial {
    return this.zoomDial;
  }

  public getSemanticZoomController(): SemanticZoomController {
    return this.zoomController;
  }

  public getInteractionController(): InteractionController {
    return this.interactionController;
  }

  /**
   * Conecta los clics de los 3 orbes del portal de bienvenida.
   */
  private initPortalCards(): void {
    const portalCards = document.querySelectorAll('.orb-card');
    portalCards.forEach(card => {
      card.addEventListener('click', (e) => {
        // Únicamente se permite la selección desde los orbes si estamos en la pantalla inicial de portal
        if (this.stateMachine.getPhase() !== 'portal') {
          e.stopPropagation();
          return;
        }
        const phase = card.getAttribute('data-phase') as Phase;
        if (phase) {
          this.stateMachine.transitionTo(phase);
        }
      });
    });
  }

  /**
   * Conecta el botón de activación de audio sintético y la firma sonora procedural.
   */
  private initAudioButton(): void {
    const audioBtn = document.getElementById('audio-btn');
    const audioLabel = document.getElementById('audio-label');
    const crystalTitleEl = document.getElementById('crystal-title');

    if (audioBtn && audioLabel) {
      audioBtn.addEventListener('click', async () => {
        const title = crystalTitleEl?.innerText.trim() || 'AETHER_ORIGIN';
        const isPlaying = await this.audio.toggleAtmosphere(title);

        if (isPlaying) {
          audioLabel.innerText = 'Acústica On';
          audioBtn.classList.add('is-playing');
          audioBtn.style.color = '#e5cb7a';
          audioBtn.style.borderColor = 'rgba(212, 175, 55, 0.4)';
          audioBtn.title = `Firma Sonora viva: "${title}"`;
        } else {
          audioLabel.innerText = 'Acústica';
          audioBtn.classList.remove('is-playing');
          audioBtn.style.color = 'var(--ink-secondary)';
          audioBtn.style.borderColor = 'rgba(255, 255, 255, 0.05)';
          audioBtn.title = 'Resonancia acústica armónica';
        }
      });
    }

    // Reactividad armónica: Si el usuario escribe o altera el título en Cristal,
    // la atmósfera muta lentamente con un crossfade continuo hacia la nueva firma
    if (crystalTitleEl) {
      let titleDebounceTimer: number | null = null;
      crystalTitleEl.addEventListener('input', () => {
        if (!this.audio.isPlayingAtmosphere()) return;
        if (titleDebounceTimer) window.clearTimeout(titleDebounceTimer);
        titleDebounceTimer = window.setTimeout(() => {
          const newTitle = crystalTitleEl.innerText.trim();
          this.audio.updateAtmosphereSeed(newTitle);
          if (audioBtn) {
            audioBtn.title = `Firma Sonora viva: "${newTitle || 'AETHER_ORIGIN'}"`;
          }
        }, 600);
      });
    }
  }

  /**
   * Orquesta las transiciones entre fases (atmósfera, pistas y visibilidad).
   */
  private initPhaseOrchestration(): void {
    const portal = document.getElementById('portal-view');
    const hint = document.getElementById('canvas-hint');
    const brandDot = document.getElementById('brand-dot');
    const brandText = document.getElementById('brand-text');

    this.stateMachine.onPhaseChange((phase) => {
      // 1. Ocultar portal completamente para que no intercepte ningún clic
      if (portal && phase !== 'portal') {
        portal.classList.add('hidden');
        portal.style.display = 'none';
        portal.style.pointerEvents = 'none';
      }
      this.dock.update(phase);
      this.bridge.sync();

      // 2. Actualizar santuario y márgenes en modo Cristal
      this.editor.setVisible(phase === 'crystal');
      this.gutter.setVisible(phase === 'crystal');
      this.rawGutter.setVisible(phase === 'crystal');

      if (phase === 'crystal') {
        this.focusManager.showPresenceHalo();
        setTimeout(() => this.focusManager.updatePresencePosition(), 50);
      } else {
        this.focusManager.hidePresenceHalo();
      }

      // 3. Modulación de atmósfera según la fase (Pureza y Cero Ruido Visual)
      if (hint) {
        hint.classList.remove('visible');
      }

      if (phase === 'vapor') {
        if (brandDot) {
          brandDot.style.display = 'block';
          brandDot.style.background = 'var(--vapor-accent)';
          brandDot.style.boxShadow = '0 0 10px var(--vapor-accent)';
        }
        if (brandText) brandText.innerText = 'AETHER';
        this.audio.play(320, 'sine', 0.8, 0.12);
      } else if (phase === 'liquid') {
        if (brandDot) {
          brandDot.style.display = 'block';
          brandDot.style.background = 'var(--liquid-accent)';
          brandDot.style.boxShadow = '0 0 10px var(--liquid-accent)';
        }
        if (brandText) brandText.innerText = 'AETHER';
        this.audio.play(432, 'triangle', 1.0, 0.15);
      } else if (phase === 'crystal') {
        if (brandDot) {
          // El tríptico de luz asume la presencia en Cristal
          brandDot.style.display = 'none';
        }
        if (brandText) brandText.innerText = 'AETHER';
        this.audio.play(528, 'sine', 1.4, 0.18);
      } else {
        if (brandDot) {
          brandDot.style.display = 'block';
        }
        if (brandText) brandText.innerText = 'AETHER';
      }
    });
  }
}

// Inicialización inmediata de la aplicación evitando retrasos de carga
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => new AetherApp());
} else {
  new AetherApp();
}
