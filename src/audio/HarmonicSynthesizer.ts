/**
 * ============================================================================
 * SISTEMA SENSORIAL: SINTETIZADOR DE RESONANCIA ACÚSTICA (WEB AUDIO API)
 * ============================================================================
 * Genera retroalimentación auditiva discreta basada en armónicos naturales:
 * - 432 Hz: Frecuencia de coherencia y reposo.
 * - 528 Hz: Tono de transformación y claridad (utilizado en el modo Cristal).
 * No requiere archivos de audio externos (.mp3 o .wav); sintetiza ondas puras.
 */

export class HarmonicSynthesizer {
  private audioCtx: AudioContext | null = null;
  private isEnabled: boolean = false;

  constructor() {}

  /**
   * Inicializa el contexto de audio tras el primer gesto del usuario.
   */
  private ensureContext(): void {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
  }

  /**
   * Alterna entre sonido activado y silenciado.
   */
  public toggle(): boolean {
    this.ensureContext();
    this.isEnabled = !this.isEnabled;

    if (this.isEnabled) {
      this.play(432, 'sine', 1.2, 0.16);
    }
    return this.isEnabled;
  }

  /**
   * Consulta si el sonido está habilitado actualmente.
   */
  public getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Sintetiza un tono armónico con envolvente exponencial suave.
   * @param freq Frecuencia en Hertz (Hz)
   * @param type Tipo de oscilador ('sine', 'triangle', etc.)
   * @param duration Duración en segundos
   * @param gainVal Volumen relativo (0.0 a 1.0)
   */
  public play(freq: number, type: OscillatorType = 'sine', duration: number = 0.6, gainVal: number = 0.12): void {
    if (!this.isEnabled) return;
    this.ensureContext();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch {
      // Manejo silencioso de restricciones de audio del navegador
    }
  }
}
