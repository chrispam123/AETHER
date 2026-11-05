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

  /**
   * Conecta el callback para rehidratar la UI cuando la nube descarga una versión más fresca.
   */
  public setOnWorkHydrated(callback: (pkg: WorkPackage) => void): void {
    this.onWorkHydratedCallback = callback;
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

      // 4. Obtener obra activa local
      const activeLocalPkg = await this.storageManager.getActiveWorkPackage();
      const currentWorkId = this.storageManager.getCurrentWorkId();
      const localScreenIsVirgin = this.storageManager.isVirginStarterWork(activeLocalPkg);
      const isLocalDirty = this.storageManager.getIsDirty();

      this.log(`[Aether Vault] 📊 Estado local: dirty=${isLocalDirty}, virgin=${localScreenIsVirgin}, currentWorkId=${currentWorkId}`);

      // 5. Comparar obras y resolver sincronización
      if (remoteWorks.length > 0) {
        // Ordenar obras remotas por fecha de actualización descendente (la más reciente primero)
        const sortedRemote = [...remoteWorks].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        for (const remote of sortedRemote) {
          const localPkg = await this.storageManager.getWorkPackage(remote.workId);
          const localIsVirgin = this.storageManager.isVirginStarterWork(localPkg);
          const localChecksum = (localPkg as any)?.checksum;
          const isChecksumEqual = Boolean(localChecksum && remote.checksum && localChecksum === remote.checksum);

          // REGLA MAESTRA DE CONFLICTOS BIDIRECCIONALES BASADA EN CHECKSUM Y ESTADO DIRTY:
          // 1. Si no existe localmente o es virgen: DESCARGA.
          // 2. Si el cliente local está limpio (!isLocalDirty) y el checksum difiere de la nube: DESCARGA.
          // 3. Si la nube tiene una fecha más reciente y el checksum difiere: DESCARGA.
          const needsDownload =
            !localPkg ||
            localIsVirgin ||
            (!isLocalDirty && !isChecksumEqual) ||
            (!isChecksumEqual && (remote.updatedAt || 0) > (localPkg.updatedAt || 0));

          if (needsDownload) {
            this.log(`[Aether Vault] ⤓ Descargando versión más reciente de "${remote.title}" (${remote.workId})...`);
            const downloaded = await this.downloadRemoteWork(remote.workId, remote.checksum);

            if (downloaded) {
              const isActive =
                downloaded.id === currentWorkId ||
                localScreenIsVirgin ||
                (currentWorkId === 'default_work' && remote.workId === 'default_work');

              await this.storageManager.applyWorkPackageFromCloud(downloaded, isActive);

              if (isActive && this.onWorkHydratedCallback) {
                this.log(`[Aether Vault] ✦ Rehidratando pantalla activa con "${downloaded.title}"...`);
                this.onWorkHydratedCallback(downloaded);
              }
              this.storageManager.markClean();
            }
          } else if (localPkg && isLocalDirty && localPkg.hasUserEdits && !isChecksumEqual) {
            // SÓLO si el autor realmente editó en este equipo (isLocalDirty === true) y su contenido difiere:
            this.log(`[Aether Vault] ⇪ Subiendo cambios locales más frescos de "${localPkg.title}"...`);
            await this.uploadWorkPackage(localPkg, idToken);
          }
        }

        // Si la obra activa local no existe en la nube y el autor escribió en ella (isLocalDirty):
        if (activeLocalPkg && !remoteWorks.some((rw) => rw.workId === activeLocalPkg.id)) {
          if (isLocalDirty && !this.storageManager.isVirginStarterWork(activeLocalPkg)) {
            this.log(`[Aether Vault] ⇪ Subiendo nueva obra local activa "${activeLocalPkg.title}"...`);
            await this.uploadWorkPackage(activeLocalPkg, idToken);
          }
        }
      } else {
        // La Bóveda está vacía: si tenemos obra activa con contenido real, la subimos
        if (activeLocalPkg && !this.storageManager.isVirginStarterWork(activeLocalPkg)) {
          this.log(`[Aether Vault] ⇪ Bóveda vacía. Registrando primera obra del autor "${activeLocalPkg.title}"...`);
          await this.uploadWorkPackage(activeLocalPkg, idToken);
        }
      }

      // 6. Culminación exitosa
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
    pkg.syncedAt = Date.now();
    const jsonPayload = JSON.stringify(pkg);
    const sizeBytes = new Blob([jsonPayload]).size;
    const checksum = await this.calculateSha256(jsonPayload);
    pkg.checksum = checksum;

    const wordCount = this.countWords(pkg.document?.bodyText || '');

    this.log(`[Aether Vault] ⇪ Solicitando Presigned URL para "${pkg.title}" (${sizeBytes} bytes, checksum: ${checksum.slice(0, 8)}...)...`);

    // 1. Inicialización en API Gateway y DynamoDB
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

    // 2. Subida directa a S3 vía Presigned PUT
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

    // 3. Persistir localmente la marca de sincronización
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
      if (remoteChecksum) {
        pkg.checksum = remoteChecksum;
      }
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
