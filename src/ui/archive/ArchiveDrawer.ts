/**
 * ============================================================================
 * CAPA 3: EL ARCHIVO DE LA MEMORIA (ARCHIVE DRAWER)
 * ============================================================================
 * Panel lateral de condensación de materia para la biblioteca completa de obras:
 * - Invocación exclusiva mediante atajo de teclado: [ Alt + O ] y tecla Esc.
 * - Animación termodinámica: entra desde la derecha en niebla difusa (blur 28px)
 *   y cristaliza en roca basáltica nítida (blur 0px) al fijarse.
 * - Búsqueda en tiempo real a 120 FPS por título, fase o fragmento de pensamiento.
 * - Filtros por densidad de materia: [ Todas ] [ Niebla ] [ Fluido ] [ Cristal ] [ Retiradas ].
 * - Restauración instantánea de obras retiradas a la vista rápida del Santuario.
 * - 100% Local-First sobre IndexedDB.
 */

import { StorageManager } from '../../storage/StorageManager';
import { WorkSummary } from '../../storage/db/AetherDatabase';
import { HarmonicSynthesizer } from '../../audio/HarmonicSynthesizer';
import { Phase } from '../../core/types';

export class ArchiveDrawer {
  private backdropEl: HTMLElement | null = null;
  private drawerEl: HTMLElement | null = null;
  private closeBtn: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private searchClearBtn: HTMLElement | null = null;
  private filterBtnsContainer: HTMLElement | null = null;
  private worksListEl: HTMLElement | null = null;
  private countLabel: HTMLElement | null = null;

  private storageManager: StorageManager;
  private audio: HarmonicSynthesizer;
  private onSelectWorkCallback: (workId: string, phase?: Phase) => Promise<void>;
  private onRefreshPortalCallback: () => Promise<void>;

  private isOpen: boolean = false;
  private allWorks: WorkSummary[] = [];
  private currentFilter: 'all' | Phase | 'hidden' = 'all';
  private searchQuery: string = '';

  constructor(
    storageManager: StorageManager,
    audio: HarmonicSynthesizer,
    onSelectWork: (workId: string, phase?: Phase) => Promise<void>,
    onRefreshPortal: () => Promise<void>
  ) {
    this.storageManager = storageManager;
    this.audio = audio;
    this.onSelectWorkCallback = onSelectWork;
    this.onRefreshPortalCallback = onRefreshPortal;

    this.cacheElements();
    this.bindEvents();
  }

  private cacheElements(): void {
    this.backdropEl = document.getElementById('archive-backdrop');
    this.drawerEl = document.getElementById('archive-drawer');
    this.closeBtn = document.getElementById('archive-close-btn');
    this.searchInput = document.getElementById('archive-search-input') as HTMLInputElement | null;
    this.searchClearBtn = document.getElementById('archive-search-clear');
    this.filterBtnsContainer = document.getElementById('archive-phase-filters');
    this.worksListEl = document.getElementById('archive-works-list');
    this.countLabel = document.getElementById('archive-count-label');
  }

  private bindEvents(): void {
    // 1. Cierre mediante botón Esc en la cabecera
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    // 2. Cierre al hacer clic en el telón de fondo
    if (this.backdropEl) {
      this.backdropEl.addEventListener('click', () => this.close());
    }

    // 3. Búsqueda tipográfica reactiva en tiempo real
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
        if (this.searchClearBtn) {
          this.searchClearBtn.style.display = this.searchQuery ? 'inline-flex' : 'none';
        }
        this.renderList();
      });
    }

    // 4. Limpiar búsqueda
    if (this.searchClearBtn) {
      this.searchClearBtn.addEventListener('click', () => {
        if (this.searchInput) {
          this.searchInput.value = '';
          this.searchInput.focus();
        }
        this.searchQuery = '';
        this.searchClearBtn!.style.display = 'none';
        this.renderList();
      });
    }

    // 5. Filtros por densidad de materia
    if (this.filterBtnsContainer) {
      const filterBtns = this.filterBtnsContainer.querySelectorAll<HTMLButtonElement>('.archive-filter-btn');
      filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          filterBtns.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const filter = btn.getAttribute('data-phase-filter') as 'all' | Phase | 'hidden';
          this.currentFilter = filter || 'all';
          this.audio.play(520, 'sine', 0.2, 0.05);
          this.renderList();
        });
      });
    }
  }

  /**
   * Abre el Archivo de la Memoria con la animación de condensación y niebla disipada.
   */
  public async open(): Promise<void> {
    if (this.isOpen || !this.drawerEl || !this.backdropEl) return;
    this.isOpen = true;

    // Firma acústica de condensación (barrido armónico)
    this.audio.play(280, 'sine', 0.55, 0.1);

    this.backdropEl.style.display = 'block';
    // Forzar reflow para que la transición CSS opere impecablemente
    void this.backdropEl.offsetWidth;
    this.backdropEl.classList.add('is-open');

    this.drawerEl.classList.add('is-open');
    this.drawerEl.setAttribute('aria-hidden', 'false');

    // Recuperar el catálogo íntegro de IndexedDB
    try {
      this.allWorks = await this.storageManager.getWorksCatalog();
    } catch (e) {
      console.warn('[ArchiveDrawer] Error al cargar obras:', e);
      this.allWorks = [];
    }

    this.renderList();

    // Foco en el campo de búsqueda
    setTimeout(() => {
      this.searchInput?.focus();
    }, 280);
  }

  /**
   * Cierra el cajón del archivo.
   */
  public close(): void {
    if (!this.isOpen || !this.drawerEl || !this.backdropEl) return;
    this.isOpen = false;

    this.audio.play(380, 'triangle', 0.2, 0.05);

    this.drawerEl.classList.remove('is-open');
    this.drawerEl.setAttribute('aria-hidden', 'true');
    this.backdropEl.classList.remove('is-open');

    setTimeout(() => {
      if (!this.isOpen && this.backdropEl) {
        this.backdropEl.style.display = 'none';
      }
    }, 650);
  }

  /**
   * Alterna la visibilidad del archivo (Alt + O).
   */
  public async toggle(): Promise<void> {
    if (this.isOpen) {
      this.close();
    } else {
      await this.open();
    }
  }

  /**
   * Indica si el cajón se encuentra actualmente abierto.
   */
  public isDrawerOpen(): boolean {
    return this.isOpen;
  }

  /**
   * Renderiza las obras filtradas dentro del contenedor del cajón.
   */
  private renderList(): void {
    const listEl = this.worksListEl;
    if (!listEl) return;

    listEl.innerHTML = '';

    // Filtrado combinado: Texto y Fase
    const filtered = this.allWorks.filter((work) => {
      // 1. Filtro por fase
      if (this.currentFilter === 'hidden') {
        if (!work.hiddenFromQuickView) return false;
      } else if (this.currentFilter !== 'all') {
        if (work.activePhase !== this.currentFilter) return false;
      }

      // 2. Filtro por búsqueda de texto
      if (this.searchQuery) {
        const titleMatch = (work.title || '').toLowerCase().includes(this.searchQuery);
        const previewMatch = (work.previewText || '').toLowerCase().includes(this.searchQuery);
        return titleMatch || previewMatch;
      }

      return true;
    });

    // Actualizar indicador de contador
    if (this.countLabel) {
      const total = this.allWorks.length;
      const count = filtered.length;
      this.countLabel.textContent = `● ${count} de ${total} ${total === 1 ? 'obra preservada' : 'obras preservadas'} en tu navegador`;
    }

    if (filtered.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'archive-empty-state';
      emptyEl.innerHTML = `
        <span class="archive-empty-icon">⌕</span>
        <p class="archive-empty-text">Ninguna obra resuena con este criterio</p>
        <span class="archive-empty-hint">Prueba con otro término o limpia los filtros</span>
      `;
      listEl.appendChild(emptyEl);
      return;
    }

    filtered.forEach((work) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'archive-work-card';
      itemEl.setAttribute('data-work-id', work.id);

      const phaseLabel = this.formatPhaseLabel(work.activePhase);
      const timeLabel = this.formatRelativeTime(work.updatedAt);
      const title = work.title.trim() || 'Sobre la naturaleza del pensamiento';
      const preview = work.previewText ? `«${work.previewText}»` : 'Lienzo de pensamiento vivo';

      itemEl.innerHTML = `
        <div class="archive-card-header">
          <div class="archive-card-title-row">
            <span class="portal-work-dot phase-${work.activePhase}"></span>
            <h4 class="archive-card-title">${this.escapeHtml(title)}</h4>
          </div>
          <div class="archive-card-badges">
            <span class="portal-work-phase-tag phase-${work.activePhase}">${phaseLabel}</span>
            <span class="archive-card-time">${timeLabel}</span>
          </div>
        </div>
        <p class="archive-card-preview">${this.escapeHtml(preview)}</p>
        <div class="archive-card-footer">
          <span class="archive-card-nodes">${work.nodesCount || 0} ideas</span>
          ${
            work.hiddenFromQuickView
              ? `<button class="archive-restore-btn" type="button" title="Devolver a la vista rápida">
                  <svg class="archive-eye-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <span>Restaurar a vista rápida</span>
                </button>`
              : `<span class="archive-card-in-quick">En vista rápida</span>`
          }
        </div>
      `;

      // Clic en el botón de restaurar
      const restoreBtn = itemEl.querySelector('.archive-restore-btn');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          this.audio.play(480, 'sine', 0.3, 0.08);
          await this.storageManager.unhideWorkFromQuickView(work.id);
          work.hiddenFromQuickView = false;
          this.renderList();
          await this.onRefreshPortalCallback();
        });
      }

      // Clic en la tarjeta: abrir la obra de inmediato
      itemEl.addEventListener('click', async () => {
        this.close();
        this.audio.play(528, 'sine', 0.5, 0.12);
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
