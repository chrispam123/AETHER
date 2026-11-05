/**
 * ==============================================================================
 * AETHER — BÓVEDA DEL AUTOR (AWS SPAIN eu-south-2) — TIPOS DE SINCRONIZACIÓN
 * ==============================================================================
 * Define los contratos para la sincronización de obras soberanas entre el
 * cliente Local-First (IndexedDB) y la infraestructura de nube (DynamoDB + S3).
 * ==============================================================================
 */

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'synced' | 'error';

export interface RemoteWorkMetadata {
  userId: string;
  workId: string;
  title: string;
  updatedAt: number;
  wordCount: number;
  activePhase: string;
  sizeBytes: number;
  checksum: string;
  s3Key: string;
  syncedAt: number;
}

export interface SyncInitResponse {
  success: boolean;
  workId: string;
  uploadUrl: string;
  s3Key: string;
  expiresInSeconds: number;
}

export interface SyncDownloadResponse {
  success: boolean;
  workId: string;
  downloadUrl: string;
  metadata: RemoteWorkMetadata | null;
  expiresInSeconds: number;
}

export interface VaultWorksListResponse {
  works: RemoteWorkMetadata[];
}

export type SyncStatusListener = (status: SyncStatus, detail?: string | null) => void;

export interface VaultSyncConfig {
  apiUrl: string;
  region: string;
}
