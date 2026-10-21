import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSfxConfig,
  ProceduralAudioEngine,
  SoundConfig
} from '../src/audio/ProceduralAudioEngine';
import type { GameDefinition, AudioDefinition, AudioSfxConfig } from '@nemesis/shared';

// Web Audio API Mocks for unit testing
class MockAudioParam {
  value: number;
  setValueAtTime = vi.fn((val: number, _time: number) => {
    this.value = val;
  });
  linearRampToValueAtTime = vi.fn((val: number, _time: number) => {
    this.value = val;
  });
  exponentialRampToValueAtTime = vi.fn((val: number, _time: number) => {
    this.value = val;
  });
  constructor(initial = 1) {
    this.value = initial;
  }
}

class MockGainNode {
  gain = new MockAudioParam(1);
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockOscillatorNode {
  type: OscillatorType = 'sine';
  frequency = new MockAudioParam(440);
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}

class MockAudioContext {
  state: AudioContextState = 'suspended';
  currentTime: number = 0;
  destination = {};
  createdGains: MockGainNode[] = [];
  createdOscillators: MockOscillatorNode[] = [];

  createGain = vi.fn(() => {
    const gain = new MockGainNode();
    this.createdGains.push(gain);
    return gain as unknown as GainNode;
  });

  createOscillator = vi.fn(() => {
    const osc = new MockOscillatorNode();
    this.createdOscillators.push(osc);
    return osc as unknown as OscillatorNode;
  });

  resume = vi.fn().mockImplementation(async () => {
    this.state = 'running';
  });

  close = vi.fn().mockImplementation(async () => {
    this.state = 'closed';
  });
}

describe('ProceduralAudioEngine & getSfxConfig', () => {
  describe('getSfxConfig()', () => {
    it('provides retro oscillator parameters for each sound event', () => {
      const attackSfx = getSfxConfig('ATTACK');
      expect(attackSfx.oscillatorType).toBe('sawtooth');
      expect(attackSfx.startFreq).toBeGreaterThan(attackSfx.endFreq); // frequency drop
      expect(attackSfx.duration).toBeLessThanOrEqual(0.3);

      const victorySfx = getSfxConfig('VICTORY');
      expect(victorySfx.notes.length).toBeGreaterThanOrEqual(4);
    });

    it('returns crisp square-wave blip for SELECT', () => {
      const selectSfx = getSfxConfig('SELECT');
      expect(selectSfx.oscillatorType).toBe('square');
      expect(selectSfx.duration).toBeLessThanOrEqual(0.15);
      expect(selectSfx.startFreq).toBeGreaterThan(0);
      expect(selectSfx.endFreq).toBeGreaterThan(0);
    });

    it('returns magical crystalline chime for MAGIC', () => {
      const magicSfx = getSfxConfig('MAGIC');
      expect(magicSfx.oscillatorType).toBe('sine');
      expect(magicSfx.notes.length).toBeGreaterThanOrEqual(3);
      expect(magicSfx.duration).toBeGreaterThan(0.2);
    });

    it('falls back gracefully on unknown event types', () => {
      const unknownSfx = getSfxConfig('UNKNOWN_EXPLOSION');
      expect(unknownSfx.oscillatorType).toBe('square');
      expect(unknownSfx.duration).toBeGreaterThan(0);
      expect(unknownSfx.startFreq).toBeGreaterThan(0);
    });

    it('merges GDS custom overrides with case-insensitivity', () => {
      const gdsAudio: AudioDefinition = {
        sfx: {
          attack: {
            oscillatorType: 'square',
            startFreq: 500,
            endFreq: 150
          }
        }
      };

      const customAttack = getSfxConfig('ATTACK', gdsAudio);
      expect(customAttack.oscillatorType).toBe('square');
      expect(customAttack.startFreq).toBe(500);
      expect(customAttack.endFreq).toBe(150);
      // Duration kept from default preset
      expect(customAttack.duration).toBeLessThanOrEqual(0.3);
    });

    it('handles direct Record<string, AudioSfxConfig> override input', () => {
      const directRecord: Record<string, AudioSfxConfig> = {
        VICTORY: {
          oscillatorType: 'sine',
          notes: [440, 554, 659, 880, 1108]
        }
      };

      const customVictory = getSfxConfig('VICTORY', directRecord);
      expect(customVictory.oscillatorType).toBe('sine');
      expect(customVictory.notes.length).toBe(5);
    });
  });

  describe('ProceduralAudioEngine in headless / Node environment', () => {
    it('instantiates and operates safely without window or AudioContext (Review Focus #5)', () => {
      const engine = new ProceduralAudioEngine(undefined, { audioContext: null, autoUnlock: false });
      expect(engine.getAudioContext()).toBeNull();
      expect(engine.isUnlocked()).toBe(true);

      // Methods must not throw in headless / no-audio environments
      expect(() => engine.playSfx('ATTACK')).not.toThrow();
      expect(() => engine.playSfx('SELECT')).not.toThrow();
      expect(() => engine.startBgm('overworld')).not.toThrow();
      expect(() => engine.stopBgm()).not.toThrow();
      expect(() => engine.setMasterVolume(0.5)).not.toThrow();
      expect(() => engine.destroy()).not.toThrow();
    });
  });

  describe('ProceduralAudioEngine with Web Audio Graph', () => {
    let mockCtx: MockAudioContext;
    let engine: ProceduralAudioEngine;

    beforeEach(() => {
      mockCtx = new MockAudioContext();
      engine = new ProceduralAudioEngine(undefined, {
        audioContext: mockCtx as unknown as AudioContext,
        volume: 0.5,
        sfxVolume: 0.8,
        bgmVolume: 0.3,
        autoUnlock: false
      });
    });

    afterEach(() => {
      engine.destroy();
    });

    it('constructs master, sfx, and bgm gain nodes and routes to destination', () => {
      expect(mockCtx.createGain).toHaveBeenCalledTimes(3);
      const [masterGain, sfxGain, bgmGain] = mockCtx.createdGains;

      expect(sfxGain.connect).toHaveBeenCalledWith(masterGain);
      expect(bgmGain.connect).toHaveBeenCalledWith(masterGain);
      expect(masterGain.connect).toHaveBeenCalledWith(mockCtx.destination);
    });

    it('plays ATTACK SFX with sawtooth wave and frequency pitch drop', () => {
      engine.playSfx('ATTACK');

      expect(mockCtx.createOscillator).toHaveBeenCalled();
      const osc = mockCtx.createdOscillators[0];
      const gain = mockCtx.createdGains[3]; // 4th gain node created

      expect(osc.type).toBe('sawtooth');
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(360, 0);
      expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalled();

      // Gain envelope attack and decay
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 0);
      expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalled();
      expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalled();

      expect(osc.connect).toHaveBeenCalledWith(gain);
      expect(osc.start).toHaveBeenCalledWith(0);
      expect(osc.stop).toHaveBeenCalled();
    });

    it('plays VICTORY fanfare stepping through each note frequency', () => {
      engine.playSfx('VICTORY');

      const osc = mockCtx.createdOscillators[0];
      expect(osc.type).toBe('triangle');

      // Fanfare notes should be scheduled
      const victoryCfg = getSfxConfig('VICTORY');
      victoryCfg.notes.forEach((freq) => {
        expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(freq, expect.any(Number));
      });
    });

    it('adjusts volume and handles mute states properly', () => {
      expect(engine.getMasterVolume()).toBe(0.5);
      expect(engine.isMuted()).toBe(false);

      engine.setMasterVolume(0.9);
      expect(engine.getMasterVolume()).toBe(0.9);
      expect(mockCtx.createdGains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.9, 0);

      engine.setMuted(true);
      expect(engine.isMuted()).toBe(true);
      expect(mockCtx.createdGains[0].gain.setValueAtTime).toHaveBeenCalledWith(0, 0);

      engine.setMuted(false);
      expect(engine.isMuted()).toBe(false);
      expect(mockCtx.createdGains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.9, 0);
    });

    it('starts and stops chiptune background arpeggio music loop', () => {
      vi.useFakeTimers();

      expect(engine.isPlayingBgm()).toBe(false);
      engine.startBgm('overworld');
      expect(engine.isPlayingBgm()).toBe(true);
      expect(engine.getCurrentBgmTheme()).toBe('overworld');

      // Advance timers to trigger arpeggiator step notes
      vi.advanceTimersByTime(400);
      expect(mockCtx.createOscillator).toHaveBeenCalled();

      engine.stopBgm();
      expect(engine.isPlayingBgm()).toBe(false);
      expect(engine.getCurrentBgmTheme()).toBeNull();

      vi.useRealTimers();
    });

    it('switches themes seamlessly if startBgm is called while already playing', () => {
      vi.useFakeTimers();

      engine.startBgm('peaceful');
      expect(engine.getCurrentBgmTheme()).toBe('peaceful');

      engine.startBgm('combat');
      expect(engine.getCurrentBgmTheme()).toBe('combat');
      expect(engine.isPlayingBgm()).toBe(true);

      engine.stopBgm();
      expect(engine.isPlayingBgm()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('Autoplay Unlocking (Review Focus #5)', () => {
    it('attaches window interaction listeners and unlocks on gesture', async () => {
      const mockCtx = new MockAudioContext();
      mockCtx.state = 'suspended';

      const listeners: Record<string, EventListener> = {};
      const fakeTarget = {
        addEventListener: vi.fn((event: string, handler: EventListener) => {
          listeners[event] = handler;
        }),
        removeEventListener: vi.fn((event: string) => {
          delete listeners[event];
        })
      };

      // Mock global window and document
      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = {
        document: fakeTarget,
        addEventListener: fakeTarget.addEventListener,
        removeEventListener: fakeTarget.removeEventListener
      };

      try {
        const engine = new ProceduralAudioEngine(undefined, {
          audioContext: mockCtx as unknown as AudioContext,
          autoUnlock: true
        });

        expect(fakeTarget.addEventListener).toHaveBeenCalledWith('click', expect.any(Function), expect.any(Object));
        expect(fakeTarget.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), expect.any(Object));

        // Simulate user clicking
        await engine.unlock();
        expect(mockCtx.resume).toHaveBeenCalled();
        expect(mockCtx.state).toBe('running');
        expect(engine.isUnlocked()).toBe(true);

        // Listeners should be cleaned up after unlocking
        expect(fakeTarget.removeEventListener).toHaveBeenCalled();

        engine.destroy();
      } finally {
        (globalThis as any).window = originalWindow;
      }
    });

    it('resumes suspended context when playSfx is called on user interaction', () => {
      const mockCtx = new MockAudioContext();
      mockCtx.state = 'suspended';

      const engine = new ProceduralAudioEngine(undefined, {
        audioContext: mockCtx as unknown as AudioContext,
        autoUnlock: false
      });

      engine.playSfx('SELECT');
      expect(mockCtx.resume).toHaveBeenCalled();

      engine.destroy();
    });
  });
});
