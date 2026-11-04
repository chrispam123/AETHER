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
import { StorageManager } from './storage/StorageManager';
import { ExportManager } from './storage/exporters/ExportManager';
import { PortalManager } from './ui/portal/PortalManager';
import { ArchiveDrawer } from './ui/archive/ArchiveDrawer';
import { cognitoAuth, authModal } from './auth';

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
  private cameraStates: Partial<Record<Phase, { x: number; y: number; zoom: number }>> = {};
  private storageManager: StorageManager;
  private portalManager: PortalManager;
  private archiveDrawer: ArchiveDrawer;

  constructor() {
    // 1. Inicialización de Capa 1: Modelo puro de datos
    const initialWidth = window.innerWidth;
    const initialHeight = window.innerHeight;

    this.graph = new DocumentGraph(
      [
        {
          id: '1',
          tag: 'Premisa Inicial',
          text: 'Escribir no es registrar palabras que ya estaban completas en la mente; escribir es el proceso mediante el cual el caos se condensa en materia legible.',
          position: { x: initialWidth * 0.32, y: initialHeight * 0.36 },
          vaporPosition: { x: initialWidth * 0.32, y: initialHeight * 0.36 },
          liquidPosition: { x: initialWidth * 0.32, y: initialHeight * 0.36 },
          timestamp: Date.now() - 3000,
          inDocument: true
        },
        {
          id: '2',
          tag: 'Tensión Dialéctica',
          text: 'Cuando retiramos la tiranía del cursor mecánico y permitimos que la idea respire primero como vapor, luego como corriente viva y finalmente como piedra pulida, la relación entre el creador y su lenguaje vuelve a ser sagrada.',
          position: { x: initialWidth * 0.65, y: initialHeight * 0.42 },
          vaporPosition: { x: initialWidth * 0.65, y: initialHeight * 0.42 },
          liquidPosition: { x: initialWidth * 0.65, y: initialHeight * 0.42 },
          timestamp: Date.now() - 2000,
          inDocument: true
        },
        {
          id: '3',
          tag: 'Síntesis Final',
          text: 'Si el pensamiento pasa de vapor a líquido y a cristal, el software debe obedecer esa física.',
          position: { x: initialWidth * 0.46, y: initialHeight * 0.66 },
          vaporPosition: { x: initialWidth * 0.46, y: initialHeight * 0.66 },
          liquidPosition: { x: initialWidth * 0.46, y: initialHeight * 0.66 },
          timestamp: Date.now() - 1000,
          inDocument: true
        }
      ],
      [
        { id: '1->2', sourceId: '1', targetId: '2', timestamp: Date.now() },
        { id: '2->3', sourceId: '2', targetId: '3', timestamp: Date.now() }
      ]
    );

    let initialPhase: Phase = 'portal';
    try {
      const savedPhase = localStorage.getItem('aether_active_phase') as Phase | null;
      if (savedPhase && (savedPhase === 'vapor' || savedPhase === 'liquid' || savedPhase === 'crystal' || savedPhase === 'portal')) {
        initialPhase = savedPhase;
      }
    } catch {}

    this.stateMachine = new StateMachine(initialPhase);
    document.body.dataset.activePhase = initialPhase;
    // Liberar inmediatamente el seguro temporal de arranque síncrono del HTML
    document.documentElement.removeAttribute('data-initial-phase');

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

    // Visibilidad inicial según la fase síncrona restaurada (evita flash de orbes en F5)
    const isCrystal = initialPhase === 'crystal';
    this.gutter.setVisible(isCrystal);
    this.rawGutter.setVisible(isCrystal);
    this.editor.setVisible(isCrystal);

    if (initialPhase !== 'portal') {
      const portal = document.getElementById('portal-view');
      if (portal) {
        portal.classList.add('hidden');
        portal.style.display = 'none';
        portal.style.pointerEvents = 'none';
        portal.style.opacity = '0';
      }
      this.dock.update(initialPhase);
    }

    // Pilar 2: El Foco Gravitatorio, Hiperfoco Sensorial y Enfoque Monástico (Alt + Z)
    this.focusManager = new FocusManager({ idleDelayMs: 2500 });
    this.focusManager.attach(
      this.editor.getBodyElement(),
      this.editor.getScrollContainer(),
      this.editor.getTitleElement(),
      this.audio
    );
    this.editor.setFocusManager(this.focusManager);

    if (isCrystal) {
      this.focusManager.showPresenceHalo();
      setTimeout(() => this.focusManager.updatePresencePosition(), 50);
    }

    // Pilar 3: Zoom Semántico (Bret Victor) y Dial de Abstracción
    this.zoomController = new SemanticZoomController(this.stateMachine, this.audio);
    this.zoomDial = new ZoomDial(this.zoomController, this.stateMachine);
    this.editor.setSemanticZoomController(this.zoomController);

    // Sistema de Atmósferas Editoriales: Tríptico de luz en las métricas de Cristal
    this.atmosphereSelector = new AtmosphereSelector(this.audio, this.stateMachine);
    const metricsSlot = document.getElementById('metrics-triptych-slot');
    if (metricsSlot) {
      metricsSlot.appendChild(this.atmosphereSelector.getElement());
    }

    this.initPhaseOrchestration();
    this.initAudioButton();
    this.initPortalCards();

    // Capa de Almacenamiento Local-First (IndexedDB y Respaldo Topológico)
    this.storageManager = new StorageManager(
      this.graph,
      this.stateMachine,
      () => this.cameraStates,
      () => this.audio.getCurrentLandscape()?.id || null
    );
    this.storageManager.setEditor(this.editor);
    this.storageManager.setDiscardGutter(this.gutter);

    this.editor.setPressExportHandlers({
      onExportMarkdown: () => this.exportMarkdown(),
      onExportAether: () => this.exportAetherBackup()
    });

    this.portalManager = new PortalManager(
      this.storageManager,
      this.audio,
      async (workId, phase) => this.switchActiveWork(workId, phase),
      async (providedFile?: File) => this.importAetherBackup(providedFile)
    );

    this.archiveDrawer = new ArchiveDrawer(
      this.storageManager,
      this.audio,
      async (workId, phase) => this.switchActiveWork(workId, phase),
      async () => this.portalManager.refresh()
    );

    this.initBrandHomeClick();
    this.initDragAndDrop();
    this.initStorageAutosave();
    this.initStorageShortcuts();
    this.restoreWorkspace();
    this.initAuth();

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
   * Permite la elección deliberada de estado (Niebla, Fluido o Cristal) para la obra activa.
   */
  private initPortalCards(): void {
    const portalCards = document.querySelectorAll('.orb-card');
    portalCards.forEach(card => {
      card.addEventListener('click', async (e) => {
        // Únicamente se permite la selección desde los orbes si estamos en la pantalla inicial de portal
        if (this.stateMachine.getPhase() !== 'portal') {
          e.stopPropagation();
          return;
        }
        const phase = card.getAttribute('data-phase') as Phase;
        if (phase) {
          const selectedWorkId = this.portalManager.getSelectedWorkId();
          await this.openWorkInPhase(selectedWorkId, phase);
        }
      });
    });
  }

  /**
   * Conecta el botón de activación de audio sintético y la firma sonora procedural.
   */
  /**
   * Conecta el motor de autenticación AWS Cognito con Google OAuth (PKCE)
   * y monta el botón de la Bóveda en la cabecera del editor.
   */
  private async initAuth(): Promise<void> {
    await cognitoAuth.init();
    authModal.mountVaultButton();
  }

  private initAudioButton(): void {
    const audioBtn = document.getElementById('audio-btn');
    const audioLabel = document.getElementById('audio-label');
    const crystalTitleEl = document.getElementById('crystal-title');

    if (audioBtn && audioLabel) {
      audioBtn.removeAttribute('title');
      audioBtn.setAttribute('data-aether-tooltip', 'SONIDOS AMBIENTALES');

      audioBtn.addEventListener('click', async () => {
        const state = await this.audio.cycleAtmosphere();
        audioBtn.removeAttribute('title');

        if (state.isPlaying && state.landscape) {
          audioLabel.innerText = state.landscape.label;
          audioBtn.classList.add('is-playing');
          audioBtn.setAttribute('data-aether-tooltip', `ATMÓSFERA: ${state.landscape.label.toUpperCase()}`);
        } else {
          audioLabel.innerText = 'Acústica';
          audioBtn.classList.remove('is-playing');
          audioBtn.setAttribute('data-aether-tooltip', 'SONIDOS AMBIENTALES');
        }
      });
    }

    // Reactividad armónica: Si el usuario escribe o altera el título en Cristal,
    // la atmósfera muta lentamente sin textos ni leyendas distractoras
    if (crystalTitleEl) {
      let titleDebounceTimer: number | null = null;
      crystalTitleEl.addEventListener('input', () => {
        if (!this.audio.isPlayingAtmosphere()) return;
        if (titleDebounceTimer) window.clearTimeout(titleDebounceTimer);
        titleDebounceTimer = window.setTimeout(() => {
          const newTitle = crystalTitleEl.innerText.trim();
          this.audio.updateAtmosphereSeed(newTitle);
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

    let previousPhase = this.stateMachine.getPhase();

    this.stateMachine.onPhaseChange((phase) => {
      // Guardar el encuadre de la cámara (pan y zoom) de la fase anterior
      if (previousPhase === 'vapor' || previousPhase === 'liquid') {
        this.cameraStates[previousPhase] = {
          x: this.camera.x,
          y: this.camera.y,
          zoom: this.camera.zoom
        };
      }

      // 0. TERMODINÁMICA BIDIRECCIONAL (Derretir y Solidificar)
      if (previousPhase === 'crystal' && phase !== 'crystal') {
        // Derretir el Cristal hacia el grafo de ideas (Fluido o Niebla)
        this.editor.syncBlocksWithGraph();
      } else if (previousPhase !== 'crystal' && phase === 'crystal') {
        // Solidificar la Corriente del Río hacia la Prosa de Cristal SOLO si la topología cambió en Fluido
        if (this.graph.hasRiverTopologyChanged()) {
          const ordered = this.graph.getOrderedFlowNodes();
          this.editor.applyFlowOrder(ordered);
          this.graph.resetRiverTopologyChanged();
        }
      }
      previousPhase = phase;
      document.body.dataset.activePhase = phase;
      try {
        localStorage.setItem('aether_active_phase', phase);
      } catch {}

      // 1. Mostrar u ocultar portal
      if (portal) {
        if (phase === 'portal') {
          document.documentElement.removeAttribute('data-initial-phase');
          portal.classList.remove('hidden');
          portal.style.display = 'flex';
          portal.style.pointerEvents = 'auto';
          portal.style.opacity = '1';
          portal.style.visibility = 'visible';
          this.portalManager?.refresh();
        } else {
          portal.classList.add('hidden');
          portal.style.display = 'none';
          portal.style.pointerEvents = 'none';
        }
      }

      // Independencia espacial: restaura la cámara y las posiciones propias de la fase (Niebla vs Fluido)
      if (phase === 'vapor' || phase === 'liquid') {
        const savedCam = this.cameraStates[phase];
        if (savedCam) {
          this.camera.x = savedCam.x;
          this.camera.y = savedCam.y;
          this.camera.zoom = savedCam.zoom;
          this.camera.notifyChange();
        }
        this.graph.syncPositionsForPhase(phase);
      }

      // Despeje de orillas: Si entramos a Fluido, reubica cualquier chispa libre que coincida con el río
      if (phase === 'liquid') {
        this.graph.disperseCollidingSparks();
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
        this.focusManager.exitPinnedFocus();
      }

      // 3. Modulación de atmósfera según la fase (Pureza y Cero Ruido Visual)
      if (hint) {
        hint.classList.remove('visible');
      }

      if (phase === 'vapor') {
        const freeSparks = this.graph.getAllNodes().filter((n) => !n.inDocument);
        if (hint) {
          if (freeSparks.length === 0) {
            hint.innerText = 'Niebla limpia · Haz doble clic en el éter para concebir una chispa libre';
            hint.classList.add('visible');
          } else {
            hint.classList.remove('visible');
          }
        }
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

  /**
   * Restaura la topología y prosa persistidas en IndexedDB al abrir la página.
   */
  private async restoreWorkspace(): Promise<void> {
    try {
      const workspace = await this.storageManager.loadWorkspace();
      if (workspace.hasData) {
        // 1. Restaurar Grafo de Pensamientos
        if (workspace.nodes.length > 0) {
          this.graph.hydrate(workspace.nodes, workspace.bridges);
        }

        // 2. Restaurar Documento Editorial en Cristal
        if (workspace.document) {
          this.editor.hydrateDocument(workspace.document.title, workspace.document.bodyHtml);
        }

        // 2b. Restaurar Descartes en el Margen Izquierdo
        if (workspace.discards && workspace.discards.length > 0) {
          this.gutter.hydrate(workspace.discards);
        }

        // 3. Restaurar Encuadres de Cámara
        if (workspace.state?.cameraStates) {
          this.cameraStates = { ...workspace.state.cameraStates };
        }

        // 4. Bloquear falsos cambios de topología antes de transicionar de fase
        this.graph.resetRiverTopologyChanged();

        // 5. Restaurar Fase Activa (si el usuario ya había salido del Portal)
        if (workspace.state?.activePhase && workspace.state.activePhase !== 'portal') {
          this.stateMachine.transitionTo(workspace.state.activePhase);
          try {
            localStorage.setItem('aether_active_phase', workspace.state.activePhase);
          } catch {}
        }

        // Si la fase activa es Cristal, sincronizar la prosa viva con el grafo
        if (workspace.state?.activePhase === 'crystal') {
          this.editor.syncBlocksWithGraph();
        }

        // Asegurar que la bandera de topología quede en false
        this.graph.resetRiverTopologyChanged();

        // 6. Sincronización de Proyecciones DOM y Márgenes
        this.bridge.sync();
        this.rawGutter.render();
        this.gutter.render();
      }
    } catch (e) {
      console.warn('[Aether] Error al restaurar workspace:', e);
    } finally {
      // Marcar el almacenamiento como completamente hidratado y listo para autosave
      this.storageManager.markHydrated();
      await this.portalManager.refresh();
    }
  }

  /**
   * Conecta los eventos de escritura en tiempo real de Cristal con el debouncer de autosave.
   */
  private initStorageAutosave(): void {
    const crystalTitleEl = document.getElementById('crystal-title');
    const crystalBodyEl = document.querySelector('.crystal-body');

    crystalTitleEl?.addEventListener('input', () => {
      this.storageManager.triggerAutosave();
    });

    crystalBodyEl?.addEventListener('input', () => {
      this.storageManager.triggerAutosave();
    });
  }

  /**
   * Conecta los atajos de teclado para persistencia y respaldo:
   * - Ctrl + S / Cmd + S: Guardado atómico inmediato + chime discreto.
   * - Ctrl + Shift + E: Exportar respaldo topológico (.aether).
   * - Ctrl + Shift + M: Exportar Markdown (.md).
   * - Ctrl + Shift + O: Importar archivo de respaldo (.aether).
   */
  private initStorageShortcuts(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (!modKey) return;

      // 1. Guardar de Inmediato (Ctrl + S)
      if (!e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.storageManager.saveImmediately();
        this.audio.play(528, 'sine', 0.5, 0.1);
        return;
      }

      // 2. Exportar Topología (.aether) (Ctrl + Shift + E)
      if (e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        this.exportAetherBackup();
        return;
      }

      // 3. Exportar Markdown (.md) (Ctrl + Shift + M)
      if (e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        this.exportMarkdown();
        return;
      }

      // 4. Importar Respaldo (.aether) (Ctrl + Shift + O)
      if (e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        this.importAetherBackup();
        return;
      }
    });

    // 5. Invocación y Cierre del Archivo de la Memoria (Alt + O / Esc)
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Invocación explícita con Alt + O: estrictamente limitada al Santuario de Bienvenida (portal)
      if (e.altKey && (e.key === 'o' || e.key === 'O' || e.code === 'KeyO')) {
        if (this.stateMachine.getPhase() !== 'portal') {
          return; // Blindaje cognitivo: nunca interrumpir los flujos de Niebla, Fluido o Cristal
        }
        e.preventDefault();
        this.archiveDrawer.toggle();
        return;
      }

      // Cierre con Escape si el archivo está abierto
      if (e.key === 'Escape' && this.archiveDrawer.isDrawerOpen()) {
        e.preventDefault();
        this.archiveDrawer.close();
        return;
      }
    });
  }

  /**
   * Descarga el respaldo completo en formato .aether.
   */
  public exportAetherBackup(): void {
    const titleEl = document.getElementById('crystal-title');
    const bodyEl = document.querySelector('.crystal-body') as HTMLElement | null;

    ExportManager.exportToAetherFile({
      title: titleEl?.innerText.trim() || 'Sobre la naturaleza del pensamiento',
      bodyHtml: bodyEl?.innerHTML || '',
      bodyText: bodyEl?.innerText || '',
      nodes: this.graph.getAllNodes(),
      bridges: this.graph.getBridges(),
      discards: this.gutter.getItems(),
      activePhase: this.stateMachine.getPhase(),
      cameraStates: this.cameraStates,
      atmosphereLandscapeId: this.audio.getCurrentLandscape()?.id || null
    });
    this.audio.play(640, 'triangle', 0.5, 0.1);
  }

  /**
   * Descarga la prosa limpia en formato Markdown (.md).
   */
  public exportMarkdown(): void {
    const titleEl = document.getElementById('crystal-title');
    const bodyEl = document.querySelector('.crystal-body') as HTMLElement | null;

    ExportManager.exportToMarkdownFile({
      title: titleEl?.innerText.trim() || 'Sobre la naturaleza del pensamiento',
      bodyHtml: bodyEl?.innerHTML || '',
      bodyText: bodyEl?.innerText || '',
      nodesCount: this.graph.getAllNodes().length,
      activePhase: this.stateMachine.getPhase()
    });
    this.audio.play(640, 'triangle', 0.5, 0.1);
  }

  /**
   * Importa y reconstituye en caliente un archivo .aether registrándolo en el catálogo de obras.
   */
  public async importAetherBackup(providedFile?: File): Promise<void> {
    const file = providedFile || await ExportManager.selectFile('.aether');
    if (!file) return;

    try {
      const backup = await ExportManager.parseAetherFile(file);

      // 1. Guardar como obra nueva en el catálogo
      const pkg = await this.storageManager.importWorkPackage(backup);

      // 2. Rehidratar estructuras en memoria
      this.graph.hydrate(pkg.nodes, pkg.bridges);
      this.editor.hydrateDocument(pkg.document.title, pkg.document.bodyHtml);

      if (pkg.discards && Array.isArray(pkg.discards)) {
        this.gutter.hydrate(pkg.discards);
      }

      if (pkg.cameraStates) {
        this.cameraStates = { ...pkg.cameraStates };
      }

      this.graph.resetRiverTopologyChanged();
      this.stateMachine.transitionTo(pkg.activePhase || 'crystal');

      this.bridge.sync();
      this.rawGutter.render();
      this.gutter.render();

      this.audio.play(528, 'sine', 0.8, 0.15);
      await this.portalManager.refresh();
    } catch (err: any) {
      console.error('[Aether Import]:', err);
      alert(err.message || 'Error al importar archivo .aether');
    }
  }

  /**
   * Abre la obra seleccionada directamente en la fase solicitada (Niebla, Fluido o Cristal).
   */
  public async openWorkInPhase(workId: string | null, targetPhase: Phase): Promise<void> {
    try {
      if (workId) {
        const pkg = await this.storageManager.switchWork(workId);
        if (pkg) {
          this.graph.hydrate(pkg.nodes || [], pkg.bridges || []);
          this.editor.hydrateDocument(pkg.document.title, pkg.document.bodyHtml);
          this.gutter.hydrate(pkg.discards || []);

          if (pkg.cameraStates) {
            this.cameraStates = { ...pkg.cameraStates };
          }

          this.graph.resetRiverTopologyChanged();
        }
      }

      this.stateMachine.transitionTo(targetPhase);

      this.bridge.sync();
      this.rawGutter.render();
      this.gutter.render();

      this.audio.play(528, 'sine', 0.5, 0.12);
    } catch (e) {
      console.warn('[Aether] Error al abrir obra en fase:', e);
    }
  }

  /**
   * Cambia la obra activa cargando el paquete correspondiente desde IndexedDB.
   */
  public async switchActiveWork(workId: string, phase?: Phase): Promise<void> {
    const work = this.portalManager.getSelectedWork();
    const targetPhase = phase || work?.activePhase || 'crystal';
    await this.openWorkInPhase(workId, targetPhase);
  }

  /**
   * Conecta el clic en el logotipo "AETHER" para regresar al Santuario de Bienvenida.
   */
  private initBrandHomeClick(): void {
    const brand = document.querySelector('.brand') as HTMLElement | null;
    if (!brand) return;

    brand.addEventListener('click', async (e) => {
      // Si el autor hizo clic en el selector de atmósfera (hijos del brand), no interferir
      if ((e.target as HTMLElement).closest('.atmosphere-selector')) {
        return;
      }

      if (this.stateMachine.getPhase() === 'portal') return;

      // 1. Guardar atómico inmediato de la obra viva (con tolerancia a fallos)
      try {
        await this.storageManager.saveImmediately();
      } catch (err) {
        console.warn('[Aether] Advertencia en autoguardado previo al portal:', err);
      }

      // 2. Transición inmediata al portal
      this.stateMachine.transitionTo('portal');

      // 3. Firma acústica
      this.audio.play(432, 'sine', 0.35, 0.1);

      // 4. Refrescar catálogo
      await this.portalManager.refresh();
    });
  }

  /**
   * Conecta el soporte de arrastrar y soltar (Drag & Drop) universal para archivos .aether.
   */
  private initDragAndDrop(): void {
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.name.endsWith('.aether')) {
          await this.importAetherBackup(file);
        }
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
