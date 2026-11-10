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
  private lastCognitivePhase: Phase = 'crystal';
  private hasUserEdits: boolean = false;
  private isDirty: boolean = false;
  private isHydrating: boolean = false;
  private currentWorkUpdatedAt: number = Date.now();
  private currentWorkSyncedChecksum: string | null = null;

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
            // Persistencia concedida
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
    this.stateMachine.onPhaseChange((newPhase) => {
      if (newPhase === 'vapor' || newPhase === 'liquid' || newPhase === 'crystal') {
        this.lastCognitivePhase = newPhase;
        // Guardar el estado de la fase en IndexedDB sin ensuciar la fecha de la obra ni marcar dirty
        this.db.saveWorkspaceState({
          activePhase: newPhase,
          cameraStates: this.getCameraStates(),
          atmosphereLandscapeId: this.getAtmosphereId(),
          updatedAt: Date.now()
        }).catch(() => {});
      }
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

  public setHydrating(hydrating: boolean): void {
    this.isHydrating = hydrating;
    if (hydrating) {
      this.cancelAutosave();
    }
  }

  public cancelAutosave(): void {
    if (this.autosaveTimer) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  /**
   * Programa un guardado automático con debounce (400 ms tras el último cambio).
   */
  public triggerAutosave(): void {
    if (!this.isHydrated || this.isHydrating) return;
    this.isDirty = true;
    this.hasUserEdits = true;
    this.currentWorkUpdatedAt = Date.now();

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
    if (!this.isHydrated || this.isSaving || this.stateMachine.getPhase() === 'portal') return;
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

      const title = titleEl ? titleEl.innerText.trim() : 'Guía de Bienvenida a Aether';
      const bodyHtml = bodyEl ? bodyEl.innerHTML : '';
      const bodyText = bodyEl ? bodyEl.innerText : '';

      const docRecord: SavedDocument = {
        id: 'active_document',
        title,
        bodyHtml,
        bodyText,
        updatedAt: this.currentWorkUpdatedAt,
        hasUserEdits: this.hasUserEdits
      };

      // 2. Extraer datos del Grafo (Nodos y Puentes con coordenadas independientes)
      const nodes = this.graph.getAllNodes();
      const bridges = this.graph.getBridges();

      // 3. Extraer estado del Workspace (Fase cognitiva activa, cámara, atmósfera)
      const currentPhase = this.stateMachine.getPhase();
      const cognitivePhase: Phase =
        (currentPhase === 'vapor' || currentPhase === 'liquid' || currentPhase === 'crystal')
          ? currentPhase
          : this.lastCognitivePhase;

      const workspaceRecord: SavedWorkspaceState = {
        activePhase: cognitivePhase,
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
        updatedAt: this.currentWorkUpdatedAt,
        activePhase: cognitivePhase,
        document: docRecord,
        nodes,
        bridges,
        discards,
        cameraStates: this.getCameraStates(),
        atmosphereLandscapeId: this.getAtmosphereId(),
        hasUserEdits: this.hasUserEdits,
        isDirty: this.isDirty,
        syncedChecksum: this.currentWorkSyncedChecksum || undefined
      };

      // 6. Guardado atómico en IndexedDB
      await Promise.all([
        this.db.saveDocument(docRecord),
        this.db.saveNodes(nodes),
        this.db.saveBridges(bridges),
        this.db.saveWorkspaceState(workspaceRecord),
        this.db.saveDiscards(discards)
      ]);

      await this.db.saveWorkPackage(pkg);
      await this.db.setActiveWorkId(this.currentWorkId);
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
        this.currentWorkUpdatedAt = pkg.updatedAt || Date.now();
        this.hasUserEdits = !!pkg.hasUserEdits;
        this.isDirty = pkg.isDirty ?? false;
        this.currentWorkSyncedChecksum = pkg.syncedChecksum || null;
        if (pkg.activePhase && pkg.activePhase !== 'portal') {
          this.lastCognitivePhase = pkg.activePhase;
        }
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
          title: document?.title || 'Guía de Bienvenida a Aether',
          updatedAt: document?.updatedAt || Date.now(),
          activePhase: state?.activePhase || 'crystal',
          document: document || {
            id: 'active_document',
            title: 'Guía de Bienvenida a Aether',
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
        this.currentWorkUpdatedAt = initialPkg.updatedAt;
        this.hasUserEdits = !this.isVirginStarterWork(initialPkg);
        this.isDirty = false;
        initialPkg.hasUserEdits = this.hasUserEdits;
        await this.db.saveWorkPackage(initialPkg);
      } else {
        this.currentWorkUpdatedAt = 0;
        this.hasUserEdits = false;
        this.isDirty = false;
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

  /**
   * Obtiene el paquete íntegro de la obra activa, garantizando persistencia previa.
   */
  public async getActiveWorkPackage(): Promise<WorkPackage | null> {
    await this.saveImmediately();
    await this.db.init();
    return this.db.loadWorkPackage(this.currentWorkId);
  }

  /**
   * Obtiene un paquete de obra por su identificador único.
   */
  public async getWorkPackage(workId: string): Promise<WorkPackage | null> {
    await this.db.init();
    return this.db.loadWorkPackage(workId);
  }

  /**
   * Determina si una obra es la plantilla virgen por defecto (sin escritura del autor).
   */
  public isVirginStarterWork(pkg: WorkPackage | null): boolean {
    if (!pkg) return true;
    // Si la obra ya tiene un checksum de sincronización en la nube, es una obra viva de la Bóveda, NUNCA virgen
    if (pkg.syncedChecksum) return false;
    // Si el autor ha realizado ediciones explícitas o está sucia, NUNCA es virgen
    if (pkg.hasUserEdits || pkg.isDirty) return false;

    const title = (pkg.document?.title || '').trim();
    const text = (pkg.document?.bodyText || '').trim();

    if (text.length === 0) return true;

    const isDefaultTitle =
      title === 'Guía de Bienvenida a Aether' ||
      title === 'Sobre la naturaleza del pensamiento' ||
      title === 'Sin título' ||
      title === '';

    // Firmas de los párrafos iniciales (plantilla histórica y nueva Guía de Bienvenida)
    const hasP1Old = text.includes('Escribir no es registrar palabras que ya estaban completas en la mente');
    const hasP1New = text.includes('Bienvenido a Aether, tu santuario para pensar y estructurar ideas');

    if (isDefaultTitle && (hasP1Old || hasP1New) && !pkg.hasUserEdits) {
      return true;
    }

    return false;
  }

  /**
   * Aplica un WorkPackage descargado de la Bóveda en la base de datos local
   * y, si coincide con la obra activa, actualiza los almacenes primarios.
   */
  public async applyWorkPackageFromCloud(pkg: WorkPackage, isActive: boolean = false): Promise<void> {
    await this.db.init();
    pkg.isDirty = false;
    if (pkg.checksum) {
      pkg.syncedChecksum = pkg.checksum;
    }
    await this.db.saveWorkPackage(pkg);

    if (isActive || pkg.id === this.currentWorkId) {
      this.currentWorkId = pkg.id;
      this.currentWorkUpdatedAt = pkg.updatedAt || Date.now();
      this.hasUserEdits = true;
      this.isDirty = false;
      this.currentWorkSyncedChecksum = pkg.syncedChecksum || null;
      if (pkg.activePhase && pkg.activePhase !== 'portal') {
        this.lastCognitivePhase = pkg.activePhase;
      }
      await Promise.all([
        this.db.saveDocument(pkg.document),
        this.db.saveNodes(pkg.nodes || []),
        this.db.saveBridges(pkg.bridges || []),
        this.db.saveDiscards(pkg.discards || []),
        this.db.setActiveWorkId(pkg.id)
      ]);
    }
  }

  public getIsDirty(): boolean {
    return this.isDirty;
  }

  public markClean(): void {
    this.isDirty = false;
    this.db.getActiveWorkId().then((activeId) => {
      this.db.loadWorkPackage(activeId).then((pkg) => {
        if (pkg && pkg.isDirty) {
          pkg.isDirty = false;
          this.db.saveWorkPackage(pkg);
        }
      });
    }).catch(() => {});
  }

  public markDirty(): void {
    this.isDirty = true;
    this.hasUserEdits = true;
    this.currentWorkUpdatedAt = Date.now();
  }

  public async getWorksCatalog(): Promise<WorkSummary[]> {
    await this.db.init();
    return this.db.getWorksCatalog();
  }

  public async getQuickViewWorks(limit: number = 5): Promise<WorkSummary[]> {
    await this.db.init();
    return this.db.getQuickViewWorks(limit);
  }

  public async hideWorkFromQuickView(workId: string): Promise<void> {
    await this.db.hideWorkFromQuickView(workId);
  }

  public async unhideWorkFromQuickView(workId: string): Promise<void> {
    await this.db.unhideWorkFromQuickView(workId);
  }

  /**
   * Bifurca una obra creando una copia protegida independiente con un nuevo identificador en IndexedDB.
   * Preserva el 100% del texto, nodos y descartes en caso de conflicto concurrente (3-Way Checksum).
   */
  public async forkWorkPackage(pkg: WorkPackage, suffixLabel: string = 'Borrador local'): Promise<WorkPackage> {
    await this.db.init();
    const forkedId = `work_fork_${Date.now()}`;
    const cleanTitle = (pkg.title || '').trim() || 'Guía de Bienvenida a Aether';
    const forkedTitle = `${cleanTitle} (${suffixLabel})`;

    const forkedPkg: WorkPackage = {
      ...JSON.parse(JSON.stringify(pkg)),
      id: forkedId,
      title: forkedTitle,
      updatedAt: Date.now(),
      isDirty: false,
      syncedChecksum: undefined,
      hasUserEdits: true,
      document: {
        ...pkg.document,
        id: forkedId,
        title: forkedTitle,
        updatedAt: Date.now()
      }
    };

    await this.db.saveWorkPackage(forkedPkg);
    return forkedPkg;
  }

  /**
   * Cambia de obra activa guardando previamente la actual.
   */
  public async switchWork(workId: string): Promise<WorkPackage | null> {
    if (this.currentWorkId !== workId && this.stateMachine.getPhase() !== 'portal') {
      await this.saveImmediately();
    }
    const pkg = await this.db.loadWorkPackage(workId);
    if (!pkg) return null;

    this.currentWorkId = workId;
    this.currentWorkUpdatedAt = pkg.updatedAt || Date.now();
    this.hasUserEdits = !!pkg.hasUserEdits;
    this.isDirty = !!pkg.isDirty;
    this.currentWorkSyncedChecksum = pkg.syncedChecksum || null;
    if (pkg.activePhase && pkg.activePhase !== 'portal') {
      this.lastCognitivePhase = pkg.activePhase;
    }
    await this.db.setActiveWorkId(workId);
    return pkg;
  }

  /**
   * Crea una nueva obra virgen en blanco.
   */
  public async createNewWork(initialPhase: Phase = 'crystal'): Promise<WorkPackage> {
    await this.saveImmediately();

    const newId = 'work_' + Date.now();
    const newPkg: WorkPackage = {
      id: newId,
      title: 'Sin título',
      updatedAt: Date.now(),
      activePhase: initialPhase,
      document: {
        id: newId,
        title: 'Sin título',
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
    this.currentWorkUpdatedAt = newPkg.updatedAt;
    this.hasUserEdits = false;
    this.isDirty = false;
    this.currentWorkSyncedChecksum = null;
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
