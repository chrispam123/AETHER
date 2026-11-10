/**
 * ==============================================================================
 * AETHER — GESTOR DE SINCRONIZACIÓN DE BÓVEDA (CLOUDSYNCMANAGER)
 * ==============================================================================
 * Conecta la arquitectura Local-First soberana con AWS España (eu-south-2):
 * - Sincronización BIDIRECCIONAL automática (Pull & Push inteligente).
 * - Detección de cambios entre dispositivos mediante marcas temporales, flags de autoría y checksum SHA-256.
 * - Rehidratación en vivo de la obra activa al detectar versiones más recientes en la nube.
 * - Sube y descarga archivos .aether cifrados en S3 privado mediante Presigned URLs.
 * - Catálogo atómico en DynamoDB (eu-south-2).
 * ==============================================================================
 */

import { cognitoAuth } from '../auth/CognitoAuthService';
import type { StorageManager } from '../storage/StorageManager';
import type { WorkPackage } from '../storage/db/AetherDatabase';
import type { HarmonicSynthesizer } from '../audio/HarmonicSynthesizer';
import type {
  SyncStatus,
  RemoteWorkMetadata,
  SyncInitResponse,
  SyncDownloadResponse,
  VaultWorksListResponse,
  SyncStatusListener
} from './types';

export class CloudSyncManager {
  private static instance: CloudSyncManager;

  private storageManager: StorageManager | null = null;
  private audio: HarmonicSynthesizer | null = null;

  private status: SyncStatus = 'offline';
  private lastSyncedAt: number | null = null;
  private lastError: string | null = null;
  private listeners: Set<SyncStatusListener> = new Set();
  private idleResetTimer: number | null = null;
  private onWorkHydratedCallback: ((pkg: WorkPackage) => void) | null = null;

  // Normalización estricta de la URL base para evitar dobles barras ('//vault/works')
  private readonly apiUrl: string =
    ((import.meta as any).env?.VITE_VAULT_API_URL ||
    'https://npfw7ws25i.execute-api.eu-south-2.amazonaws.com').replace(/\/+$/, '');

  private constructor() {}

  /**
   * Log de depuración condicional: Silencioso por defecto en producción.
   * Se activa únicamente si el desarrollador escribe en consola:
   * localStorage.setItem('aether_debug', 'true')
   */
  private log(...args: any[]): void {
    if (typeof window !== 'undefined' && window.localStorage?.getItem('aether_debug') === 'true') {
      console.log(...args);
    }
  }

  public static getInstance(): CloudSyncManager {
    if (!CloudSyncManager.instance) {
      CloudSyncManager.instance = new CloudSyncManager();
    }
    return CloudSyncManager.instance;
  }

  private onNotificationCallback: ((message: string) => void) | null = null;

  /**
   * Conecta el callback para rehidratar la UI cuando la nube descarga una versión más fresca.
   */
  public setOnWorkHydrated(callback: (pkg: WorkPackage) => void): void {
    this.onWorkHydratedCallback = callback;
  }

  /**
   * Conecta el callback para emitir avisos discretos al autor (toasts serenos).
   */
  public setOnNotification(callback: (message: string) => void): void {
    this.onNotificationCallback = callback;
  }

  public notifyUser(message: string): void {
    if (this.onNotificationCallback) {
      this.onNotificationCallback(message);
    }
  }

  /**
   * Inicializa el gestor vinculando el StorageManager, audio y escuchando el estado de autenticación.
   */
  public init(storageManager: StorageManager, audio?: HarmonicSynthesizer): void {
    this.storageManager = storageManager;
    if (audio) this.audio = audio;

    // Escuchar cambios de sesión de Cognito
    cognitoAuth.onAuthStateChanged((authState) => {
      if (authState.status === 'authenticated' && authState.author) {
        if (this.status === 'offline') {
          this.setStatus('idle');
        }
        this.log('[Aether Vault] 🔑 Autor autenticado detectado. Iniciando sincronización de Bóveda...');
        this.syncVault();
      } else if (authState.status === 'unauthenticated') {
        this.setStatus('offline');
      }
    });

    // Si ya está autenticado al inicializar, pasar a idle y sincronizar
    if (cognitoAuth.isAuthenticated()) {
      this.setStatus('idle');
      this.log('[Aether Vault] ⚡ Sesión activa restaurada. Comprobando Bóveda...');
      this.syncVault();
    }
  }

  // ============================================================================
  // SINCRONIZACIÓN BIDIRECCIONAL HOLÍSTICA (PULL & PUSH)
  // ============================================================================

  /**
   * Ejecuta la sincronización bidireccional completa:
   * 1. Consulta el catálogo remoto de DynamoDB en AWS España.
   * 2. Si la copia remota es más nueva o el dispositivo local tiene la plantilla virgen, descarga y rehidrata.
   * 3. Si el dispositivo local tiene ediciones reales del usuario más nuevas, sube a S3 y DynamoDB.
   */
  public async syncVault(): Promise<boolean> {
    if (!cognitoAuth.isAuthenticated()) {
      this.setStatus('offline', 'Autor no autenticado');
      return false;
    }

    if (!this.storageManager) {
      this.setStatus('error', 'StorageManager no conectado');
      return false;
    }

    if (this.status === 'syncing') {
      console.warn('[Aether Vault] Sincronización en curso, omitiendo solicitud redundante.');
      return false;
    }

    this.setStatus('syncing', 'Sincronizando con AWS España (eu-south-2)...');
    this.log('[Aether Vault] 📡 Iniciando sincronización bidireccional...');

    try {
      // 1. Obtener token JWT de Cognito (renovar silenciosamente si es necesario)
      let idToken = cognitoAuth.getIdToken();
      if (!idToken) {
        const refreshed = await cognitoAuth.refreshTokens();
        if (refreshed) {
          idToken = cognitoAuth.getIdToken();
        }
      }

      if (!idToken) {
        throw new Error('Sesión expirada o token ausente. Por favor, reautentica tu cuenta.');
      }

      // 2. Persistir inmediatamente el estado en memoria para tener datos frescos
      await this.storageManager.saveImmediately();

      // 3. Consultar el catálogo remoto de la Bóveda en DynamoDB
      this.log('[Aether Vault] 🔍 Consultando catálogo en DynamoDB...');
      const remoteWorks = await this.listRemoteWorks();
      this.log(`[Aether Vault] 📚 Obras encontradas en la Bóveda: ${remoteWorks.length}`);

      // 4. Obtener estado de la obra activa local
      const currentWorkId = this.storageManager.getCurrentWorkId();
      const activeLocalPkg = await this.storageManager.getActiveWorkPackage();
      const localScreenIsVirgin = this.storageManager.isVirginStarterWork(activeLocalPkg);

      // 5. Procesar obras existentes en la nube
      const processedRemoteIds = new Set<string>();

      if (remoteWorks.length > 0) {
        // Ordenar obras remotas por fecha de actualización descendente
        const sortedRemote = [...remoteWorks].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        for (const remote of sortedRemote) {
          processedRemoteIds.add(remote.workId);

          const localPkg = await this.storageManager.getWorkPackage(remote.workId);
          const isActive =
            remote.workId === currentWorkId ||
            (localScreenIsVirgin && currentWorkId === 'default_work');

          // Caso A: La obra no existe localmente en este dispositivo
          if (!localPkg) {
            this.log(`[Aether Vault] ⤓ Obra remota no presente localmente: "${remote.title}" (${remote.workId}). Descargando...`);
            const downloaded = await this.downloadRemoteWork(remote.workId, remote.checksum);
            if (downloaded) {
              await this.storageManager.applyWorkPackageFromCloud(downloaded, isActive);
              if (isActive && this.onWorkHydratedCallback) {
                this.onWorkHydratedCallback(downloaded);
              }
              this.storageManager.markClean();
            }
            continue;
          }

          // Caso B: La obra existe en ambos lados. Calculamos el hash de contenido real determinista
          const localChecksum = await this.calculateWorkChecksum(localPkg);
          const localSyncedChecksum = localPkg.syncedChecksum || null;
          const remoteChecksum = remote.checksum || '';
          const localIsVirgin = this.storageManager.isVirginStarterWork(localPkg);

          this.log(`[Aether Vault] ⚖ Comparando "${localPkg.title}" (${localPkg.id}): local=${localChecksum.slice(0, 8)}, synced=${localSyncedChecksum?.slice(0, 8) || 'none'}, remote=${remoteChecksum.slice(0, 8)}`);

          // Sub-caso B.1: Armonía total (el contenido es idéntico)
          if (localChecksum === remoteChecksum) {
            this.log(`[Aether Vault] ☯ "${localPkg.title}" está en total armonía.`);
            if (localPkg.syncedChecksum !== remoteChecksum) {
              localPkg.syncedChecksum = remoteChecksum;
              localPkg.checksum = remoteChecksum;
              localPkg.isDirty = false;
              await this.storageManager.applyWorkPackageFromCloud(localPkg, false);
            }
            continue;
          }

          // Sub-caso B.2: Plantilla virgen local sin sincronizar
          if (localIsVirgin && !localSyncedChecksum) {
            this.log(`[Aether Vault] ⤓ Reemplazando plantilla virgen con obra real de la nube: "${remote.title}"...`);
            const downloaded = await this.downloadRemoteWork(remote.workId, remote.checksum);
            if (downloaded) {
              await this.storageManager.applyWorkPackageFromCloud(downloaded, isActive);
              if (isActive && this.onWorkHydratedCallback) {
                this.onWorkHydratedCallback(downloaded);
              }
              this.storageManager.markClean();
            }
            continue;
          }

          // Sub-caso B.3: Fast-Forward Push
          // La nube NO ha cambiado desde que este dispositivo sincronizó (remote.checksum === localSyncedChecksum),
          // pero este dispositivo SÍ tiene cambios (localChecksum !== localSyncedChecksum).
          const cloudUnchangedFromBase = Boolean(localSyncedChecksum && remoteChecksum === localSyncedChecksum);
          const localHasEdits = localChecksum !== localSyncedChecksum;

          if (cloudUnchangedFromBase && localHasEdits) {
            this.log(`[Aether Vault] ⇪ Fast-Forward Push: Subiendo cambios locales de "${localPkg.title}" a la nube...`);
            await this.uploadWorkPackage(localPkg, idToken);
            continue;
          }

          // Sub-caso B.4: Fast-Forward Pull
          // Este dispositivo NO ha realizado cambios desde la última base (localChecksum === localSyncedChecksum),
          // pero la nube SÍ tiene cambios nuevos de otro equipo (remoteChecksum !== localSyncedChecksum).
          const localUnchangedFromBase = Boolean(localSyncedChecksum && localChecksum === localSyncedChecksum);
          const cloudHasEdits = remoteChecksum !== localSyncedChecksum;

          if (localUnchangedFromBase && cloudHasEdits) {
            this.log(`[Aether Vault] ⤓ Fast-Forward Pull: Descargando versión más reciente de "${remote.title}"...`);
            const downloaded = await this.downloadRemoteWork(remote.workId, remote.checksum);
            if (downloaded) {
              await this.storageManager.applyWorkPackageFromCloud(downloaded, isActive);
              if (isActive && this.onWorkHydratedCallback) {
                this.onWorkHydratedCallback(downloaded);
              }
              this.storageManager.markClean();
            }
            continue;
          }

          // Sub-caso B.5: Divergencia concurrente (Ambos modificaron respecto a la base, o no hay base común)
          const localTime = localPkg.updatedAt || 0;
          const remoteTime = remote.updatedAt || 0;

          if (localTime > remoteTime) {
            // Edición local más reciente en el tiempo: subir a la nube preservando versión previa
            this.log(`[Aether Vault] ⚡ Edición local más reciente en "${localPkg.title}" (${localTime} > ${remoteTime}). Subiendo a la nube...`);
            await this.uploadWorkPackage(localPkg, idToken);
          } else {
            // La nube es más reciente: bifurcar borrador local para no perder nada y descargar nube
            this.log(`[Aether Vault] ⚡ Nube más reciente en "${remote.title}" (${remoteTime} > ${localTime}). Bifurcando borrador local y descargando...`);
            const forked = await this.storageManager.forkWorkPackage(localPkg, 'Borrador local');
            this.log(`[Aether Vault] ✓ Borrador local preservado con éxito en: "${forked.title}" (ID: ${forked.id})`);

            const downloaded = await this.downloadRemoteWork(remote.workId, remote.checksum);
            if (downloaded) {
              await this.storageManager.applyWorkPackageFromCloud(downloaded, isActive);
              if (isActive && this.onWorkHydratedCallback) {
                this.onWorkHydratedCallback(downloaded);
              }
              this.storageManager.markClean();
            }

            if (this.audio) {
              this.audio.play(432, 'sine', 0.4, 0.1);
              setTimeout(() => this.audio?.play(528, 'sine', 0.5, 0.14), 140);
            }
            this.notifyUser('✦ Versión remota sincronizada. Tu borrador local se ha protegido en tus Obras.');
          }
        }
      }

      // 6. Subir obras locales que no existen en el catálogo remoto
      const localCatalog = await this.storageManager.getWorksCatalog();
      for (const item of localCatalog) {
        if (!processedRemoteIds.has(item.id)) {
          const localPkg = await this.storageManager.getWorkPackage(item.id);
          if (localPkg && !this.storageManager.isVirginStarterWork(localPkg)) {
            const hasText = (localPkg.document?.bodyText || '').trim().length > 0;
            const hasNodes = (localPkg.nodes || []).length > 0;
            if (hasText || hasNodes) {
              this.log(`[Aether Vault] ⇪ Subiendo nueva obra local al catálogo de la Bóveda: "${localPkg.title}" (${localPkg.id})...`);
              await this.uploadWorkPackage(localPkg, idToken);
            }
          }
        }
      }

      // 7. Culminación exitosa
      this.lastSyncedAt = Date.now();
      this.lastError = null;
      this.setStatus('synced', 'Bóveda sincronizada (eu-south-2)');
      this.log('[Aether Vault] ✓ Sincronización bidireccional completada con éxito.');

      // Firma sonora litúrgica: Campana armónica a 528 Hz (Tono sagrado de transformación)
      if (this.audio) {
        this.audio.play(528, 'sine', 0.8, 0.1);
      }

      // Retorno suave a 'idle' tras 4 segundos preservando el registro temporal
      if (this.idleResetTimer) {
        window.clearTimeout(this.idleResetTimer);
      }
      this.idleResetTimer = window.setTimeout(() => {
        if (this.status === 'synced') {
          this.setStatus('idle');
        }
      }, 4000);

      return true;
    } catch (err: any) {
      console.error('[Aether Vault] ⚠ Error durante syncVault:', err);
      this.lastError = err?.message || 'Error de sincronización con la Bóveda';
      this.setStatus('error', this.lastError);
      return false;
    }
  }

  /**
   * Fuerza la descarga directa y rehidratación de la obra más reciente de la Bóveda en pantalla.
   * Ideal para máquinas nuevas donde el autor quiere traer su texto deliberadamente.
   */
  public async pullFromVault(): Promise<boolean> {
    if (!cognitoAuth.isAuthenticated()) {
      this.setStatus('offline', 'Autor no autenticado');
      return false;
    }
    if (!this.storageManager) return false;

    this.setStatus('syncing', 'Descargando obra desde la Bóveda en AWS España...');
    this.log('[Aether Vault] ⤓ Forzando descarga manual desde la Bóveda...');

    try {
      const remoteWorks = await this.listRemoteWorks();
      if (remoteWorks.length === 0) {
        this.setStatus('idle', 'No hay obras en la Bóveda todavía');
        console.warn('[Aether Vault] La Bóveda remota no tiene obras para este usuario.');
        return false;
      }

      // Ordenar por la más reciente
      const sorted = [...remoteWorks].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const targetWork = sorted[0];

      this.log(`[Aether Vault] ⤓ Descargando obra seleccionada: "${targetWork.title}" (ID: ${targetWork.workId})...`);

      // Salvaguarda: si el autor tenía ediciones locales activas, protegerlas en un borrador antes de descargar
      const activePkg = await this.storageManager.getActiveWorkPackage();
      if (activePkg && activePkg.id === targetWork.workId) {
        const localHash = await this.calculateWorkChecksum(activePkg);
        if (targetWork.checksum && localHash !== targetWork.checksum && (activePkg.hasUserEdits || this.storageManager.getIsDirty())) {
          this.log('[Aether Vault] 🛡 Protegiendo borrador local antes de forzar descarga manual...');
          await this.storageManager.forkWorkPackage(activePkg, 'Borrador local antes de descarga');
        }
      }

      const downloaded = await this.downloadRemoteWork(targetWork.workId, targetWork.checksum);

      if (downloaded) {
        await this.storageManager.applyWorkPackageFromCloud(downloaded, true);
        if (this.onWorkHydratedCallback) {
          this.onWorkHydratedCallback(downloaded);
        }
        this.storageManager.markClean();
        this.lastSyncedAt = Date.now();
        this.lastError = null;
        this.setStatus('synced', `Obra "${downloaded.title}" restaurada desde la Bóveda`);
        if (this.audio) this.audio.play(528, 'sine', 0.8, 0.12);
        return true;
      }

      throw new Error('No se pudo descargar el archivo de la Bóveda');
    } catch (err: any) {
      console.error('[Aether Vault] Error durante pullFromVault:', err);
      this.lastError = err?.message || 'Error al descargar de la Bóveda';
      this.setStatus('error', this.lastError);
      return false;
    }
  }

  /**
   * Alias de compatibilidad hacia atrás para syncVault().
   */
  public async syncActiveWork(): Promise<boolean> {
    return this.syncVault();
  }

  /**
   * Sube un paquete de obra a la Bóveda (DynamoDB + S3 con Presigned URL).
   */
  private async uploadWorkPackage(pkg: WorkPackage, idToken: string): Promise<boolean> {
    // 1. Calcular el checksum de contenido determinista y sellarlo en el paquete
    const checksum = await this.calculateWorkChecksum(pkg);
    pkg.checksum = checksum;
    pkg.syncedChecksum = checksum;
    pkg.syncedAt = Date.now();
    pkg.isDirty = false;

    // Asegurar que el payload enviado a S3 incluya el checksum y estado sellado
    const jsonPayload = JSON.stringify(pkg);
    const sizeBytes = new Blob([jsonPayload]).size;
    const wordCount = this.countWords(pkg.document?.bodyText || '');

    this.log(`[Aether Vault] ⇪ Solicitando Presigned URL para "${pkg.title}" (${sizeBytes} bytes, checksum: ${checksum.slice(0, 8)}...)...`);

    // 2. Inicialización en API Gateway y DynamoDB
    const initResponse = await fetch(`${this.apiUrl}/vault/sync/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        workId: pkg.id,
        title: pkg.title || 'Sin título',
        updatedAt: pkg.updatedAt || Date.now(),
        wordCount,
        activePhase: pkg.activePhase || 'crystal',
        sizeBytes,
        checksum
      })
    });

    if (!initResponse.ok) {
      const errJson = await initResponse.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${initResponse.status} en inicio de sincronización`);
    }

    const initData: SyncInitResponse = await initResponse.json();
    if (!initData.uploadUrl) {
      throw new Error('No se recibió la URL de subida de S3 desde la Bóveda.');
    }

    // 3. Subida directa a S3 vía Presigned PUT
    this.log('[Aether Vault] ⇪ Subiendo paquete cifrado directamente a S3 en España...');
    const s3UploadResponse = await fetch(initData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: jsonPayload
    });

    if (!s3UploadResponse.ok) {
      throw new Error(`Error al depositar en S3: HTTP ${s3UploadResponse.status}`);
    }

    // 4. Persistir localmente la marca de sincronización en IndexedDB
    if (this.storageManager) {
      await this.storageManager.applyWorkPackageFromCloud(pkg, false);
      this.storageManager.markClean();
    }

    this.log(`[Aether Vault] ✓ Obra "${pkg.title}" depositada con éxito en la Bóveda.`);
    return true;
  }

  // ============================================================================
  // GESTIÓN DE OBRAS REMOTAS EN LA BÓVEDA
  // ============================================================================

  /**
   * Consulta el catálogo de obras del autor guardadas en la nube.
   */
  public async listRemoteWorks(): Promise<RemoteWorkMetadata[]> {
    if (!cognitoAuth.isAuthenticated()) return [];

    try {
      const idToken = cognitoAuth.getIdToken();
      if (!idToken) return [];

      const res = await fetch(`${this.apiUrl}/vault/works?_t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        cache: 'no-store'
      });

      if (!res.ok) {
        throw new Error(`Error al consultar obras remotas: HTTP ${res.status}`);
      }

      const data: VaultWorksListResponse = await res.json();
      return data.works || [];
    } catch (err) {
      console.warn('[Aether Vault] Error al listar obras remotas:', err);
      return [];
    }
  }

  /**
   * Descarga una obra desde la Bóveda y la devuelve como WorkPackage para ser importada.
   */
  public async downloadRemoteWork(workId: string, remoteChecksum?: string): Promise<WorkPackage | null> {
    if (!cognitoAuth.isAuthenticated()) return null;

    try {
      const idToken = cognitoAuth.getIdToken();
      if (!idToken) return null;

      const res = await fetch(`${this.apiUrl}/vault/works/${encodeURIComponent(workId)}/download?_t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        cache: 'no-store'
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} al solicitar descarga de "${workId}"`);
      }

      const data: SyncDownloadResponse = await res.json();
      if (!data.downloadUrl) return null;

      const fileRes = await fetch(data.downloadUrl, {
        cache: 'no-store'
      });
      if (!fileRes.ok) {
        throw new Error(`HTTP ${fileRes.status} al descargar archivo desde S3`);
      }

      const pkg: WorkPackage = await fileRes.json();
      const verifiedChecksum = remoteChecksum || (await this.calculateWorkChecksum(pkg));
      pkg.checksum = verifiedChecksum;
      pkg.syncedChecksum = verifiedChecksum;
      return pkg;
    } catch (err) {
      console.error('[Aether Vault] Error al descargar obra remota:', err);
      return null;
    }
  }

  /**
   * Elimina una obra de la Bóveda (tanto metadatos en DynamoDB como archivo en S3).
   */
  public async deleteRemoteWork(workId: string): Promise<boolean> {
    if (!cognitoAuth.isAuthenticated()) return false;

    try {
      const idToken = cognitoAuth.getIdToken();
      if (!idToken) return false;

      const res = await fetch(`${this.apiUrl}/vault/works/${encodeURIComponent(workId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      return res.ok;
    } catch (err) {
      console.error('[Aether Vault] Error al eliminar obra remota:', err);
      return false;
    }
  }

  // ============================================================================
  // UTILIDADES CRIPTOGRÁFICAS Y TEXTUALES NATIVAS
  // ============================================================================

  /**
   * Calcula un hash SHA-256 criptográfico, determinista y normalizado
   * del contenido semántico de una obra (título, texto, ideas, conexiones, descartes).
   * Es 100% reproducible en cualquier dispositivo e inmune a desfases de reloj local o variables volátiles.
   */
  public async calculateWorkChecksum(pkg: WorkPackage): Promise<string> {
    const normalized = {
      title: (pkg.title || '').trim(),
      bodyHtml: (pkg.document?.bodyHtml || '').trim(),
      bodyText: (pkg.document?.bodyText || '').trim(),
      nodes: (pkg.nodes || [])
        .map((n) => ({
          id: n.id,
          text: (n.text || '').trim(),
          pos: {
            x: Math.round(n.position?.x ?? 0),
            y: Math.round(n.position?.y ?? 0)
          },
          phase: n.phase
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      bridges: (pkg.bridges || [])
        .map((b) => ({
          id: b.id,
          source: b.sourceId,
          target: b.targetId
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      discards: (pkg.discards || [])
        .map((d) => ({
          id: d.id,
          text: (d.text || '').trim()
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    };

    return this.calculateSha256(JSON.stringify(normalized));
  }

  private countWords(text: string): number {
    if (!text) return 0;
    const clean = text.replace(/<[^>]*>/g, ' ').trim();
    if (!clean) return 0;
    return clean.split(/\s+/).length;
  }

  private async calculateSha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const buffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // ============================================================================
  // OBSERVACIÓN DE ESTADOS Y EVENTOS REACTIVOS
  // ============================================================================

  public getStatus(): SyncStatus {
    return this.status;
  }

  public getLastSyncedAt(): number | null {
    return this.lastSyncedAt;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public onSyncStatusChange(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status, this.lastError);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStatus(status: SyncStatus, detail?: string | null): void {
    this.status = status;
    for (const listener of this.listeners) {
      try {
        listener(status, detail);
      } catch (e) {
        console.error('[Aether Vault] Error en listener de sincronización:', e);
      }
    }
  }
}

export const cloudSync = CloudSyncManager.getInstance();
