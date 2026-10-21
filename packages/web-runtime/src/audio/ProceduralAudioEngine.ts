import type { AudioDefinition, AudioSfxConfig, GameDefinition } from '@nemesis/shared';

export type SfxEventType = 'SELECT' | 'ATTACK' | 'MAGIC' | 'VICTORY' | string;

export interface SoundConfig {
  oscillatorType: OscillatorType;
  startFreq: number;
  endFreq: number;
  duration: number;
  notes: number[];
}

export interface ProceduralAudioEngineOptions {
  audioContext?: AudioContext | null;
  volume?: number;
  sfxVolume?: number;
  bgmVolume?: number;
  muted?: boolean;
  autoUnlock?: boolean;
}

/**
 * Default retro chiptune presets for standard JRPG sound effects.
 */
const DEFAULT_SFX_PRESETS: Record<string, SoundConfig> = {
  ATTACK: {
    oscillatorType: 'sawtooth',
    startFreq: 360,
    endFreq: 70,
    duration: 0.18,
    notes: []
  },
  VICTORY: {
    oscillatorType: 'triangle',
    startFreq: 523.25,
    endFreq: 1046.50,
    duration: 0.65,
    notes: [523.25, 659.25, 783.99, 1046.50] // C5 - E5 - G5 - C6 fanfare
  },
  SELECT: {
    oscillatorType: 'square',
    startFreq: 440,
    endFreq: 880,
    duration: 0.08,
    notes: [440, 880]
  },
  MAGIC: {
    oscillatorType: 'sine',
    startFreq: 330,
    endFreq: 990,
    duration: 0.32,
    notes: [392.00, 523.25, 659.25, 783.99, 1046.50]
  }
};

const FALLBACK_PRESET: SoundConfig = {
  oscillatorType: 'square',
  startFreq: 440,
  endFreq: 220,
  duration: 0.12,
  notes: []
};

/**
 * Returns retro oscillator and envelope parameters for a sound event,
 * applying optional GDS overrides if provided.
 */
export function getSfxConfig(
  type: SfxEventType,
  overrides?: AudioDefinition | Record<string, AudioSfxConfig> | null
): SoundConfig {
  const normalizedType = type.toUpperCase();
  const defaultCfg = DEFAULT_SFX_PRESETS[normalizedType] ?? FALLBACK_PRESET;

  if (!overrides) {
    return { ...defaultCfg, notes: [...defaultCfg.notes] };
  }

  // Extract SFX map from AudioDefinition or direct record
  let sfxMap: Record<string, AudioSfxConfig> | undefined;
  if ('sfx' in overrides && overrides.sfx) {
    sfxMap = overrides.sfx;
  } else if (typeof overrides === 'object') {
    sfxMap = overrides as Record<string, AudioSfxConfig>;
  }

  if (!sfxMap) {
    return { ...defaultCfg, notes: [...defaultCfg.notes] };
  }

  // Look up by original key, lowercase, or uppercase
  const custom = sfxMap[type] || sfxMap[type.toLowerCase()] || sfxMap[normalizedType];

  if (!custom) {
    return { ...defaultCfg, notes: [...defaultCfg.notes] };
  }

  return {
    oscillatorType: custom.oscillatorType ?? defaultCfg.oscillatorType,
    startFreq: custom.startFreq ?? defaultCfg.startFreq,
    endFreq: custom.endFreq ?? defaultCfg.endFreq,
    duration: custom.duration ?? defaultCfg.duration,
    notes: custom.notes ? [...custom.notes] : [...defaultCfg.notes]
  };
}

/**
 * Procedural Web Audio Synthesizer Engine
 * Synthesizes retro chiptune sound effects and looping background arpeggios
 * entirely at runtime without any external audio asset files.
 */
export class ProceduralAudioEngine {
  private gds?: GameDefinition;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;

  private masterVolume: number = 0.4;
  private sfxVolume: number = 0.8;
  private bgmVolume: number = 0.35;
  private muted: boolean = false;

  private isBgmPlaying: boolean = false;
  private currentBgmTheme: string | null = null;
  private bgmIntervalId: ReturnType<typeof setInterval> | null = null;
  private activeBgmOscillators: OscillatorNode[] = [];

  private unlockListeners: Array<{ target: EventTarget; event: string; handler: EventListener }> = [];
  private isUnlockedState: boolean = false;

  constructor(gds?: GameDefinition, options: ProceduralAudioEngineOptions = {}) {
    this.gds = gds;

    if (options.volume !== undefined) this.masterVolume = Math.max(0, Math.min(1, options.volume));
    if (options.sfxVolume !== undefined) this.sfxVolume = Math.max(0, Math.min(1, options.sfxVolume));
    if (options.bgmVolume !== undefined) this.bgmVolume = Math.max(0, Math.min(1, options.bgmVolume));
    if (options.muted !== undefined) this.muted = options.muted;

    // 1. Initialize or inject AudioContext (safely guarded for Node / SSR / test environments)
    this.initAudioContext(options.audioContext);

    // 2. Set up autoplay unlock listeners if in browser environment
    if (options.autoUnlock !== false) {
      this.setupAutoplayUnlock();
    }
  }

  /**
   * Initializes Web Audio Context and audio graph nodes safely.
   */
  private initAudioContext(injectedContext?: AudioContext | null): void {
    if (injectedContext !== undefined) {
      this.audioContext = injectedContext;
    } else if (typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.audioContext = new AudioCtx();
        } catch {
          this.audioContext = null;
        }
      }
    } else if (typeof AudioContext !== 'undefined') {
      try {
        this.audioContext = new AudioContext();
      } catch {
        this.audioContext = null;
      }
    }

    if (!this.audioContext) {
      return;
    }

    try {
      this.masterGain = this.audioContext.createGain();
      this.sfxGain = this.audioContext.createGain();
      this.bgmGain = this.audioContext.createGain();

      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, this.audioContext.currentTime);
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.audioContext.currentTime);
      this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.audioContext.currentTime);

      this.sfxGain.connect(this.masterGain);
      this.bgmGain.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);

      if (this.audioContext.state === 'running') {
        this.isUnlockedState = true;
      }
    } catch {
      // Graceful fallback for incomplete mocks
    }
  }

  /**
   * Review Focus #5:
   * Gracefully handles browser autoplay restrictions by unlocking AudioContext
   * on first user interaction (click, keydown, touchstart, pointerdown).
   */
  private setupAutoplayUnlock(): void {
    if (!this.audioContext || typeof window === 'undefined') {
      return;
    }

    if (this.audioContext.state === 'running') {
      this.isUnlockedState = true;
      return;
    }

    const unlockHandler: EventListener = () => {
      this.unlock().catch(() => {});
    };

    const target: EventTarget = window.document ?? window;
    const events = ['click', 'keydown', 'touchstart', 'pointerdown'];

    events.forEach((event) => {
      try {
        target.addEventListener(event, unlockHandler, { once: true, passive: true });
        this.unlockListeners.push({ target, event, handler: unlockHandler });
      } catch {
        // Fallback for environments lacking addEventListener options
        target.addEventListener(event, unlockHandler);
        this.unlockListeners.push({ target, event, handler: unlockHandler });
      }
    });
  }

  /**
   * Unlocks and resumes the audio context. Safe to call multiple times or manually from UI buttons.
   */
  public async unlock(): Promise<boolean> {
    if (!this.audioContext) {
      return false;
    }

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      if (this.audioContext.state === 'running') {
        this.isUnlockedState = true;
        this.cleanupUnlockListeners();
        return true;
      }
    } catch {
      // Ignored if browser blocks resume before actual user gesture
    }

    return this.isUnlockedState;
  }

  /**
   * Convenience alias for unlock()
   */
  public async resume(): Promise<void> {
    await this.unlock();
  }

  private cleanupUnlockListeners(): void {
    this.unlockListeners.forEach(({ target, event, handler }) => {
      try {
        target.removeEventListener(event, handler);
      } catch {
        // Ignore removal errors
      }
    });
    this.unlockListeners = [];
  }

  public isUnlocked(): boolean {
    if (!this.audioContext) return true;
    return this.audioContext.state === 'running' || this.isUnlockedState;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Plays a procedural retro sound effect using an OscillatorNode and Gain envelope.
   */
  public playSfx(type: SfxEventType, customOverrides?: Partial<AudioSfxConfig>): void {
    if (!this.audioContext || !this.sfxGain || this.muted) {
      return;
    }

    // Auto-resume if suspended and user triggered an action
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    const baseConfig = getSfxConfig(type, this.gds?.audio);
    const config: SoundConfig = {
      oscillatorType: customOverrides?.oscillatorType ?? baseConfig.oscillatorType,
      startFreq: customOverrides?.startFreq ?? baseConfig.startFreq,
      endFreq: customOverrides?.endFreq ?? baseConfig.endFreq,
      duration: customOverrides?.duration ?? baseConfig.duration,
      notes: customOverrides?.notes ? [...customOverrides.notes] : [...baseConfig.notes]
    };

    try {
      const now = this.audioContext.currentTime;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = config.oscillatorType;

      // Note sequence or single tone pitch bend
      if (config.notes && config.notes.length > 0) {
        const stepTime = config.duration / config.notes.length;
        config.notes.forEach((freq, idx) => {
          osc.frequency.setValueAtTime(freq, now + idx * stepTime);
        });
      } else {
        osc.frequency.setValueAtTime(config.startFreq, now);
        if (config.endFreq > 0) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, config.endFreq), now + config.duration);
        } else {
          osc.frequency.linearRampToValueAtTime(config.endFreq, now + config.duration);
        }
      }

      // Attack & decay gain envelope to prevent clicking
      const attackDuration = Math.min(0.015, config.duration * 0.15);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(1.0, now + attackDuration);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + config.duration + 0.05);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // Ignore disconnection cleanup
        }
      };
    } catch {
      // Audio graph creation guarded against mock or disconnected context errors
    }
  }

  /**
   * Starts a procedural chiptune background arpeggio loop based on theme.
   */
  public startBgm(themeOverride?: string): void {
    if (!this.audioContext || !this.bgmGain) {
      return;
    }

    if (this.isBgmPlaying) {
      this.stopBgm();
    }

    const theme = (
      themeOverride ??
      this.gds?.audio?.bgmTheme ??
      this.gds?.world?.theme ??
      'overworld'
    ).toLowerCase();

    this.currentBgmTheme = theme;
    this.isBgmPlaying = true;

    // Select procedural arpeggio chords based on theme
    const chords = this.getBgmChordsForTheme(theme);
    let chordIndex = 0;
    let noteIndex = 0;

    const stepMs = theme.includes('battle') || theme.includes('combat') ? 130 : 180;

    this.bgmIntervalId = setInterval(() => {
      if (!this.audioContext || !this.bgmGain || this.muted || !this.isBgmPlaying) {
        return;
      }

      const chord = chords[chordIndex];
      const freq = chord[noteIndex % chord.length];

      this.playBgmChiptuneNote(freq, (stepMs / 1000) * 0.9, theme);

      noteIndex++;
      if (noteIndex >= chord.length) {
        noteIndex = 0;
        chordIndex = (chordIndex + 1) % chords.length;
      }
    }, stepMs);
  }

  private playBgmChiptuneNote(frequency: number, duration: number, theme: string): void {
    if (!this.audioContext || !this.bgmGain) return;

    try {
      const now = this.audioContext.currentTime;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      // Theme-specific waveform
      if (theme.includes('battle') || theme.includes('boss')) {
        osc.type = 'sawtooth';
      } else if (theme.includes('cyber') || theme.includes('dungeon')) {
        osc.type = 'square';
      } else {
        osc.type = 'triangle';
      }

      osc.frequency.setValueAtTime(frequency, now);

      // Short punchy 8-bit pluck envelope
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.bgmGain);

      this.activeBgmOscillators.push(osc);

      osc.start(now);
      osc.stop(now + duration);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
          const idx = this.activeBgmOscillators.indexOf(osc);
          if (idx !== -1) {
            this.activeBgmOscillators.splice(idx, 1);
          }
        } catch {
          // Ignore cleanup
        }
      };
    } catch {
      // Guarded against mock timing errors
    }
  }

  private getBgmChordsForTheme(theme: string): number[][] {
    if (theme.includes('battle') || theme.includes('combat') || theme.includes('boss')) {
      // Energetic minor chord progression (Em - C - D - B)
      return [
        [164.81, 196.00, 246.94, 329.63], // Em
        [130.81, 164.81, 196.00, 261.63], // C
        [146.83, 185.00, 220.00, 293.66], // D
        [123.47, 155.56, 185.00, 246.94]  // B
      ];
    }

    if (theme.includes('cyber') || theme.includes('sci-fi') || theme.includes('neon')) {
      // Synthwave minor arpeggios (Am - F - Dm - E)
      return [
        [220.00, 261.63, 329.63, 440.00], // Am
        [174.61, 220.00, 261.63, 349.23], // F
        [146.83, 174.61, 220.00, 293.66], // Dm
        [164.81, 207.65, 246.94, 329.63]  // E
      ];
    }

    // Classic peaceful / adventure JRPG overworld progression (C - Am - F - G)
    return [
      [261.63, 329.63, 392.00, 523.25], // C major
      [220.00, 261.63, 329.63, 440.00], // A minor
      [174.61, 220.00, 261.63, 349.23], // F major
      [196.00, 246.94, 293.66, 392.00]  // G major
    ];
  }

  /**
   * Stops the ongoing procedural chiptune background music.
   */
  public stopBgm(): void {
    if (this.bgmIntervalId !== null) {
      clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }

    this.activeBgmOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore stop errors on already completed oscillators
      }
    });
    this.activeBgmOscillators = [];

    this.isBgmPlaying = false;
    this.currentBgmTheme = null;
  }

  public isPlayingBgm(): boolean {
    return this.isBgmPlaying;
  }

  public getCurrentBgmTheme(): string | null {
    return this.currentBgmTheme;
  }

  // Volume & Mute Controls
  public setMasterVolume(val: number): void {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.audioContext && !this.muted) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.audioContext.currentTime);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setSfxVolume(val: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGain && this.audioContext) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.audioContext.currentTime);
    }
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public setBgmVolume(val: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, val));
    if (this.bgmGain && this.audioContext) {
      this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.audioContext.currentTime);
    }
  }

  public getBgmVolume(): number {
    return this.bgmVolume;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, this.audioContext.currentTime);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Destroys the audio engine, cleaning up active timers, event listeners, and closing the context.
   */
  public destroy(): void {
    this.stopBgm();
    this.cleanupUnlockListeners();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close().catch(() => {});
      } catch {
        // Ignore close errors
      }
    }

    this.audioContext = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;
  }
}
