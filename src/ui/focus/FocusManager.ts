/**
 * ============================================================================
 * CAPA 3: GESTOR DE FOCO GRAVITATORIO E HIPERFOCO (FOCUS MANAGER)
 * ============================================================================
 * Implementa el Pilar 2 del Manifiesto de Aether:
 * - Sustituye el cursor mecánico parpadeante por el "Pulso de Presencia":
 *   un halo sutil de luz que sigue la posición del cursor de texto en tiempo real.
 * - Detecta la cadencia de tecleo y activa el estado de "Hiperfoco":
 *   atenúa la interfaz periférica cuando el usuario entra en flujo de escritura,
 *   y restaura suavemente los controles cuando se toma una pausa para pensar.
 */

export interface FocusOptions {
  /** Milisegundos de inactividad antes de salir del hiperfoco (por defecto 2500ms) */
  idleDelayMs?: number;
}

export class FocusManager {
  private idleDelayMs: number;
  private idleTimer: number | null = null;
  private isHyperfocusActive: boolean = false;
  private trackedElement: HTMLElement | null = null;
  private presenceHalo: HTMLDivElement;

  constructor(options: FocusOptions = {}) {
    this.idleDelayMs = options.idleDelayMs ?? 2500;
    this.presenceHalo = this.createPresenceHalo();
  }

  /**
   * Crea el elemento visual del Pulso de Presencia en el DOM.
   */
  private createPresenceHalo(): HTMLDivElement {
    const halo = document.createElement('div');
    halo.className = 'presence-pulse';
    halo.style.display = 'none';
    document.body.appendChild(halo);
    return halo;
  }

  /**
   * Vincula el gestor de foco a un elemento editable (como el Santuario Editorial).
   */
  public attach(element: HTMLElement): void {
    this.trackedElement = element;

    // Escucha eventos de teclado y entrada de texto
    element.addEventListener('keydown', () => this.handleActivity());
    element.addEventListener('input', () => {
      this.handleActivity();
      this.updatePresencePosition();
    });

    // Escucha movimientos del cursor y clics del ratón
    element.addEventListener('click', () => {
      this.updatePresencePosition();
    });

    element.addEventListener('keyup', () => {
      this.updatePresencePosition();
    });

    // Cuando el usuario sale del editor, se desactiva el hiperfoco
    element.addEventListener('blur', () => {
      this.exitHyperfocus();
      this.hidePresenceHalo();
    });

    element.addEventListener('focus', () => {
      this.showPresenceHalo();
      this.updatePresencePosition();
    });

    // Escucha cambios globales en la selección para mantener el halo sincronizado
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === this.trackedElement) {
        this.updatePresencePosition();
      }
    });
  }

  /**
   * Se ejecuta con cada pulsación de tecla para modular el hiperfoco.
   */
  private handleActivity(): void {
    // Si no estábamos en hiperfoco, entrar en él de forma fluida
    if (!this.isHyperfocusActive) {
      this.enterHyperfocus();
    }

    // Reinicia el temporizador de inactividad reflexiva
    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer);
    }

    this.idleTimer = window.setTimeout(() => {
      this.exitHyperfocus();
    }, this.idleDelayMs);
  }

  /**
   * Activa el estado de hiperfoco en el cuerpo de la página.
   */
  private enterHyperfocus(): void {
    this.isHyperfocusActive = true;
    document.body.classList.add('hyperfocus-active');
    this.presenceHalo.classList.add('active-typing');
  }

  /**
   * Restaura la interfaz periférica cuando el usuario se detiene a reflexionar.
   */
  private exitHyperfocus(): void {
    this.isHyperfocusActive = false;
    document.body.classList.remove('hyperfocus-active');
    this.presenceHalo.classList.remove('active-typing');

    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Calcula la posición exacta del cursor de texto en pantalla y mueve el halo de luz.
   */
  public updatePresencePosition(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Si el cursor está visible con coordenadas válidas
    if (rect.top !== 0 || rect.left !== 0) {
      this.presenceHalo.style.display = 'block';
      // Alineación óptica limpia: se posiciona en rect.left exacto sin desplazamientos negativos
      // que invadan el glifo de la letra anterior o siguiente
      const opticalX = Math.round(rect.left);
      const opticalY = Math.round(rect.top + 2);
      this.presenceHalo.style.transform = `translate3d(${opticalX}px, ${opticalY}px, 0)`;
      this.presenceHalo.style.height = `${Math.max(rect.height - 4, 18)}px`;
    }
  }

  /**
   * Muestra el halo de luz del cursor.
   */
  public showPresenceHalo(): void {
    this.presenceHalo.style.display = 'block';
  }

  /**
   * Oculta el halo de luz cuando no hay foco en el texto.
   */
  public hidePresenceHalo(): void {
    this.presenceHalo.style.display = 'none';
  }

  /**
   * Consulta si el usuario está actualmente en estado de hiperfoco.
   */
  public isInHyperfocus(): boolean {
    return this.isHyperfocusActive;
  }
}
