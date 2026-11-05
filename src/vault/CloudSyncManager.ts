/**
 * ==============================================================================
 * AETHER — GESTOR DE SINCRONIZACIÓN DE BÓVEDA (CLOUDSYNCMANAGER)
 * ==============================================================================
 * Conecta la arquitectura Local-First soberana con AWS España (eu-south-2):
 * - Sincronización BIDIRECCIONAL automática (Pull & Push inteligente).
 * - Detección de cambios entre dispositivos mediante marcas temporales y checksum SHA-256.
 * - Rehidratación en vivo de la obra activa al detectar versiones más recientes en la nube.
 * - Sube archivos .aether cifrados a S3 privado mediante Presigned URLs.
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

  private readonly apiUrl: string =
    (import.meta as any).env?.VITE_VAULT_API_URL ||
    'https://npfw7ws25i.execute-api.eu-south-2.amazonaws.com';

  private constructor() {}

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
        // Al autenticarse (por login o vuelta de OAuth), sincronizar automáticamente en segundo plano
        this.syncVault();
      } else if (authState.status === 'unauthenticated') {
        this.setStatus('offline');
      }
    });

    // Si ya está autenticado al inicializar, pasar a idle y sincronizar
    if (cognitoAuth.isAuthenticated()) {
      this.setStatus('idle');
      this.syncVault();
    }
  }

  // ============================================================================
  // SINCRONIZACIÓN BIDIRECCIONAL HOLÍSTICA (PULL & PUSH)
  // ============================================================================

  /**
   * Ejecuta la sincronización completa entre el almacenamiento local y la Bóveda en AWS España.
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

    this.setStatus('syncing', 'Sincronizando con la Bóveda en AWS España...');

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
      const remoteWorks = await this.listRemoteWorks();

      // 4. Obtener obra activa local
      const activeLocalPkg = await this.storageManager.getActiveWorkPackage();
      const currentWorkId = this.storageManager.getCurrentWorkId();

      // 5. Comparar obras y resolver sincronización
      if (remoteWorks.length > 0) {
        for (const remote of remoteWorks) {
          const localPkg = await this.storageManager.getWorkPackage(remote.workId);
          const localIsVirgin = this.storageManager.isVirginStarterWork(localPkg);

          // Si no existe localmente, o es la plantilla virgen, o la versión remota es más nueva
          const needsDownload =
            !localPkg ||
            localIsVirgin ||
            (remote.updatedAt > (localPkg.updatedAt || 0) && remote.checksum !== localPkg.checksum);

          if (needsDownload) {
            console.log(`[Aether Vault] Descargando versión más reciente de "${remote.title}" desde la Bóveda...`);
            const downloaded = await this.downloadRemoteWork(remote.workId);

            if (downloaded) {
              const isActive =
                downloaded.id === currentWorkId ||
                (currentWorkId === 'default_work' && (remote.workId === 'default_work' || localIsVirgin));

              await this.storageManager.applyWorkPackageFromCloud(downloaded, isActive);

              if (isActive && this.onWorkHydratedCallback) {
                this.onWorkHydratedCallback(downloaded);
              }
            }
          } else if (localPkg && (localPkg.updatedAt || 0) > remote.updatedAt) {
            // Local es más reciente en este dispositivo: subir los cambios más frescos a la nube
            console.log(`[Aether Vault] Subiendo cambios locales más frescos de "${localPkg.title}" a la Bóveda...`);
            await this.uploadWorkPackage(localPkg, idToken);
          }
        }

        // Si la obra activa local no existe en la nube y no es virgen, subirla a la Bóveda
        if (activeLocalPkg && !remoteWorks.some((rw) => rw.workId === activeLocalPkg.id)) {
          if (!this.storageManager.isVirginStarterWork(activeLocalPkg)) {
            await this.uploadWorkPackage(activeLocalPkg, idToken);
          }
        }
      } else {
        // La Bóveda está vacía: si tenemos obra activa con contenido, la subimos
        if (activeLocalPkg) {
          await this.uploadWorkPackage(activeLocalPkg, idToken);
        }
      }

      // 6. Culminación exitosa
      this.lastSyncedAt = Date.now();
      this.lastError = null;
      this.setStatus('synced', 'Bóveda sincronizada (eu-south-2)');

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
      console.error('[Aether Vault] Error durante syncVault:', err);
      this.lastError = err?.message || 'Error de sincronización con la Bóveda';
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
    }

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

      const res = await fetch(`${this.apiUrl}/vault/works`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
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
  public async downloadRemoteWork(workId: string): Promise<WorkPackage | null> {
    if (!cognitoAuth.isAuthenticated()) return null;

    try {
      const idToken = cognitoAuth.getIdToken();
      if (!idToken) return null;

      const res = await fetch(`${this.apiUrl}/vault/works/${encodeURIComponent(workId)}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} al solicitar descarga`);
      }

      const data: SyncDownloadResponse = await res.json();
      if (!data.downloadUrl) return null;

      const fileRes = await fetch(data.downloadUrl);
      if (!fileRes.ok) {
        throw new Error(`HTTP ${fileRes.status} al descargar archivo desde S3`);
      }

      const pkg: WorkPackage = await fileRes.json();
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
