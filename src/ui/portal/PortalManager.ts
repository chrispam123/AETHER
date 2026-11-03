/**
 * ============================================================================
 * CAPA 3: GESTOR DEL SANTUARIO DE BIENVENIDA (PORTAL MANAGER)
 * ============================================================================
 * Orquesta la experiencia de entrada a Aether:
 * - Pregunta ontológica inicial (Orbes: Niebla, Fluido, Cristal).
 * - Catálogo vivo de Obras en Curso (Multidocumento en IndexedDB).
 * - Puerta de importación directa de archivos .aether.
 * - Conmutación fluida entre proyectos a 120 FPS.
 */

import { StorageManager } from '../../storage/StorageManager';
import { WorkSummary } from '../../storage/db/AetherDatabase';
import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';
import { Phase } from '../../core/types';

export class PortalManager {
  private worksContainer: HTMLElement | null = null;
  private worksListEl: HTMLElement | null = null;
  private openAetherBtn: HTMLElement | null = null;
  private storageManager: StorageManager;
  private audio: HarmonicSynthesizer;
  private onSelectWorkCallback: (workId: string) => Promise<void>;
  private onImportAetherCallback: (file?: File) => Promise<void>;

  constructor(
    storageManager: StorageManager,
    audio: HarmonicSynthesizer,
    onSelectWork: (workId: string) => Promise<void>,
    onImportAether: (file?: File) => Promise<void>
  ) {
    this.storageManager = storageManager;
    this.audio = audio;
    this.onSelectWorkCallback = onSelectWork;
    this.onImportAetherCallback = onImportAether;

    this.cacheElements();
    this.bindEvents();
  }

  private cacheElements(): void {
    this.worksContainer = document.getElementById('portal-continuity');
    this.worksListEl = document.getElementById('portal-works-list');
    this.openAetherBtn = document.getElementById('btn-portal-open-aether');
  }

  private bindEvents(): void {
    if (this.openAetherBtn) {
      this.openAetherBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        this.audio.play(480, 'sine', 0.3, 0.08);
        await this.onImportAetherCallback();
      });
    }
  }

  /**
   * Refresca la lista de obras recientes en el Santuario de Bienvenida.
   */
  public async refresh(): Promise<void> {
    if (!this.worksListEl || !this.worksContainer) return;

    try {
      const works = await this.storageManager.getWorksCatalog();
      this.renderWorks(works);
    } catch (e) {
      console.warn('[PortalManager] Error al refrescar catálogo de obras:', e);
    }
  }

  /**
   * Renderiza las tarjetas tipográficas de las obras en curso.
   */
  private renderWorks(works: WorkSummary[]): void {
    const listEl = this.worksListEl;
    if (!listEl || !this.worksContainer) return;

    listEl.innerHTML = '';

    if (works.length === 0) {
      this.worksContainer.style.display = 'flex';
      return;
    }

    this.worksContainer.style.display = 'flex';

    works.forEach((work) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'portal-work-item';
      itemEl.setAttribute('data-work-id', work.id);

      const phaseLabel = this.formatPhaseLabel(work.activePhase);
      const timeLabel = this.formatRelativeTime(work.updatedAt);
      const title = work.title.trim() || 'Sobre la naturaleza del pensamiento';
      const preview = work.previewText ? `«${work.previewText}»` : 'Lienzo de pensamiento vivo';

      itemEl.innerHTML = `
        <div class="portal-work-lead">
          <span class="portal-work-dot phase-${work.activePhase}"></span>
          <div class="portal-work-meta">
            <h3 class="portal-work-title">${this.escapeHtml(title)}</h3>
            <span class="portal-work-preview">${this.escapeHtml(preview)}</span>
          </div>
        </div>
        <div class="portal-work-status">
          <span class="portal-work-phase-tag phase-${work.activePhase}">${phaseLabel}</span>
          <span class="portal-work-time">${timeLabel}</span>
          <button class="portal-work-delete-btn" title="Eliminar obra del registro local" type="button">×</button>
        </div>
      `;

      // Clic para abrir la obra
      itemEl.addEventListener('click', async (e) => {
        const deleteBtn = (e.target as HTMLElement).closest('.portal-work-delete-btn');
        if (deleteBtn) {
          e.stopPropagation();
          const confirmDelete = window.confirm(`¿Eliminar "${title}" de tus obras locales?`);
          if (confirmDelete) {
            await this.storageManager.deleteWork(work.id);
            this.audio.play(240, 'triangle', 0.2, 0.08);
            await this.refresh();
          }
          return;
        }

        this.audio.play(528, 'sine', 0.4, 0.12);
        await this.onSelectWorkCallback(work.id);
      });

      listEl.appendChild(itemEl);
    });
  }

  private formatPhaseLabel(phase: Phase): string {
    switch (phase) {
      case 'vapor': return 'Niebla';
      case 'liquid': return 'Fluido';
      case 'crystal': return 'Cristal';
      default: return 'Niebla';
    }
  }

  private formatRelativeTime(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 2) return 'Ahora mismo';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffHours === 1) return 'Hace 1 hora';
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;

    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
