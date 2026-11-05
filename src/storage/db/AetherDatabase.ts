/**
 * ============================================================================
 * CAPA DE ALMACENAMIENTO: BASE DE DATOS LOCAL-FIRST (INDEXEDDB NATIVA)
 * ============================================================================
 * Implementa el motor transaccional ACID local en el navegador del autor:
 * - 0 ms de latencia: Todo se lee y escribe en disco local asíncronamente.
 * - Sin dependencias externas pesadas (IndexedDB nativa con Promesas).
 * - Stores orientados a la física de Aether:
 *   1. 'documents': Título de la obra, prosa de Cristal y metadatos.
 *   2. 'thought_nodes': Chispas de Niebla y barcas de Fluido con posiciones duales.
 *   3. 'connection_bridges': Corrientes del Río Narrativo (A -> B).
 *   4. 'workspace_state': Fase activa, encuadre de cámara, atmósfera acústica y virutas descartadas.
 */

import { ThoughtNode, ConnectionBridge, Phase, DiscardItem } from '../../core/types';

export interface SavedDocument {
  id: string;
  title: string;
  bodyHtml: string;
  bodyText: string;
  updatedAt: number;
  hasUserEdits?: boolean;
}

export interface SavedWorkspaceState {
  activePhase: Phase;
  cameraStates: Partial<Record<Phase, { x: number; y: number; zoom: number }>>;
  atmosphereLandscapeId?: string | null;
  updatedAt: number;
}

export interface WorkSummary {
  id: string;
  title: string;
  updatedAt: number;
  activePhase: Phase;
  previewText: string;
  nodesCount: number;
  wordCount?: number;
  hiddenFromQuickView?: boolean;
}

export interface WorkPackage {
  id: string;
  title: string;
  updatedAt: number;
  activePhase: Phase;
  document: SavedDocument;
  nodes: ThoughtNode[];
  bridges: ConnectionBridge[];
  discards: DiscardItem[];
  cameraStates?: Partial<Record<Phase, { x: number; y: number; zoom: number }>>;
  atmosphereLandscapeId?: string | null;
  syncedAt?: number;
  syncedChecksum?: string;
  checksum?: string;
  hasUserEdits?: boolean;
  isDirty?: boolean;
}

export class AetherDatabase {
  private static readonly DB_NAME = 'aether_knowledge_v1';
  private static readonly DB_VERSION = 1;

  // Nombres de los Object Stores
  public static readonly STORE_DOCUMENTS = 'documents';
  public static readonly STORE_NODES = 'thought_nodes';
  public static readonly STORE_BRIDGES = 'connection_bridges';
  public static readonly STORE_STATE = 'workspace_state';

  private db: IDBDatabase | null = null;
  private isInitializing: Promise<void> | null = null;

  /**
   * Abre e inicializa la base de datos IndexedDB creando los almacenes de objetos.
   */
  public async init(): Promise<void> {
    if (this.db) return;
    if (this.isInitializing) return this.isInitializing;

    this.isInitializing = new Promise<void>((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('[AetherDB] IndexedDB no está disponible en este entorno.');
        resolve();
        return;
      }

      const request = window.indexedDB.open(
        AetherDatabase.DB_NAME,
        AetherDatabase.DB_VERSION
      );

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Store de Documentos (Clave primaria: 'id')
        if (!db.objectStoreNames.contains(AetherDatabase.STORE_DOCUMENTS)) {
          db.createObjectStore(AetherDatabase.STORE_DOCUMENTS, { keyPath: 'id' });
        }

        // 2. Store de Nodos de Pensamiento (Clave primaria: 'id')
        if (!db.objectStoreNames.contains(AetherDatabase.STORE_NODES)) {
          const nodeStore = db.createObjectStore(AetherDatabase.STORE_NODES, { keyPath: 'id' });
          nodeStore.createIndex('inDocument', 'inDocument', { unique: false });
          nodeStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 3. Store de Puentes y Corrientes (Clave primaria: 'id')
        if (!db.objectStoreNames.contains(AetherDatabase.STORE_BRIDGES)) {
          const bridgeStore = db.createObjectStore(AetherDatabase.STORE_BRIDGES, { keyPath: 'id' });
          bridgeStore.createIndex('sourceId', 'sourceId', { unique: false });
          bridgeStore.createIndex('targetId', 'targetId', { unique: false });
        }

        // 4. Store de Estado Global del Workspace (Clave primaria: 'key')
        if (!db.objectStoreNames.contains(AetherDatabase.STORE_STATE)) {
          db.createObjectStore(AetherDatabase.STORE_STATE, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        console.error('[AetherDB] Error al abrir base de datos:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.isInitializing;
  }

  /**
   * Ejecuta una transacción genérica en un store determinado.
   */
  private async getStore(
    storeName: string,
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBObjectStore | null> {
    await this.init();
    if (!this.db) return null;
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  // ==========================================================================
  // OPERACIONES DE DOCUMENTO (SANTUARIO CRISTAL)
  // ==========================================================================

  public async saveDocument(doc: SavedDocument): Promise<void> {
    const store = await this.getStore(AetherDatabase.STORE_DOCUMENTS, 'readwrite');
    if (!store) return;

    return new Promise((resolve, reject) => {
      const request = store.put(doc);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getDocument(docId: string = 'active_document'): Promise<SavedDocument | null> {
    const store = await this.getStore(AetherDatabase.STORE_DOCUMENTS, 'readonly');
    if (!store) return null;

    return new Promise((resolve, reject) => {
      const request = store.get(docId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================================================
  // OPERACIONES DE NODOS DE PENSAMIENTO (NIEBLA Y FLUIDO)
  // ==========================================================================

  public async saveNodes(nodes: ThoughtNode[]): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(AetherDatabase.STORE_NODES, 'readwrite');
      const store = tx.objectStore(AetherDatabase.STORE_NODES);

      // Limpia la colección anterior e inserta el conjunto completo actual
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        nodes.forEach((node) => {
          store.put(node);
        });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getNodes(): Promise<ThoughtNode[]> {
    const store = await this.getStore(AetherDatabase.STORE_NODES, 'readonly');
    if (!store) return [];

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================================================
  // OPERACIONES DE PUENTES Y RÍO NARRATIVO
  // ==========================================================================

  public async saveBridges(bridges: ConnectionBridge[]): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(AetherDatabase.STORE_BRIDGES, 'readwrite');
      const store = tx.objectStore(AetherDatabase.STORE_BRIDGES);

      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        bridges.forEach((bridge) => {
          store.put(bridge);
        });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getBridges(): Promise<ConnectionBridge[]> {
    const store = await this.getStore(AetherDatabase.STORE_BRIDGES, 'readonly');
    if (!store) return [];

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================================================
  // OPERACIONES DE ESTADO GLOBAL DEL WORKSPACE
  // ==========================================================================

  public async saveWorkspaceState(state: SavedWorkspaceState): Promise<void> {
    const store = await this.getStore(AetherDatabase.STORE_STATE, 'readwrite');
    if (!store) return;

    return new Promise((resolve, reject) => {
      const record = { key: 'global_state', ...state };
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getWorkspaceState(): Promise<SavedWorkspaceState | null> {
    const store = await this.getStore(AetherDatabase.STORE_STATE, 'readonly');
    if (!store) return null;

    return new Promise((resolve, reject) => {
      const request = store.get('global_state');
      request.onsuccess = () => resolve(request.result ? (request.result as SavedWorkspaceState) : null);
      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================================================
  // OPERACIONES DE DESCARTES (DISCARD GUTTER / VIRUTAS DEL MARGEN)
  // ==========================================================================

  public async saveDiscards(discards: DiscardItem[]): Promise<void> {
    const store = await this.getStore(AetherDatabase.STORE_STATE, 'readwrite');
    if (!store) return;

    return new Promise((resolve, reject) => {
      const record = { key: 'discard_items', items: discards, updatedAt: Date.now() };
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getDiscards(): Promise<DiscardItem[]> {
    const store = await this.getStore(AetherDatabase.STORE_STATE, 'readonly');
    if (!store) return [];

    return new Promise((resolve, reject) => {
      const request = store.get('discard_items');
      request.onsuccess = () => {
        const result = request.result;
        resolve(result && Array.isArray(result.items) ? result.items : []);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================================================
  // OPERACIONES DE MULTI-OBRAS Y CATÁLOGO DE PROYECTOS (WORKS CATALOG)
  // ==========================================================================

  public async getActiveWorkId(): Promise<string> {
    const store = await this.getStore(AetherDatabase.STORE_STATE, 'readonly');
    if (!store) return 'default_work';

    return new Promise((resolve) => {
      const request = store.get('active_work_id');
      request.onsuccess = () => {
        resolve(request.result?.value || 'default_work');
      };
      request.onerror = () => resolve('default_work');
    });
  }

  public async setActiveWorkId(workId: string): Promise<void> {
    const store = await this.getStore(AetherDatabase.STORE_STATE, 'readwrite');
    if (!store) return;

    return new Promise((resolve, reject) => {
      const record = { key: 'active_work_id', value: workId, updatedAt: Date.now() };
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getWorksCatalog(): Promise<WorkSummary[]> {
    const store = await this.getStore(AetherDatabase.STORE_STATE, 'readonly');
    if (!store) return [];

    return new Promise((resolve) => {
      const request = store.get('works_catalog');
      request.onsuccess = () => {
        const result = request.result;
        const rawWorks: WorkSummary[] = result && Array.isArray(result.works) ? result.works : [];
        // Normalizar cualquier obra que tuviese 'portal' grabado previamente o falte hiddenFromQuickView
        const normalized = rawWorks.map((w) => ({
          ...w,
          activePhase: (w.activePhase && w.activePhase !== 'portal') ? w.activePhase : ('crystal' as Phase),
          hiddenFromQuickView: !!w.hiddenFromQuickView
        }));
        resolve(normalized);
      };
      request.onerror = () => resolve([]);
    });
  }

  /**
   * Obtiene las últimas N obras visibles en la vista rápida del Santuario (por defecto 5).
   * Excluye las obras que el autor ha decidido retirar de la mesa de trabajo.
   */
  public async getQuickViewWorks(limit: number = 5): Promise<WorkSummary[]> {
    const catalog = await this.getWorksCatalog();
    return catalog.filter((w) => !w.hiddenFromQuickView).slice(0, limit);
  }

  /**
   * Retira una obra de la vista rápida sin destruirla de la base de datos IndexedDB.
   * Esto permite que la siguiente obra en la cola histórica suba automáticamente a la mesa.
   */
  public async hideWorkFromQuickView(workId: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    const catalog = await this.getWorksCatalog();
    const updated = catalog.map((w) => {
      if (w.id === workId) {
        return { ...w, hiddenFromQuickView: true };
      }
      return w;
    });

    const store = await this.getStore(AetherDatabase.STORE_STATE, 'readwrite');
    if (!store) return;

    return new Promise((resolve, reject) => {
      const catRecord = { key: 'works_catalog', works: updated, updatedAt: Date.now() };
      const req = store.put(catRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Restaura una obra retirada a la vista rápida del Santuario.
   */
  public async unhideWorkFromQuickView(workId: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    const catalog = await this.getWorksCatalog();
    const updated = catalog.map((w) => {
      if (w.id === workId) {
        return { ...w, hiddenFromQuickView: false };
      }
      return w;
    });

    const store = await this.getStore(AetherDatabase.STORE_STATE, 'readwrite');
    if (!store) return;

    return new Promise((resolve, reject) => {
      const catRecord = { key: 'works_catalog', works: updated, updatedAt: Date.now() };
      const req = store.put(catRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async saveWorkPackage(pkg: WorkPackage): Promise<void> {
    await this.init();
    if (!this.db) return;

    // 1. Obtener catálogo previo ANTES de abrir la transacción de escritura
    const catalog = await this.getWorksCatalog();
    const cleanTitle = pkg.title.trim() || 'Sobre la naturaleza del pensamiento';
    const text = (pkg.document?.bodyText || '').trim();
    const wordCount = text ? text.split(/\s+/).length : 0;
    const preview = text ? text.substring(0, 100).replace(/\s+/g, ' ').trim() : '';

    // Garantizar que la fase guardada sea siempre una densidad de materia válida (Niebla, Fluido, Cristal)
    const validPhase: Phase =
      (pkg.activePhase && pkg.activePhase !== 'portal')
        ? pkg.activePhase
        : (catalog.find(w => w.id === pkg.id)?.activePhase || 'crystal');

    pkg.activePhase = validPhase;

    const summary: WorkSummary = {
      id: pkg.id,
      title: cleanTitle,
      updatedAt: pkg.updatedAt,
      activePhase: validPhase,
      previewText: preview,
      nodesCount: pkg.nodes.length,
      wordCount,
      hiddenFromQuickView: false // Al editarse y guardarse, se mantiene o reactiva en la vista rápida
    };

    // Actualiza o inserta la obra al inicio
    const filtered = catalog.filter(w => w.id !== pkg.id);
    filtered.unshift(summary);

    // Mantiene una cola profunda de hasta 50 obras en el archivo histórico local
    const trimmed = filtered.slice(0, 50);

    // 2. Abrir la transacción de escritura y persistir el paquete y el catálogo sincrónicamente
    const store = await this.getStore(AetherDatabase.STORE_STATE, 'readwrite');
    if (!store) return;

    return new Promise((resolve, reject) => {
      const record = { key: 'work_pkg_' + pkg.id, package: pkg, updatedAt: Date.now() };
      const catRecord = { key: 'works_catalog', works: trimmed, updatedAt: Date.now() };

      const req1 = store.put(record);
      req1.onerror = () => reject(req1.error);

      const req2 = store.put(catRecord);
      req2.onerror = () => reject(req2.error);
      req2.onsuccess = () => resolve();
    });
  }

  public async loadWorkPackage(workId: string): Promise<WorkPackage | null> {
    const store = await this.getStore(AetherDatabase.STORE_STATE, 'readonly');
    if (!store) return null;

    return new Promise((resolve) => {
      const request = store.get('work_pkg_' + workId);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result && result.package ? (result.package as WorkPackage) : null);
      };
      request.onerror = () => resolve(null);
    });
  }

  public async deleteWork(workId: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    // 1. Obtener catálogo previo ANTES de abrir la transacción
    const catalog = await this.getWorksCatalog();
    const filtered = catalog.filter(w => w.id !== workId);

    // 2. Abrir la transacción y ejecutar eliminación y actualización
    const store = await this.getStore(AetherDatabase.STORE_STATE, 'readwrite');
    if (!store) return;

    return new Promise((resolve, reject) => {
      const req1 = store.delete('work_pkg_' + workId);
      req1.onerror = () => reject(req1.error);

      const req2 = store.put({ key: 'works_catalog', works: filtered, updatedAt: Date.now() });
      req2.onerror = () => reject(req2.error);
      req2.onsuccess = () => resolve();
    });
  }

  /**
   * Limpia toda la base de datos (para reinicio de fábrica o importación limpia).
   */
  public async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(
        [
          AetherDatabase.STORE_DOCUMENTS,
          AetherDatabase.STORE_NODES,
          AetherDatabase.STORE_BRIDGES,
          AetherDatabase.STORE_STATE
        ],
        'readwrite'
      );

      tx.objectStore(AetherDatabase.STORE_DOCUMENTS).clear();
      tx.objectStore(AetherDatabase.STORE_NODES).clear();
      tx.objectStore(AetherDatabase.STORE_BRIDGES).clear();
      tx.objectStore(AetherDatabase.STORE_STATE).clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
