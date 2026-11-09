/**
 * Aether — Interfaz Litúrgica de Autor y Modal de Bóveda (AuthModal)
 *
 * Controla el botón en la cabecera, el modal de inicio de sesión con Google (PKCE)
 * y el popover del autor autenticado.
 */
import { cognitoAuth } from './CognitoAuthService';
import type { AuthState } from './types';
import { cloudSync } from '../vault/CloudSyncManager';
import type { SyncStatus } from '../vault/types';

export class AuthModalController {
  private static instance: AuthModalController;
  private modalBackdrop: HTMLElement | null = null;
  private authorPopover: HTMLElement | null = null;
  private vaultBtn: HTMLElement | null = null;
  private isOpen: boolean = false;
  private isPopoverOpen: boolean = false;

  private constructor() {
    this.createDomElements();
    this.bindEvents();
    this.subscribeToAuth();
    this.subscribeToSync();
  }

  public static getInstance(): AuthModalController {
    if (!AuthModalController.instance) {
      AuthModalController.instance = new AuthModalController();
    }
    return AuthModalController.instance;
  }

  // ============================================================================
  // CONSTRUCCIÓN DEL DOM LITÚRGICO
  // ============================================================================

  private createDomElements(): void {
    // 1. Modal de Autenticación
    const backdrop = document.createElement('div');
    backdrop.id = 'auth-modal-backdrop';
    backdrop.className = 'auth-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.innerHTML = `
      <div class="auth-modal-container">
        <button class="auth-modal-close-btn" id="btn-auth-close" aria-label="Cerrar">&times;</button>
        
        <div class="auth-modal-header">
          <div class="auth-modal-triad">
            <span class="auth-triad-dot vapor" ></span>
            <span class="auth-triad-dot liquid" ></span>
            <span class="auth-triad-dot crystal" ></span>
          </div>
          <h2 class="auth-modal-title">La Bóveda del Autor</h2>
          <p class="auth-modal-subtitle">
            Conecta tu identidad para sincronizar tus obras entre dispositivos bajo cifrado soberano.
          </p>
          <div class="auth-modal-badge">Soberanía de Datos · AWS España (eu-south-2)</div>
        </div>

        <button class="btn-google-auth" id="btn-google-login">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
          </svg>
          <span>Continuar con Google</span>
        </button>

        <div class="auth-modal-footer">
          <button class="auth-modal-local-btn" id="btn-auth-local">
            Permanecer en modo local anónimo (sin cuenta)
          </button>
          <div class="auth-modal-legal">
            Al identificarte aceptas la <a href="https://christiangohring.com/posts/politicas-privacidad-aether/" target="_blank" rel="noopener noreferrer">Política de Privacidad y Soberanía</a> de la Bóveda.
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    this.modalBackdrop = backdrop;

    // 2. Popover de Autor Autenticado (Cápsula Horizontal)
    const popover = document.createElement('div');
    popover.id = 'author-popover';
    popover.className = 'author-popover';
    popover.innerHTML = `
      <div class="popover-author-header">
        <div id="popover-avatar-slot"></div>
        <div class="popover-author-info">
          <div class="popover-author-name" id="popover-author-name">Autor</div>
          <div class="popover-author-email" id="popover-author-email" style="display:none;">...</div>
        </div>
      </div>
      <div class="popover-meta" id="popover-meta-sync">
        <span class="popover-meta-dot">●</span>
        <span class="popover-meta-text">Bóveda activa</span>
      </div>
      <div class="popover-actions">
        <button class="popover-action-btn" id="btn-sync-vault" title="Sincronizar Bóveda en AWS">
          <span>⟳</span>
          <span>Sincronizar</span>
        </button>
        <button class="popover-action-btn" id="btn-pull-vault" title="Traer de la Bóveda">
          <span>⤓</span>
          <span>Traer</span>
        </button>
        <button class="popover-action-btn logout" id="btn-logout" title="Cerrar Sesión">
          <span>⎋</span>
          <span>Salir</span>
        </button>
      </div>
    `;

    // Se ancla dentro del header o en el contenedor de controles derechos
    const headerRight = document.getElementById('header-right-controls');
    if (headerRight) {
      headerRight.style.position = 'relative';
      headerRight.appendChild(popover);
    } else {
      document.body.appendChild(popover);
    }
    this.authorPopover = popover;
  }

  // ============================================================================
  // VINCULACIÓN DE EVENTOS Y ACCIONES
  // ============================================================================

  private bindEvents(): void {
    // Cerrar con Escape o clic en backdrop
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isOpen) this.closeModal();
        if (this.isPopoverOpen) this.closePopover();
      }
    });

    this.modalBackdrop?.addEventListener('click', (e) => {
      if (e.target === this.modalBackdrop) {
        this.closeModal();
      }
    });

    document.getElementById('btn-auth-close')?.addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('btn-auth-local')?.addEventListener('click', () => {
      this.closeModal();
    });

    // Login con Google
    document.getElementById('btn-google-login')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-google-login') as HTMLButtonElement | null;
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.innerText = 'Conectando con Google...';
      }
      await cognitoAuth.signInWithGoogle();
    });

    // Cerrar sesión
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      this.closePopover();
      cognitoAuth.logout();
    });

    // Sincronizar Bóveda (Bidireccional)
    document.getElementById('btn-sync-vault')?.addEventListener('click', async () => {
      this.closePopover();
      await cloudSync.syncVault();
    });

    // Traer de la Bóveda (Descarga forzada y rehidratación)
    document.getElementById('btn-pull-vault')?.addEventListener('click', async () => {
      this.closePopover();
      await cloudSync.pullFromVault();
    });

    // Clic fuera del popover para cerrarlo
    document.addEventListener('click', (e) => {
      if (this.isPopoverOpen) {
        const target = e.target as HTMLElement;
        if (!this.authorPopover?.contains(target) && !this.vaultBtn?.contains(target)) {
          this.closePopover();
        }
      }
    });
  }

  // ============================================================================
  // CONEXIÓN CON EL BOTÓN DEL HEADER (#vault-btn)
  // ============================================================================

  public mountVaultButton(buttonElement?: HTMLElement | null): void {
    if (buttonElement) {
      this.vaultBtn = buttonElement;
    } else {
      let existing = document.getElementById('vault-btn');
      if (!existing) {
        existing = document.createElement('button');
        existing.id = 'vault-btn';
        existing.className = 'vault-btn';
        const headerRight = document.getElementById('header-right-controls');
        if (headerRight) {
          headerRight.appendChild(existing);
        }
      }
      this.vaultBtn = existing;
    }

    if (!this.vaultBtn) return;

    this.vaultBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (cognitoAuth.isAuthenticated()) {
        this.togglePopover();
      } else {
        this.openModal();
      }
    });

    // Renderizar estado inicial
    this.renderVaultButton(cognitoAuth.getState());
  }

  private subscribeToAuth(): void {
    cognitoAuth.onAuthStateChanged((state) => {
      if (this.vaultBtn) {
        this.renderVaultButton(state);
      }
      this.updatePopoverDetails(state);
    });
  }

  private subscribeToSync(): void {
    cloudSync.onSyncStatusChange((status, detail) => {
      this.renderSyncStatus(status, detail);
    });
  }

  private renderSyncStatus(status: SyncStatus, detail?: string | null): void {
    const authState = cognitoAuth.getState();
    const isAuth = authState.status === 'authenticated' && !!authState.author;
    const authorName = (authState.author?.name || 'Autor').toUpperCase();

    // 1. Actualizar botón del header (#vault-btn)
    if (this.vaultBtn) {
      this.vaultBtn.classList.remove('is-syncing', 'is-synced', 'is-error');

      if (!isAuth) {
        this.vaultBtn.setAttribute('data-aether-tooltip', 'SINCRONIZA TU NUBE');
      } else {
        switch (status) {
          case 'syncing':
            this.vaultBtn.classList.add('is-syncing');
            this.vaultBtn.setAttribute('data-aether-tooltip', 'SINCRONIZANDO CON LA BÓVEDA...');
            break;
          case 'synced':
            this.vaultBtn.classList.add('is-synced');
            this.vaultBtn.setAttribute('data-aether-tooltip', `BÓVEDA DE ${authorName} · SINCRONIZADA`);
            break;
          case 'error':
            this.vaultBtn.classList.add('is-error');
            this.vaultBtn.setAttribute('data-aether-tooltip', `ERROR DE BÓVEDA: ${(detail || 'REINTENTAR').toUpperCase()}`);
            break;
          case 'idle':
          default:
            this.vaultBtn.classList.add('is-synced');
            this.vaultBtn.setAttribute('data-aether-tooltip', `BÓVEDA DE ${authorName} · ACTIVA`);
            break;
        }
      }
    }

    // 2. Actualizar botón dentro del popover (#btn-sync-vault)
    const syncBtn = document.getElementById('btn-sync-vault') as HTMLButtonElement | null;
    if (syncBtn) {
      syncBtn.classList.remove('is-syncing', 'is-synced', 'is-error');

      switch (status) {
        case 'syncing':
          syncBtn.disabled = true;
          syncBtn.classList.add('is-syncing');
          syncBtn.innerHTML = '<span class="vault-sync-spin-icon">⟳</span><span>Sincronizando...</span>';
          break;
        case 'synced':
          syncBtn.disabled = false;
          syncBtn.classList.add('is-synced');
          syncBtn.innerHTML = '<span class="vault-sync-check-icon">✓</span><span>Sincronizado</span>';
          break;
        case 'error':
          syncBtn.disabled = false;
          syncBtn.classList.add('is-error');
          syncBtn.innerHTML = '<span class="vault-sync-warn-icon">⚠</span><span>Reintentar</span>';
          break;
        case 'idle':
        default:
          syncBtn.disabled = false;
          syncBtn.innerHTML = '<span>⟳</span><span>Sincronizar</span>';
          break;
      }
    }

    // 2b. Actualizar botón de descarga forzada (#btn-pull-vault)
    const pullBtn = document.getElementById('btn-pull-vault') as HTMLButtonElement | null;
    if (pullBtn) {
      pullBtn.disabled = status === 'syncing';
    }

    // 3. Actualizar texto de metadatos del popover (#popover-meta-sync)
    const metaContainer = document.getElementById('popover-meta-sync');
    if (metaContainer) {
      const dot = metaContainer.querySelector('.popover-meta-dot') as HTMLElement | null;
      const text = metaContainer.querySelector('.popover-meta-text') as HTMLElement | null;

      if (status === 'syncing') {
        if (dot) dot.style.color = '#d9ba85';
        if (text) text.innerText = detail || 'Sincronizando...';
      } else if (status === 'error') {
        if (dot) dot.style.color = '#e57373';
        if (text) text.innerText = detail || 'Error';
      } else {
        const lastSync = cloudSync.getLastSyncedAt();
        if (dot) dot.style.color = '#5eb3a9';
        if (text) {
          if (detail) {
            text.innerText = detail;
          } else if (lastSync) {
            text.innerText = 'Sincronizado';
          } else {
            text.innerText = 'Bóveda activa';
          }
        }
      }
    }
  }

  private renderVaultButton(state: AuthState): void {
    if (!this.vaultBtn) return;

    if (state.status === 'authenticated' && state.author) {
      this.vaultBtn.classList.add('is-authenticated');
      this.vaultBtn.removeAttribute('title');
      this.vaultBtn.setAttribute('data-aether-tooltip', `BÓVEDA DE ${(state.author.name || 'AUTOR').toUpperCase()} · SINCRONIZADA`);

      const initial = (state.author.name || state.author.email || 'A').charAt(0).toUpperCase();

      if (state.author.picture) {
        this.vaultBtn.innerHTML = `
          <img class="vault-avatar" src="${state.author.picture}" alt="${state.author.name}" />
          <span class="vault-label">${state.author.name?.split(' ')[0] || 'Autor'}</span>
          <span class="vault-sync-dot"></span>
        `;
      } else {
        this.vaultBtn.innerHTML = `
          <div class="vault-avatar-fallback">${initial}</div>
          <span class="vault-label">${state.author.name?.split(' ')[0] || 'Autor'}</span>
          <span class="vault-sync-dot"></span>
        `;
      }
    } else {
      this.vaultBtn.classList.remove('is-authenticated');
      this.vaultBtn.removeAttribute('title');
      this.vaultBtn.setAttribute('data-aether-tooltip', 'SINCRONIZA TU NUBE');
      this.vaultBtn.innerHTML = `
        <span class="vault-icon">☁</span>
        <span class="vault-label">Bóveda</span>
        <span class="vault-sync-dot"></span>
      `;
    }

    // Reflejar clases y estado de sincronización actual
    this.renderSyncStatus(cloudSync.getStatus(), cloudSync.getLastError() || undefined);
  }

  private updatePopoverDetails(state: AuthState): void {
    const nameEl = document.getElementById('popover-author-name');
    const emailEl = document.getElementById('popover-author-email');
    const avatarSlot = document.getElementById('popover-avatar-slot');

    if (state.status === 'authenticated' && state.author) {
      if (nameEl) {
        nameEl.innerText = state.author.name || 'Autor';
        if (state.author.email) {
          nameEl.setAttribute('title', `${state.author.name || 'Autor'} (${state.author.email})`);
        }
      }
      if (emailEl) emailEl.innerText = state.author.email;

      if (avatarSlot) {
        if (state.author.picture) {
          avatarSlot.innerHTML = `<img class="popover-author-avatar" src="${state.author.picture}" alt="${state.author.name}" />`;
        } else {
          const initial = (state.author.name || 'A').charAt(0).toUpperCase();
          avatarSlot.innerHTML = `<div class="vault-avatar-fallback" style="width:22px;height:22px;font-size:11px;">${initial}</div>`;
        }
      }
    }
  }

  // ============================================================================
  // CONTROLADORES DE APERTURA / CIERRE
  // ============================================================================

  public openModal(): void {
    if (this.isPopoverOpen) this.closePopover();
    this.isOpen = true;
    this.modalBackdrop?.classList.add('is-open');
  }

  public closeModal(): void {
    this.isOpen = false;
    this.modalBackdrop?.classList.remove('is-open');
  }

  public togglePopover(): void {
    if (this.isPopoverOpen) {
      this.closePopover();
    } else {
      this.openPopover();
    }
  }

  public openPopover(): void {
    this.isPopoverOpen = true;
    this.authorPopover?.classList.add('is-open');
  }

  public closePopover(): void {
    this.isPopoverOpen = false;
    this.authorPopover?.classList.remove('is-open');
  }
}

export const authModal = AuthModalController.getInstance();
