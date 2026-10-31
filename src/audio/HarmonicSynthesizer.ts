/**
 * ============================================================================
 * SISTEMA SENSORIAL: SINTETIZADOR DE RESONANCIA ACÚSTICA (WEB AUDIO API)
 * ============================================================================
 * Genera retroalimentación auditiva discreta y atmósfera continua de estudio:
 * 1. Chimes discretos (432 Hz, 528 Hz) para interacciones táctiles y fases.
 * 2. PAISAJE SONORO PROCEDURAL DE ENFOQUE (Cognitive Shielding):
 *    - Se calibra con la SEMILLA MATEMÁTICA DEL TÍTULO DE LA OBRA.
 *    - Si no hay título, usa la Semilla Primordial 'AETHER_ORIGIN' (432 Hz).
 *    - Lecho de 3 osciladores analógicos en consonancia pitagórica.
 *    - Marea polirrítmica continua (LFOs asíncronos en números primos).
 *    - Susurro de ruido marrón (Brown Noise) para enmascaramiento cognitivo.
 *    - Fade-in de 3s y Fade-out de 2.5s para no sobresaltar la concentración.
 */

export class HarmonicSynthesizer {
  private audioCtx: AudioContext | null = null;
  private isEnabled: boolean = false;

  // Estado del Paisaje Sonoro Ambiental
  private isAtmospherePlaying: boolean = false;
  private currentSeedTitle: string = '';
  private masterAtmosphereGain: GainNode | null = null;
  private oscRoot: OscillatorNode | null = null;
  private oscFifth: OscillatorNode | null = null;
  private oscOctave: OscillatorNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private lfoFilter: OscillatorNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;

  constructor() {}

  /**
   * Inicializa el contexto de audio tras el primer gesto del usuario.
   */
  private async ensureContext(): Promise<void> {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {}
    }
  }

  /**
   * Alterna el estado general del audio (silenciado / activo).
   */
  public toggle(): boolean {
    this.ensureContext();
    this.isEnabled = !this.isEnabled;

    if (this.isEnabled) {
      this.play(432, 'sine', 1.0, 0.15);
    } else {
      if (this.isAtmospherePlaying) {
        this.stopAtmosphere();
      }
    }
    return this.isEnabled;
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Sintetiza un tono armónico discreto (chime) con envolvente exponencial suave.
   */
  public play(
    freq: number,
    type: OscillatorType = 'sine',
    duration: number = 0.6,
    gainVal: number = 0.12
  ): void {
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
      // Manejo silencioso de restricciones de audio
    }
  }

  // ==========================================================================
  // MOTOR DE PAISAJE SONORO PROCEDURAL (GENERADO POR SEMILLA DEL TÍTULO)
  // ==========================================================================

  /**
   * Hash determinista FNV-1a para convertir el título en una semilla matemática de 32 bits.
   */
  private hashString(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /**
   * Generador pseudo-aleatorio determinista (Mulberry32).
   */
  private createPrng(seed: number) {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Calcula los parámetros de frecuencia a partir de la semilla del título.
   * Si no hay título, usa la firma primordial (432Hz / 108Hz).
   */
  private deriveHarmonicParameters(rawTitle: string): {
    rootFreq: number;
    fifthFreq: number;
    octaveFreq: number;
    filterFreq: number;
    lfoRate: number;
  } {
    const cleanTitle = rawTitle.trim();
    // Condición: Si está en blanco o es el placeholder, usa la Semilla Primordial
    const isBlank =
      cleanTitle.length === 0 ||
      cleanTitle.toLowerCase() === 'sin título...' ||
      cleanTitle.toLowerCase() === 'sin titulo...';

    const seedText = isBlank ? 'AETHER_ORIGIN_432' : cleanTitle;
    const seed = this.hashString(seedText);
    const prng = this.createPrng(seed);

    // Escala de raíces armónicas contemplativas en rango audible y cálido (Octava 3)
    const harmonicRoots = [
      216.0, // La 432 Hz / 2 (tono puro de serenidad)
      192.0, // Sol contemplativo
      229.4, // Si bemol místico
      243.0, // Si pitagórico
      256.0, // Do de la Tierra (afinación científica de Schumann)
      272.2, // Frecuencia Om cósmica (Octava 3)
      288.0  // Re armónico
    ];

    const rootIdx = Math.floor(prng() * harmonicRoots.length);
    const rootFreq = isBlank ? 216.0 : harmonicRoots[rootIdx];

    // Intervalo de segundo oscilador: Quinta perfecta (x1.5) o Cuarta perfecta (x1.333)
    const intervalChoice = prng() > 0.4 ? 1.5 : 1.3333;
    const fifthFreq = rootFreq * intervalChoice;

    // Intervalo de tercer oscilador: Octava pura (x2.0) o Novena flotante (x2.25)
    const octaveChoice = prng() > 0.5 ? 2.0 : 2.25;
    const octaveFreq = rootFreq * octaveChoice;

    // Frecuencia del filtro analógico aterciopelado (entre 550 Hz y 850 Hz)
    const filterFreq = 580 + prng() * 260;

    // Velocidad de respiración del LFO (ciclos lentos de entre 12 y 20 segundos)
    const lfoRate = 0.05 + prng() * 0.03;

    return { rootFreq, fifthFreq, octaveFreq, filterFreq, lfoRate };
  }

  /**
   * Genera un búfer de ruido marrón (Brown Noise) para enmascaramiento cognitivo suave.
   */
  private createBrownNoiseBuffer(): AudioBuffer | null {
    if (!this.audioCtx) return null;
    const bufferSize = this.audioCtx.sampleRate * 4; // Búfer en loop de 4 segundos
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Integración suave que convierte ruido blanco en ruido marrón cálido
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
    return buffer;
  }

  /**
   * Inicia el paisaje sonoro continuo generado por la semilla del título.
   */
  public async startAtmosphere(title: string = ''): Promise<void> {
    await this.ensureContext();
    if (!this.audioCtx) return;
    this.isEnabled = true;

    // Si ya estaba sonando, simplemente actualizamos la semilla suavemente
    if (this.isAtmospherePlaying) {
      this.updateAtmosphereSeed(title);
      return;
    }

    this.currentSeedTitle = title;
    const now = this.audioCtx.currentTime;
    const params = this.deriveHarmonicParameters(title);

    try {
      // Chime inmediato de confirmación acústica al encender
      this.play(params.rootFreq, 'sine', 1.4, 0.16);

      // 1. Ganancia Maestra de la Atmósfera (con Fade-In suave de 2.2 segundos)
      this.masterAtmosphereGain = this.audioCtx.createGain();
      this.masterAtmosphereGain.gain.setValueAtTime(0.0001, now);
      this.masterAtmosphereGain.gain.linearRampToValueAtTime(0.22, now + 2.2);
      this.masterAtmosphereGain.connect(this.audioCtx.destination);

      // 2. Filtro Analógico Cálido de Paso Bajo (BiquadFilter)
      this.filterNode = this.audioCtx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(params.filterFreq, now);
      this.filterNode.Q.setValueAtTime(1.2, now);
      this.filterNode.connect(this.masterAtmosphereGain);

      // 3. LFO de respiración que modula suavemente el filtro
      this.lfoFilter = this.audioCtx.createOscillator();
      const lfoGain = this.audioCtx.createGain();
      this.lfoFilter.frequency.setValueAtTime(params.lfoRate, now);
      lfoGain.gain.setValueAtTime(70, now);
      this.lfoFilter.connect(lfoGain);
      lfoGain.connect(this.filterNode.frequency);
      this.lfoFilter.start(now);

      // 4. Oscilador 1: Tónica Fundamental Cálida (Onda Triangular analógica)
      this.oscRoot = this.audioCtx.createOscillator();
      this.oscRoot.type = 'triangle';
      this.oscRoot.frequency.setValueAtTime(params.rootFreq, now);
      const rootGain = this.audioCtx.createGain();
      rootGain.gain.setValueAtTime(0.38, now);
      this.oscRoot.connect(rootGain);
      rootGain.connect(this.filterNode);
      this.oscRoot.start(now);

      // 5. Oscilador 2: Quinta o Cuarta Consonante
      this.oscFifth = this.audioCtx.createOscillator();
      this.oscFifth.type = 'sine';
      this.oscFifth.frequency.setValueAtTime(params.fifthFreq, now);
      const fifthGain = this.audioCtx.createGain();
      fifthGain.gain.setValueAtTime(0.28, now);
      this.oscFifth.connect(fifthGain);
      fifthGain.connect(this.filterNode);
      this.oscFifth.start(now);

      // 6. Oscilador 3: Octava Acompañante Sutil
      this.oscOctave = this.audioCtx.createOscillator();
      this.oscOctave.type = 'sine';
      this.oscOctave.frequency.setValueAtTime(params.octaveFreq, now);
      const octaveGain = this.audioCtx.createGain();
      octaveGain.gain.setValueAtTime(0.16, now);
      this.oscOctave.connect(octaveGain);
      octaveGain.connect(this.filterNode);
      this.oscOctave.start(now);

      // 7. Capa de Ruido Marrón Filtrado (Lluvia de fondo para aislamiento mental)
      const noiseBuffer = this.createBrownNoiseBuffer();
      if (noiseBuffer) {
        this.noiseSource = this.audioCtx.createBufferSource();
        this.noiseSource.buffer = noiseBuffer;
        this.noiseSource.loop = true;

        const noiseFilter = this.audioCtx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(420, now);

        const noiseGain = this.audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.035, now);

        this.noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterAtmosphereGain);
        this.noiseSource.start(now);
      }

      this.isAtmospherePlaying = true;
    } catch (e) {
      console.warn('[Aether Audio] Error al iniciar atmósfera:', e);
    }
  }

  /**
   * Actualiza suavemente las frecuencias fundamentales si el título cambia.
   * Realiza un glissando/crossfade armónico continuo de 3.5 segundos sin cortes.
   */
  public updateAtmosphereSeed(newTitle: string): void {
    if (!this.isAtmospherePlaying || !this.audioCtx) return;
    if (newTitle.trim() === this.currentSeedTitle.trim()) return;

    this.currentSeedTitle = newTitle;
    const params = this.deriveHarmonicParameters(newTitle);
    const now = this.audioCtx.currentTime;
    const glideDuration = 3.5;

    try {
      if (this.oscRoot) {
        this.oscRoot.frequency.cancelScheduledValues(now);
        this.oscRoot.frequency.exponentialRampToValueAtTime(params.rootFreq, now + glideDuration);
      }
      if (this.oscFifth) {
        this.oscFifth.frequency.cancelScheduledValues(now);
        this.oscFifth.frequency.exponentialRampToValueAtTime(params.fifthFreq, now + glideDuration);
      }
      if (this.oscOctave) {
        this.oscOctave.frequency.cancelScheduledValues(now);
        this.oscOctave.frequency.exponentialRampToValueAtTime(params.octaveFreq, now + glideDuration);
      }
      if (this.filterNode) {
        this.filterNode.frequency.cancelScheduledValues(now);
        this.filterNode.frequency.linearRampToValueAtTime(params.filterFreq, now + glideDuration);
      }
    } catch {
      // Manejo de rampas en navegadores
    }
  }

  /**
   * Apaga la atmósfera con un Fade-Out de seda de 2.5 segundos.
   */
  public stopAtmosphere(): void {
    if (!this.isAtmospherePlaying || !this.audioCtx || !this.masterAtmosphereGain) return;

    const now = this.audioCtx.currentTime;
    const fadeOutDuration = 2.5;

    try {
      this.masterAtmosphereGain.gain.cancelScheduledValues(now);
      this.masterAtmosphereGain.gain.linearRampToValueAtTime(0.0001, now + fadeOutDuration);

      setTimeout(() => {
        try {
          this.oscRoot?.stop();
          this.oscFifth?.stop();
          this.oscOctave?.stop();
          this.lfoFilter?.stop();
          this.noiseSource?.stop();

          this.oscRoot?.disconnect();
          this.oscFifth?.disconnect();
          this.oscOctave?.disconnect();
          this.lfoFilter?.disconnect();
          this.filterNode?.disconnect();
          this.noiseSource?.disconnect();
          this.masterAtmosphereGain?.disconnect();

          this.oscRoot = null;
          this.oscFifth = null;
          this.oscOctave = null;
          this.lfoFilter = null;
          this.filterNode = null;
          this.noiseSource = null;
          this.masterAtmosphereGain = null;
          this.isAtmospherePlaying = false;
        } catch {}
      }, fadeOutDuration * 1000 + 50);
    } catch {
      this.isAtmospherePlaying = false;
    }
  }

  /**
   * Alterna el paisaje sonoro continuo.
   */
  public async toggleAtmosphere(title: string = ''): Promise<boolean> {
    if (this.isAtmospherePlaying) {
      this.stopAtmosphere();
      return false;
    } else {
      await this.startAtmosphere(title);
      return true;
    }
  }

  public isPlayingAtmosphere(): boolean {
    return this.isAtmospherePlaying;
  }
}
