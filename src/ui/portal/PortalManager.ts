/**
 * ============================================================================
 * CAPA 3: GESTOR DEL SANTUARIO DE BIENVENIDA (PORTAL MANAGER)
 * ============================================================================
 * Orquesta la experiencia de entrada a Aether:
 * - Pregunta ontológica inicial (Tríptico de Orbes: Niebla, Fluido, Cristal).
 * - Resonancia viva unificada: Al seleccionar una obra, los 3 orbes despiertan
 *   simultáneamente (is-awakened), mostrando que la obra vive en los tres estados.
 * - Marcador de último foco (✦ Último foco): Señala la densidad donde se guardó.
 * - Elección deliberada de densidad: Clic en cualquiera de los 3 orbes para
 *   entrar directamente a la obra en ese estado de la materia.
 * - Catálogo vivo de Obras en Curso (IndexedDB multiobra).
 * - Puerta de importación directa de archivos .aether.
 */

import { StorageManager } from '../../storage/StorageManager';
import { WorkSummary } from '../../storage/db/AetherDatabase';
import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';
import { Phase } from '../../core/types';

export class PortalManager {
  private worksContainer: HTMLElement | null = null;
  private worksListEl: HTMLElement | null = null;
  private openAetherBtn: HTMLElement | null = null;
  private newWorkBtn: HTMLElement | null = null;
  private storageManager: StorageManager;
  private audio: HarmonicSynthesizer;
  private onSelectWorkCallback: (workId: string, phase?: Phase) => Promise<void>;
  private onImportAetherCallback: (file?: File) => Promise<void>;
  private onNewWorkCallback: () => Promise<void>;

  private selectedWorkId: string | null = null;
  private worksCatalog: WorkSummary[] = [];

  constructor(
    storageManager: StorageManager,
    audio: HarmonicSynthesizer,
    onSelectWork: (workId: string, phase?: Phase) => Promise<void>,
    onImportAether: (file?: File) => Promise<void>,
    onNewWork: () => Promise<void>
  ) {
    this.storageManager = storageManager;
    this.audio = audio;
    this.onSelectWorkCallback = onSelectWork;
    this.onImportAetherCallback = onImportAether;
    this.onNewWorkCallback = onNewWork;

    this.cacheElements();
    this.bindEvents();
  }

  private cacheElements(): void {
    this.worksContainer = document.getElementById('portal-continuity');
    this.worksListEl = document.getElementById('portal-works-list');
    this.openAetherBtn = document.getElementById('btn-portal-open-aether');
    this.newWorkBtn = document.getElementById('btn-portal-new-work');
  }

  private bindEvents(): void {
    if (this.newWorkBtn) {
      this.newWorkBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        this.audio.play(528, 'sine', 0.4, 0.1);
        await this.onNewWorkCallback();
      });
    }

    if (this.openAetherBtn) {
      this.openAetherBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        this.audio.play(480, 'sine', 0.3, 0.08);
        await this.onImportAetherCallback();
      });
    }
  }

  /**
   * Obtiene el identificador de la obra actualmente seleccionada en el Santuario.
   */
  public getSelectedWorkId(): string | null {
    return this.selectedWorkId;
  }

  /**
   * Obtiene la obra actualmente seleccionada.
   */
  public getSelectedWork(): WorkSummary | null {
    if (!this.selectedWorkId) return null;
    return this.worksCatalog.find((w) => w.id === this.selectedWorkId) || null;
  }

  /**
   * Selecciona una obra en el catálogo:
   * 1. Resalta la tarjeta en la lista de obras.
   * 2. Despierta los 3 orbes a la vez (is-awakened) indicando continuidad multidimensional.
   * 3. Marca el orbe donde se guardó la obra con el distintivo de último foco.
   */
  public selectWork(workId: string, playSound: boolean = true): void {
    const work = this.worksCatalog.find((w) => w.id === workId);
    if (!work) return;

    this.selectedWorkId = workId;

    // 1. Resaltar en la lista visual
    if (this.worksListEl) {
      const allItems = this.worksListEl.querySelectorAll('.portal-work-item');
      allItems.forEach((el) => {
        if (el.getAttribute('data-work-id') === workId) {
          el.classList.add('is-selected');
        } else {
          el.classList.remove('is-selected');
        }
      });
    }

    // 2. Despertar los 3 orbes y colocar el marcador de foco
    this.updateOrbResonance(work.activePhase);

    // 3. Respuesta acústica sutil
    if (playSound) {
      this.audio.play(440, 'sine', 0.25, 0.08);
    }
  }

  /**
   * Actualiza la resonancia de los 3 orbes superiores del tríptico.
   */
  private updateOrbResonance(activePhase: Phase | null): void {
    const orbVapor = document.getElementById('orb-vapor');
    const orbLiquid = document.getElementById('orb-liquid');
    const orbCrystal = document.getElementById('orb-crystal');

    const orbs: Array<{ el: HTMLElement | null; phase: Phase }> = [
      { el: orbVapor, phase: 'vapor' },
      { el: orbLiquid, phase: 'liquid' },
      { el: orbCrystal, phase: 'crystal' }
    ];

    if (!activePhase) {
      orbs.forEach(({ el }) => {
        if (!el) return;
        el.classList.remove('is-awakened', 'is-last-focus');
      });
      return;
    }

    // Asegurar que siempre mapee a una fase cognitiva real (Niebla, Fluido o Cristal)
    const normalizedPhase: Phase =
      activePhase === 'vapor' || activePhase === 'liquid' || activePhase === 'crystal'
        ? activePhase
        : 'crystal';

    // Todos los tres orbes despiertan a la vez indicando continuidad ontológica
    orbs.forEach(({ el, phase }) => {
      if (!el) return;
      el.classList.add('is-awakened');

      const isLastFocus = phase === normalizedPhase;
      if (isLastFocus) {
        el.classList.add('is-last-focus');
      } else {
        el.classList.remove('is-last-focus');
      }
    });
  }

  /**
   * Refresca la lista de obras recientes en el Santuario de Bienvenida.
   * Carga únicamente hasta 5 obras activas en la vista rápida.
   */
  public async refresh(): Promise<void> {
    if (!this.worksListEl || !this.worksContainer) return;

    try {
      this.worksCatalog = await this.storageManager.getQuickViewWorks(5);
      this.renderWorks(this.worksCatalog);

      // Selección inicial coherente
      if (this.selectedWorkId && this.worksCatalog.some((w) => w.id === this.selectedWorkId)) {
        this.selectWork(this.selectedWorkId, false);
      } else {
        const currentWorkId = this.storageManager.getCurrentWorkId();
        if (currentWorkId && this.worksCatalog.some((w) => w.id === currentWorkId)) {
          this.selectWork(currentWorkId, false);
        } else if (this.worksCatalog.length > 0) {
          this.selectWork(this.worksCatalog[0].id, false);
        } else {
          this.selectedWorkId = null;
          this.updateOrbResonance(null);
        }
      }
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
      if (this.selectedWorkId === work.id) {
        itemEl.classList.add('is-selected');
      }

      const phaseLabel = this.formatPhaseLabel(work.activePhase);
      const timeLabel = this.formatRelativeTime(work.updatedAt);
      const title = work.title.trim() || 'Guía de Bienvenida a Aether';
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
          ${work.wordCount ? `<span class="portal-work-time" style="color: var(--amber-glow, #d4a373);">${work.wordCount} pal.</span>` : ''}
          <span class="portal-work-time">${timeLabel}</span>
          <button class="portal-work-hide-btn" aria-label="Retirar obra de la vista rápida" type="button">
            <svg class="portal-hide-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
            <span class="portal-custom-tooltip">Retirar obra de la vista rápida</span>
          </button>
        </div>
      `;

      // Clic simple: Abre directamente la obra en la fase donde se guardó
      itemEl.addEventListener('click', async (e) => {
        const hideBtn = (e.target as HTMLElement).closest('.portal-work-hide-btn');
        if (hideBtn) {
          e.stopPropagation();

          // 1. Animación suave de disolución sin destruir datos
          itemEl.style.transition = 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
          itemEl.style.opacity = '0';
          itemEl.style.transform = 'translateY(-6px)';

          // 2. Firma acústica de retiro sereno
          this.audio.play(360, 'sine', 0.25, 0.08);

          // 3. Marca en IndexedDB y subida inmediata del siguiente archivo en la cola
          setTimeout(async () => {
            await this.storageManager.hideWorkFromQuickView(work.id);
            await this.refresh();
          }, 240);
          return;
        }

        this.selectWork(work.id, true);
        this.audio.play(528, 'sine', 0.45, 0.12);
        await this.onSelectWorkCallback(work.id, work.activePhase);
      });

      // Doble clic: Acceso rápido directo en la fase donde se guardó
      itemEl.addEventListener('dblclick', async (e) => {
        const hideBtn = (e.target as HTMLElement).closest('.portal-work-hide-btn');
        if (hideBtn) return;

        this.audio.play(528, 'sine', 0.45, 0.12);
        await this.onSelectWorkCallback(work.id, work.activePhase);
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
