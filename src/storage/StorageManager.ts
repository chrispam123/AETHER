/**
 * ============================================================================
 * CAPA DE ALMACENAMIENTO: ORQUESTADOR DE PERSISTENCIA (STORAGE MANAGER)
 * ============================================================================
 * Coordina la persistencia reactiva en tiempo real entre la memoria y el disco:
 * - Autosave no intrusivo con debounce inteligente (400 ms).
 * - Protección del ciclo de vida del navegador (beforeunload y visibilitychange).
 * - Solicitud de persistencia blindada (navigator.storage.persist).
 * - Restauración holística del espacio de trabajo al iniciar la aplicación.
 * - Soporte total para el Margen de Descartes (virutas podadas pero preservadas).
 */

import { DocumentGraph } from '../core/DocumentGraph';
import { StateMachine } from '../core/StateMachine';
import { EditorialEditor } from '../ui/sanctuary/EditorialEditor';
import { DiscardGutter } from '../ui/margin/DiscardGutter';
import { AetherDatabase, SavedDocument, SavedWorkspaceState, WorkSummary, WorkPackage } from './db/AetherDatabase';
import { Phase, ThoughtNode, ConnectionBridge, DiscardItem } from '../core/types';
import { AetherTopologyBackup } from './exporters/ExportManager';

export interface LoadedWorkspace {
  hasData: boolean;
  document: SavedDocument | null;
  nodes: ThoughtNode[];
  bridges: ConnectionBridge[];
  state: SavedWorkspaceState | null;
  discards: DiscardItem[];
}

export class StorageManager {
  private db: AetherDatabase;
  private graph: DocumentGraph;
  private stateMachine: StateMachine;
  private editor: EditorialEditor | null = null;
  private gutter: DiscardGutter | null = null;
  private getCameraStates: () => Partial<Record<Phase, { x: number; y: number; zoom: number }>>;
  private getAtmosphereId: () => string | null;

  private autosaveTimer: number | null = null;
  private readonly DEBOUNCE_DELAY_MS = 400;
  private isSaving: boolean = false;
  private isHydrated: boolean = false;
  private currentWorkId: string = 'default_work';

  constructor(
    graph: DocumentGraph,
    stateMachine: StateMachine,
    getCameraStates: () => Partial<Record<Phase, { x: number; y: number; zoom: number }>>,
    getAtmosphereId: () => string | null
  ) {
    this.db = new AetherDatabase();
    this.graph = graph;
    this.stateMachine = stateMachine;
    this.getCameraStates = getCameraStates;
    this.getAtmosphereId = getAtmosphereId;

    this.initStorageProtection();
    this.bindReactiveListeners();
    this.bindLifecycleListeners();
  }

  public setEditor(editor: EditorialEditor): void {
    this.editor = editor;
  }

  public setDiscardGutter(gutter: DiscardGutter): void {
    this.gutter = gutter;
    this.gutter.onChange(() => {
      this.triggerAutosave();
    });
  }

  /**
   * Marca el almacenamiento como hidratado y listo para autosave.
   * Impide que el autosave se active durante la carga inicial o sobreescriba datos con el DOM estático.
   */
  public markHydrated(): void {
    this.isHydrated = true;
  }

  /**
   * Solicita al navegador marcar la base de datos como Persistente (intocable para el SO).
   */
  private async initStorageProtection(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persisted();
        if (!isPersisted) {
          const granted = await navigator.storage.persist();
          if (granted) {
            console.log('[Aether Storage] Persistencia blindada concedida por el navegador.');
          }
        }
      }
    } catch {
      // Manejo silencioso en navegadores sin soporte
    }
  }

  /**
   * Conecta observadores reactivos para activar el guardado automático cuando algo cambia.
   */
  private bindReactiveListeners(): void {
    // 1. Reactividad ante cambios en el grafo de ideas o conexiones
    this.graph.subscribe(() => {
      this.triggerAutosave();
    });

    // 2. Reactividad ante cambios de fase (Niebla <-> Fluido <-> Cristal)
    this.stateMachine.onPhaseChange(() => {
      this.triggerAutosave();
    });
  }

  /**
   * Conecta eventos críticos del sistema operativo para salvar datos antes de que la pestaña muera.
   */
  private bindLifecycleListeners(): void {
    if (typeof window === 'undefined') return;

    // Al minimizar la ventana o cambiar de aplicación
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.saveImmediately();
      }
    });

    // Al cerrar la pestaña o recargar
    window.addEventListener('beforeunload', () => {
      this.saveImmediately();
    });
  }

  /**
   * Programa un guardado automático con debounce (400 ms tras el último cambio).
   */
  public triggerAutosave(): void {
    if (!this.isHydrated) return;

    if (this.autosaveTimer) {
      window.clearTimeout(this.autosaveTimer);
    }

    this.autosaveTimer = window.setTimeout(() => {
      this.saveImmediately();
    }, this.DEBOUNCE_DELAY_MS);
  }

  /**
   * Ejecuta el guardado atómico inmediato en IndexedDB en un hilo secundario asíncrono.
   */
  public async saveImmediately(): Promise<void> {
    if (!this.isHydrated || this.isSaving) return;
    this.isSaving = true;

    try {
      await this.db.init();

      // Si estamos en fase Cristal, sincronizamos los bloques del documento con el grafo antes de persistir
      if (this.stateMachine.getPhase() === 'crystal' && this.editor) {
        this.editor.syncBlocksWithGraph();
        this.graph.resetRiverTopologyChanged();
      }

      // 1. Extraer datos de Cristal
      const titleEl = this.editor?.getTitleElement() || document.getElementById('crystal-title');
      const bodyEl = this.editor?.getBodyElement() || (document.querySelector('.crystal-body') as HTMLElement | null);

      const title = titleEl ? titleEl.innerText.trim() : 'Sobre la naturaleza del pensamiento';
      const bodyHtml = bodyEl ? bodyEl.innerHTML : '';
      const bodyText = bodyEl ? bodyEl.innerText : '';

      const docRecord: SavedDocument = {
        id: 'active_document',
        title,
        bodyHtml,
        bodyText,
        updatedAt: Date.now()
      };

      // 2. Extraer datos del Grafo (Nodos y Puentes con coordenadas independientes)
      const nodes = this.graph.getAllNodes();
      const bridges = this.graph.getBridges();

      // 3. Extraer estado del Workspace (Fase activa, cámara, atmósfera)
      const workspaceRecord: SavedWorkspaceState = {
        activePhase: this.stateMachine.getPhase(),
        cameraStates: this.getCameraStates(),
        atmosphereLandscapeId: this.getAtmosphereId(),
        updatedAt: Date.now()
      };

      // 4. Extraer Descartes (virutas del margen izquierdo de Cristal)
      const discards = this.gutter ? this.gutter.getItems() : [];

      // 5. Construir paquete integral de la obra para el catálogo multiobra
      const pkg: WorkPackage = {
        id: this.currentWorkId,
        title,
        updatedAt: Date.now(),
        activePhase: this.stateMachine.getPhase(),
        document: docRecord,
        nodes,
        bridges,
        discards,
        cameraStates: this.getCameraStates(),
        atmosphereLandscapeId: this.getAtmosphereId()
      };

      // 6. Guardado atómico en paralelo en IndexedDB
      await Promise.all([
        this.db.saveDocument(docRecord),
        this.db.saveNodes(nodes),
        this.db.saveBridges(bridges),
        this.db.saveWorkspaceState(workspaceRecord),
        this.db.saveDiscards(discards),
        this.db.saveWorkPackage(pkg),
        this.db.setActiveWorkId(this.currentWorkId)
      ]);
    } catch (e) {
      console.warn('[Aether Storage] Error durante guardado atómico:', e);
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Carga y restaura el espacio de trabajo completo desde la base de datos local.
   */
  public async loadWorkspace(): Promise<LoadedWorkspace> {
    try {
      await this.db.init();

      // Recuperar el identificador de la obra activa
      const activeId = await this.db.getActiveWorkId();
      this.currentWorkId = activeId;

      // Intentar cargar la obra empaquetada
      const pkg = await this.db.loadWorkPackage(activeId);
      if (pkg) {
        return {
          hasData: true,
          document: pkg.document,
          nodes: pkg.nodes || [],
          bridges: pkg.bridges || [],
          state: {
            activePhase: pkg.activePhase,
            cameraStates: pkg.cameraStates || {},
            atmosphereLandscapeId: pkg.atmosphereLandscapeId,
            updatedAt: pkg.updatedAt
          },
          discards: pkg.discards || []
        };
      }

      // Compatibilidad con almacenes legacy previos
      const [document, nodes, bridges, state, discards] = await Promise.all([
        this.db.getDocument('active_document'),
        this.db.getNodes(),
        this.db.getBridges(),
        this.db.getWorkspaceState(),
        this.db.getDiscards()
      ]);

      const hasData = (nodes && nodes.length > 0) || 
                      (document && document.bodyText.trim().length > 0) ||
                      (discards && discards.length > 0);

      if (hasData) {
        const initialPkg: WorkPackage = {
          id: this.currentWorkId,
          title: document?.title || 'Sobre la naturaleza del pensamiento',
          updatedAt: document?.updatedAt || Date.now(),
          activePhase: state?.activePhase || 'crystal',
          document: document || {
            id: 'active_document',
            title: 'Sobre la naturaleza del pensamiento',
            bodyHtml: '',
            bodyText: '',
            updatedAt: Date.now()
          },
          nodes: nodes || [],
          bridges: bridges || [],
          discards: discards || [],
          cameraStates: state?.cameraStates || {},
          atmosphereLandscapeId: state?.atmosphereLandscapeId || null
        };
        await this.db.saveWorkPackage(initialPkg);
      }

      return {
        hasData: !!hasData,
        document,
        nodes: nodes || [],
        bridges: bridges || [],
        state,
        discards: discards || []
      };
    } catch (e) {
      console.warn('[Aether Storage] Error al cargar workspace desde IndexedDB:', e);
      return {
        hasData: false,
        document: null,
        nodes: [],
        bridges: [],
        state: null,
        discards: []
      };
    }
  }

  // ==========================================================================
  // GESTIÓN MULTI-OBRA Y SANTUARIO DE BIENVENIDA
  // ==========================================================================

  public getCurrentWorkId(): string {
    return this.currentWorkId;
  }

  public async getWorksCatalog(): Promise<WorkSummary[]> {
    await this.db.init();
    return this.db.getWorksCatalog();
  }

  /**
   * Cambia de obra activa guardando previamente la actual.
   */
  public async switchWork(workId: string): Promise<WorkPackage | null> {
    await this.saveImmediately();
    const pkg = await this.db.loadWorkPackage(workId);
    if (!pkg) return null;

    this.currentWorkId = workId;
    await this.db.setActiveWorkId(workId);
    return pkg;
  }

  /**
   * Crea una nueva obra virgen en blanco.
   */
  public async createNewWork(initialPhase: Phase = 'vapor'): Promise<WorkPackage> {
    await this.saveImmediately();

    const newId = 'work_' + Date.now();
    const newPkg: WorkPackage = {
      id: newId,
      title: 'Sobre la naturaleza del pensamiento',
      updatedAt: Date.now(),
      activePhase: initialPhase,
      document: {
        id: newId,
        title: 'Sobre la naturaleza del pensamiento',
        bodyHtml: '',
        bodyText: '',
        updatedAt: Date.now()
      },
      nodes: [],
      bridges: [],
      discards: [],
      cameraStates: {},
      atmosphereLandscapeId: null
    };

    this.currentWorkId = newId;
    await this.db.saveWorkPackage(newPkg);
    await this.db.setActiveWorkId(newId);
    return newPkg;
  }

  /**
   * Importa un archivo .aether registrándolo como una obra nueva en el catálogo.
   */
  public async importWorkPackage(backup: AetherTopologyBackup): Promise<WorkPackage> {
    await this.saveImmediately();

    const newId = 'work_' + Date.now();
    const title = backup.document.title?.trim() || 'Obra importada';

    const pkg: WorkPackage = {
      id: newId,
      title,
      updatedAt: Date.now(),
      activePhase: backup.workspace.activePhase || 'crystal',
      document: {
        id: newId,
        title,
        bodyHtml: backup.document.bodyHtml || '',
        bodyText: backup.document.bodyText || '',
        updatedAt: Date.now()
      },
      nodes: backup.nodes || [],
      bridges: backup.bridges || [],
      discards: backup.discards || [],
      cameraStates: backup.workspace.cameraStates || {},
      atmosphereLandscapeId: backup.workspace.atmosphereLandscapeId || null
    };

    this.currentWorkId = newId;
    await this.db.saveWorkPackage(pkg);
    await this.db.setActiveWorkId(newId);
    return pkg;
  }

  /**
   * Elimina una obra del catálogo.
   */
  public async deleteWork(workId: string): Promise<void> {
    await this.db.deleteWork(workId);
  }

  /**
   * Restablece el almacenamiento a cero (para pruebas o importación limpia).
   */
  public async clearAll(): Promise<void> {
    await this.db.clearAll();
  }
}
