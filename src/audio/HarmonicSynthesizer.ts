/**
 * ============================================================================
 * SISTEMA SENSORIAL: MOTOR ACÚSTICO ORGÁNICO Y PROCEDURAL (WEB AUDIO API)
 * ============================================================================
 * Genera paisajes sonoros de naturaleza para el enfoque profundo (Monastic Focus):
 * - 100% nativo en Web Audio API (0 KB de descargas, cero latencia).
 * - CERO osciladores estridentes o melodías distractoras.
 * - 4 Paisajes Mentales Orgánicos:
 *   1. Ruido Marrón Profundo (Brownian 1/f² con oleaje infrasónico).
 *   2. Lluvia Serena (Textura fractal suave contra el cristal).
 *   3. Gotas de Manantial Zen (Resonancias Minnaert estocásticas en distribución de Poisson).
 *   4. Santuario Pleno (Combinación armónica de los tres lechos naturales).
 * - Control cíclico secuencial o aleatorio mediante el botón único 'Acústica'.
 */

export type NatureLandscape = 'brown_noise' | 'rain' | 'drops' | 'sanctuary';

export interface LandscapeInfo {
  id: NatureLandscape;
  label: string;
  description: string;
  icon: string;
}

export const NATURE_LANDSCAPES: LandscapeInfo[] = [
  {
    id: 'brown_noise',
    label: 'Ruido Marrón',
    description: 'Lecho profundo y cálido de aislamiento cognitivo',
    icon: '🌊'
  },
  {
    id: 'rain',
    label: 'Lluvia Serena',
    description: 'Precipitación suave contra el cristal',
    icon: '🌧️'
  },
  {
    id: 'drops',
    label: 'Gotas de Agua',
    description: 'Manantial zen con resonancias líquidas estocásticas',
    icon: '💧'
  },
  {
    id: 'sanctuary',
    label: 'Santuario Pleno',
    description: 'Atmósfera completa: Ruido Marrón + Lluvia + Gotas',
    icon: '🌿'
  }
];

export interface AtmosphereState {
  isPlaying: boolean;
  landscapeIndex: number;
  landscape: LandscapeInfo | null;
}

export class HarmonicSynthesizer {
  private audioCtx: AudioContext | null = null;
  private isEnabled: boolean = false;

  // Estado del Paisaje Acústico de Naturaleza
  private isAtmospherePlaying: boolean = false;
  private currentLandscapeIndex: number = -1;
  private currentSeedTitle: string = '';

  // Nodos Maestros de la Cadena de Audio
  private masterAtmosphereGain: GainNode | null = null;

  // Canal 1: Ruido Marrón Profundo
  private brownSource: AudioBufferSourceNode | null = null;
  private brownGain: GainNode | null = null;
  private brownLowpass: BiquadFilterNode | null = null;
  private brownLfo: OscillatorNode | null = null;

  // Canal 2: Lluvia Serena
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private rainBandpass: BiquadFilterNode | null = null;
  private rainFlutterLfo: OscillatorNode | null = null;

  // Canal 3: Gotas de Agua Estocásticas (Manantial)
  private dropsGain: GainNode | null = null;
  private dropTimer: number | null = null;

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
      this.play(432, 'sine', 0.8, 0.12);
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
   * Chime armónico discreto para transiciones táctiles y clics de interfaz.
   */
  public play(
    freq: number,
    type: OscillatorType = 'sine',
    duration: number = 0.5,
    gainVal: number = 0.1
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
    } catch {}
  }

  // ==========================================================================
  // SÍNTESIS PROCEDURAL ORGÁNICA (BROWN NOISE, LLUVIA Y GOTAS)
  // ==========================================================================

  /**
   * Genera un búfer estéreo de Ruido Marrón genuino ($1/f^2$) en bucle continuo de 10 segundos.
   */
  private createBrownNoiseBuffer(): AudioBuffer | null {
    if (!this.audioCtx) return null;
    const sampleRate = this.audioCtx.sampleRate;
    const bufferSize = sampleRate * 10;
    const buffer = this.audioCtx.createBuffer(2, bufferSize, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    let lastL = 0.0;
    let lastR = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const whiteL = Math.random() * 2 - 1;
      const whiteR = Math.random() * 2 - 1;

      // Integración browniana suave
      lastL = (lastL + 0.02 * whiteL) / 1.02;
      lastR = (lastR + 0.02 * whiteR) / 1.02;

      left[i] = lastL * 3.4;
      right[i] = lastR * 3.4;
    }
    return buffer;
  }

  /**
   * Genera un búfer estéreo de Ruido Rosa suave (textura fractal para lluvia) de 8 segundos.
   */
  private createRainNoiseBuffer(): AudioBuffer | null {
    if (!this.audioCtx) return null;
    const sampleRate = this.audioCtx.sampleRate;
    const bufferSize = sampleRate * 8;
    const buffer = this.audioCtx.createBuffer(2, bufferSize, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    // Algoritmo de filtrado de Paul Kellet para -3 dB/octava
    let b0L = 0, b1L = 0, b2L = 0, b3L = 0, b4L = 0, b5L = 0, b6L = 0;
    let b0R = 0, b1R = 0, b2R = 0, b3R = 0, b4R = 0, b5R = 0, b6R = 0;

    for (let i = 0; i < bufferSize; i++) {
      const whiteL = Math.random() * 2 - 1;
      const whiteR = Math.random() * 2 - 1;

      b0L = 0.99886 * b0L + whiteL * 0.0555179;
      b1L = 0.99332 * b1L + whiteL * 0.0750759;
      b2L = 0.96900 * b2L + whiteL * 0.1538520;
      b3L = 0.86650 * b3L + whiteL * 0.3104856;
      b4L = 0.55000 * b4L + whiteL * 0.5329522;
      b5L = -0.7616 * b5L - whiteL * 0.0168980;
      left[i] = (b0L + b1L + b2L + b3L + b4L + b5L + b6L + whiteL * 0.5362) * 0.05;
      b6L = whiteL * 0.115926;

      b0R = 0.99886 * b0R + whiteR * 0.0555179;
      b1R = 0.99332 * b1R + whiteR * 0.0750759;
      b2R = 0.96900 * b2R + whiteR * 0.1538520;
      b3R = 0.86650 * b3R + whiteR * 0.3104856;
      b4R = 0.55000 * b4R + whiteR * 0.5329522;
      b5R = -0.7616 * b5R - whiteR * 0.0168980;
      right[i] = (b0R + b1R + b2R + b3R + b4R + b5R + b6R + whiteR * 0.5362) * 0.05;
      b6R = whiteR * 0.115926;
    }
    return buffer;
  }

  /**
   * Dispara una resonancia esférica de gota de agua física (Minnaert bubble droplet).
   */
  private playWaterDrop(): void {
    if (!this.audioCtx || !this.dropsGain || !this.isAtmospherePlaying) return;
    const now = this.audioCtx.currentTime;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const filter = this.audioCtx.createBiquadFilter();

      // Frecuencias orgánicas del agua limpia (750 Hz a 1350 Hz)
      const baseFreq = 750 + Math.random() * 600;
      osc.type = 'sine';

      // Resonancia de Minnaert: Leve modulación de tono ascendente durante el impacto (12 ms)
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.12, now + 0.015);

      // Filtro para redondear el chasquido y darle cuerpo líquido
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);

      // Envolvente de decaimiento exponencial ultra-rápida (40 ms a 70 ms)
      const dropGainVal = 0.04 + Math.random() * 0.035;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(dropGainVal, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05 + Math.random() * 0.025);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.dropsGain);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {}
  }

  /**
   * Planificador estocástico de gotas de agua mediante distribución de Poisson.
   * Evita repeticiones mecánicas y genera un flujo natural impredecible y sereno.
   */
  private scheduleNextDrop(): void {
    if (this.dropTimer) {
      window.clearTimeout(this.dropTimer);
      this.dropTimer = null;
    }

    if (!this.isAtmospherePlaying) return;
    const landscape = this.getCurrentLandscape();
    if (!landscape || (landscape.id !== 'drops' && landscape.id !== 'sanctuary')) return;

    // Intervalo aleatorio natural entre 1.4s y 4.2s
    const nextInterval = 1400 + Math.random() * 2800;

    this.dropTimer = window.setTimeout(() => {
      this.playWaterDrop();

      // ~20% de probabilidad de una segunda gota inmediata ("plop-plop")
      if (Math.random() < 0.2) {
        setTimeout(() => this.playWaterDrop(), 110 + Math.random() * 70);
      }

      this.scheduleNextDrop();
    }, nextInterval);
  }

  // ==========================================================================
  // CONTROL DE PAISAJES ACÚSTICOS (CICLO CON BOTÓN ÚNICO 'ACÚSTICA')
  // ==========================================================================

  /**
   * Avanza en secuencia por los paisajes acústicos naturales:
   * Ruido Marrón -> Lluvia Serena -> Gotas de Agua -> Santuario Pleno -> Apagado.
   */
  public async cycleAtmosphere(): Promise<AtmosphereState> {
    await this.ensureContext();
    this.isEnabled = true;

    // Siguiente paisaje en la secuencia
    const nextIndex = this.currentLandscapeIndex + 1;

    if (nextIndex >= NATURE_LANDSCAPES.length) {
      // Fin del ciclo: apagar con fade-out suave
      this.stopAtmosphere();
      this.currentLandscapeIndex = -1;
      return {
        isPlaying: false,
        landscapeIndex: -1,
        landscape: null
      };
    }

    this.currentLandscapeIndex = nextIndex;
    const targetLandscape = NATURE_LANDSCAPES[nextIndex];

    if (!this.isAtmospherePlaying) {
      await this.startAtmosphereEngine();
    }

    this.applyLandscapeSettings(targetLandscape.id);

    return {
      isPlaying: true,
      landscapeIndex: this.currentLandscapeIndex,
      landscape: targetLandscape
    };
  }

  /**
   * Alterna o arranca la atmósfera (mantiene compatibilidad directa).
   */
  public async toggleAtmosphere(_title: string = ''): Promise<boolean> {
    const state = await this.cycleAtmosphere();
    return state.isPlaying;
  }

  public isPlayingAtmosphere(): boolean {
    return this.isAtmospherePlaying;
  }

  public getCurrentLandscape(): LandscapeInfo | null {
    if (this.currentLandscapeIndex >= 0 && this.currentLandscapeIndex < NATURE_LANDSCAPES.length) {
      return NATURE_LANDSCAPES[this.currentLandscapeIndex];
    }
    return null;
  }

  /**
   * Enciende el motor de audio y monta la cadena de mezcla de naturaleza.
   */
  private async startAtmosphereEngine(): Promise<void> {
    await this.ensureContext();
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    try {
      // 1. Ganancia Maestra de la Atmósfera (Fade-In suave de 2.2 segundos)
      this.masterAtmosphereGain = this.audioCtx.createGain();
      this.masterAtmosphereGain.gain.setValueAtTime(0.0001, now);
      this.masterAtmosphereGain.gain.linearRampToValueAtTime(1.0, now + 2.2);
      this.masterAtmosphereGain.connect(this.audioCtx.destination);

      // 2. Canal de Ruido Marrón
      const brownBuf = this.createBrownNoiseBuffer();
      if (brownBuf) {
        this.brownSource = this.audioCtx.createBufferSource();
        this.brownSource.buffer = brownBuf;
        this.brownSource.loop = true;

        // Filtro de corte de subgraves (< 34 Hz) y calidez (< 190 Hz)
        const subFilter = this.audioCtx.createBiquadFilter();
        subFilter.type = 'highpass';
        subFilter.frequency.setValueAtTime(34, now);

        this.brownLowpass = this.audioCtx.createBiquadFilter();
        this.brownLowpass.type = 'lowpass';
        this.brownLowpass.frequency.setValueAtTime(190, now);
        this.brownLowpass.Q.setValueAtTime(0.85, now);

        this.brownGain = this.audioCtx.createGain();
        this.brownGain.gain.setValueAtTime(0.0001, now);

        // LFO de respiración ultralenta (oleaje oceánico/respiración a 0.033 Hz)
        this.brownLfo = this.audioCtx.createOscillator();
        const lfoGain = this.audioCtx.createGain();
        this.brownLfo.frequency.setValueAtTime(0.033, now);
        lfoGain.gain.setValueAtTime(25, now);
        this.brownLfo.connect(lfoGain);
        lfoGain.connect(this.brownLowpass.frequency);
        this.brownLfo.start(now);

        this.brownSource.connect(subFilter);
        subFilter.connect(this.brownLowpass);
        this.brownLowpass.connect(this.brownGain);
        this.brownGain.connect(this.masterAtmosphereGain);

        this.brownSource.start(now);
      }

      // 3. Canal de Lluvia Serena
      const rainBuf = this.createRainNoiseBuffer();
      if (rainBuf) {
        this.rainSource = this.audioCtx.createBufferSource();
        this.rainSource.buffer = rainBuf;
        this.rainSource.loop = true;

        this.rainBandpass = this.audioCtx.createBiquadFilter();
        this.rainBandpass.type = 'bandpass';
        this.rainBandpass.frequency.setValueAtTime(1050, now);
        this.rainBandpass.Q.setValueAtTime(0.55, now);

        this.rainGain = this.audioCtx.createGain();
        this.rainGain.gain.setValueAtTime(0.0001, now);

        // Modulación suave de micro-ráfagas (flutter a 4.5 Hz)
        this.rainFlutterLfo = this.audioCtx.createOscillator();
        const flutterGain = this.audioCtx.createGain();
        this.rainFlutterLfo.frequency.setValueAtTime(4.5, now);
        flutterGain.gain.setValueAtTime(0.02, now);
        this.rainFlutterLfo.connect(flutterGain);
        flutterGain.connect(this.rainGain.gain);
        this.rainFlutterLfo.start(now);

        this.rainSource.connect(this.rainBandpass);
        this.rainBandpass.connect(this.rainGain);
        this.rainGain.connect(this.masterAtmosphereGain);

        this.rainSource.start(now);
      }

      // 4. Canal de Gotas de Agua
      this.dropsGain = this.audioCtx.createGain();
      this.dropsGain.gain.setValueAtTime(1.0, now);
      this.dropsGain.connect(this.masterAtmosphereGain);

      this.isAtmospherePlaying = true;
    } catch (e) {
      console.warn('[Aether Audio] Error al iniciar motor orgánico:', e);
    }
  }

  /**
   * Realiza un crossfade analógico suave (1.4s) hacia el paisaje seleccionado.
   */
  private applyLandscapeSettings(landscape: NatureLandscape): void {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const rampTime = 1.4;

    try {
      // 1. Niveles objetivo de ganancia por paisaje (calibrados para cero estridencia)
      let targetBrown = 0.0001;
      let targetRain = 0.0001;

      switch (landscape) {
        case 'brown_noise':
          targetBrown = 0.22;
          targetRain = 0.0001;
          break;
        case 'rain':
          targetBrown = 0.0001;
          targetRain = 0.16;
          break;
        case 'drops':
          targetBrown = 0.035; // Lecho sutil de agua para que las gotas no queden en silencio seco
          targetRain = 0.0001;
          break;
        case 'sanctuary':
          targetBrown = 0.14;
          targetRain = 0.09;
          break;
      }

      // 2. Transiciones lineales de volumen
      if (this.brownGain) {
        this.brownGain.gain.cancelScheduledValues(now);
        this.brownGain.gain.linearRampToValueAtTime(targetBrown, now + rampTime);
      }

      if (this.rainGain) {
        this.rainGain.gain.cancelScheduledValues(now);
        this.rainGain.gain.linearRampToValueAtTime(targetRain, now + rampTime);
      }

      // 3. Control del planificador de gotas
      if (landscape === 'drops' || landscape === 'sanctuary') {
        this.scheduleNextDrop();
      } else {
        if (this.dropTimer) {
          window.clearTimeout(this.dropTimer);
          this.dropTimer = null;
        }
      }
    } catch {}
  }

  /**
   * Modula sutilmente la resonancia del agua según el título de la obra (sin estridencia).
   */
  public updateAtmosphereSeed(newTitle: string): void {
    if (!this.isAtmospherePlaying || !this.audioCtx) return;
    if (newTitle.trim() === this.currentSeedTitle.trim()) return;
    this.currentSeedTitle = newTitle;

    // Modula sutilmente el centro de filtro de la lluvia entre 950 Hz y 1200 Hz
    let hash = 0;
    for (let i = 0; i < newTitle.length; i++) hash = (hash << 5) - hash + newTitle.charCodeAt(i);
    const modFreq = 950 + Math.abs(hash % 250);

    if (this.rainBandpass) {
      const now = this.audioCtx.currentTime;
      this.rainBandpass.frequency.cancelScheduledValues(now);
      this.rainBandpass.frequency.linearRampToValueAtTime(modFreq, now + 3.0);
    }
  }

  /**
   * Apaga la atmósfera con un Fade-Out de seda de 2.0 segundos.
   */
  public stopAtmosphere(): void {
    if (!this.isAtmospherePlaying || !this.audioCtx || !this.masterAtmosphereGain) {
      this.isAtmospherePlaying = false;
      this.currentLandscapeIndex = -1;
      return;
    }

    const now = this.audioCtx.currentTime;
    const fadeOutDuration = 2.0;

    if (this.dropTimer) {
      window.clearTimeout(this.dropTimer);
      this.dropTimer = null;
    }

    try {
      this.masterAtmosphereGain.gain.cancelScheduledValues(now);
      this.masterAtmosphereGain.gain.linearRampToValueAtTime(0.0001, now + fadeOutDuration);

      setTimeout(() => {
        try {
          this.brownSource?.stop();
          this.rainSource?.stop();
          this.brownLfo?.stop();
          this.rainFlutterLfo?.stop();

          this.brownSource?.disconnect();
          this.rainSource?.disconnect();
          this.brownGain?.disconnect();
          this.rainGain?.disconnect();
          this.dropsGain?.disconnect();
          this.brownLowpass?.disconnect();
          this.rainBandpass?.disconnect();
          this.masterAtmosphereGain?.disconnect();

          this.brownSource = null;
          this.rainSource = null;
          this.brownGain = null;
          this.rainGain = null;
          this.dropsGain = null;
          this.brownLowpass = null;
          this.rainBandpass = null;
          this.brownLfo = null;
          this.rainFlutterLfo = null;
          this.masterAtmosphereGain = null;
          this.isAtmospherePlaying = false;
        } catch {}
      }, fadeOutDuration * 1000 + 50);
    } catch {
      this.isAtmospherePlaying = false;
    }
  }
}
