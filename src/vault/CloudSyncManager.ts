/**
 * ==============================================================================
 * AETHER — GESTOR DE SINCRONIZACIÓN DE BÓVEDA (CLOUDSYNCMANAGER)
 * ==============================================================================
 * Conecta la arquitectura Local-First soberana con AWS España (eu-south-2):
 * - Valida el token JWT de Cognito para llamadas a API Gateway HTTP API v2.
 * - Registra metadatos atómicos en DynamoDB (POST /vault/sync/init).
 * - Sube directamente el paquete .aether cifrado al bucket S3 privado mediante Presigned URL.
 * - Sincroniza bajo demanda con pulso litúrgico y retorno armónico Web Audio API.
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
      } else if (authState.status === 'unauthenticated') {
        this.setStatus('offline');
      }
    });

    // Si ya está autenticado al inicializar, pasar a idle
    if (cognitoAuth.isAuthenticated()) {
      this.setStatus('idle');
    }
  }

  // ============================================================================
  // SINCRONIZACIÓN DE LA OBRA ACTIVA CON LA BÓVEDA
  // ============================================================================

  /**
   * Sincroniza la obra activa del autor con la Bóveda soberana en AWS España.
   */
  public async syncActiveWork(): Promise<boolean> {
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

    this.setStatus('syncing', 'Iniciando sincronización con AWS España...');

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

      // 2. Extraer paquete completo de la obra activa asegurando autoguardado previo
      const pkg: WorkPackage | null = await this.storageManager.getActiveWorkPackage();
      if (!pkg) {
        throw new Error('No se pudo empaquetar la obra activa para sincronización.');
      }

      // 3. Serializar y calcular estadísticas criptográficas y de volumen
      const jsonPayload = JSON.stringify(pkg);
      const sizeBytes = new Blob([jsonPayload]).size;
      const checksum = await this.calculateSha256(jsonPayload);
      const wordCount = this.countWords(pkg.document?.bodyText || '');

      // 4. Solicitar inicialización de sincronización y URL prefirmada a API Gateway
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

      // 5. Subida directa del archivo .aether a S3 usando Presigned URL (cifrado AES256)
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

      // 6. Culminación exitosa
      this.lastSyncedAt = Date.now();
      this.lastError = null;
      this.setStatus('synced', 'Obra sincronizada en la Bóveda (eu-south-2)');

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
      console.error('[Aether Vault] Error durante la sincronización:', err);
      this.lastError = err?.message || 'Error de conexión con la Bóveda';
      this.setStatus('error', this.lastError);
      return false;
    }
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
