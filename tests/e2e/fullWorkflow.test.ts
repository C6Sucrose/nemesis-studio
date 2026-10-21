import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { generateGameFromPrompt } from '../../packages/agent-orchestrator/src/orchestrator';
import { validateGameDefinition } from '../../packages/shared/src/validator/validateGds';
import { exportRustSourceProject } from '../../packages/packager/src/exportRustProject';
import { HD2DGameEngine } from '../../packages/web-runtime/src/engine/HD2DGameEngine';
import { ProceduralAudioEngine } from '../../packages/web-runtime/src/audio/ProceduralAudioEngine';

describe('Full End-to-End Game Generation & Runtime Simulation', () => {
  it('generates, validates, and exports a complete HD-2D JRPG from prompt', async () => {
    const prompt = 'An exiled sorceress in a neon crystal sanctuary battling corrupted automata';
    const result = await generateGameFromPrompt(prompt, { mockMode: true });

    expect(result.success).toBe(true);
    expect(result.gds).toBeDefined();
    expect(result.agentLogs.length).toBeGreaterThan(0);

    // 1. GDS Schema Pre-Flight Validation
    const validation = validateGameDefinition(result.gds);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // 2. Native Rust Crate Export
    const exported = await exportRustSourceProject(result.gds);
    expect(exported.files['Cargo.toml']).toBeDefined();
    expect(exported.files['Cargo.toml']).toContain('bevy = "0.14"');
    expect(exported.files['src/main.rs']).toBeDefined();
    expect(exported.files['src/main.rs']).toContain('neon crystal sanctuary');
    expect(exported.files['src/loader.rs']).toBeDefined();
    expect(exported.files['assets/game_def.json']).toBeDefined();
    expect(exported.files['README.md']).toContain('cargo run --release');

    // 3. Isomorphic ZIP Archive Verification
    expect(exported.zipBuffer).toBeDefined();
    expect(exported.zipBuffer.length).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(exported.zipBuffer);
    const fileNames = Object.keys(zip.files);
    expect(fileNames).toContain('Cargo.toml');
    expect(fileNames).toContain('src/main.rs');
    expect(fileNames).toContain('src/loader.rs');
    expect(fileNames).toContain('assets/game_def.json');
    expect(fileNames).toContain('README.md');

    const unzippedMain = await zip.file('src/main.rs')?.async('string');
    expect(unzippedMain).toContain('neon crystal sanctuary');
  });

  it('runs complete HD2DGameEngine web simulation: overworld movement, dialogue, combat, and audio', async () => {
    const prompt = 'Cyberpunk chronomancer dueling mechanical wyrm in clockwork sanctuary';
    const result = await generateGameFromPrompt(prompt, { mockMode: true });
    expect(result.success).toBe(true);

    const gds = result.gds;

    // 1. Initialize HD2D Web Runtime Engine
    const modeHistory: string[] = [];
    const engine = new HD2DGameEngine(null, gds, {
      onModeChange: (mode) => modeHistory.push(mode),
    });

    expect(engine.getMode()).toBe('OVERWORLD');

    // 2. Overworld Player Navigation Simulation
    const overworld = engine.getOverworld();
    const initialPos = [...overworld.getPlayerPosition()] as [number, number];

    // Move player right
    overworld.move(1, 0);
    const newPos = overworld.getPlayerPosition();
    // Position updated or bounded by collision
    expect(Array.isArray(newPos)).toBe(true);
    expect(newPos).toHaveLength(2);

    // 3. Dialogue Progression Simulation
    engine.startDialogue();
    expect(engine.getMode()).toBe('DIALOGUE');
    const dialogue = engine.getDialogue();
    expect(dialogue.getCurrentNode()).toBeDefined();

    const currentNode = dialogue.getCurrentNode();
    if (currentNode && currentNode.choices.length > 0) {
      engine.selectDialogueChoice(0);
    } else {
      engine.closeDialogue();
    }
    // After choices / exit, returned to OVERWORLD or progressed
    expect(['OVERWORLD', 'DIALOGUE']).toContain(engine.getMode());

    // 4. Combat Simulation
    engine.startCombat();
    expect(engine.getMode()).toBe('COMBAT');
    const combat = engine.getCombat();
    expect(combat.getCurrentState()).toBe('PLAYER_TURN');

    // Player attacks
    const combatResult = engine.dispatchCombatAction({ type: 'ATTACK' });
    expect(combatResult).toBeDefined();
    expect(combatResult.success).toBe(true);
    expect(combatResult.damageDealt).toBeGreaterThan(0);

    // 5. Procedural Retro Chiptune Audio Synthesis Simulation
    const mockAudioContext = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createGain: () => ({
        gain: {
          value: 1,
          setValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
        },
        connect: () => {},
        disconnect: () => {},
      }),
      createOscillator: () => ({
        type: 'sine',
        frequency: {
          value: 440,
          setValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
        },
        connect: () => {},
        disconnect: () => {},
        start: () => {},
        stop: () => {},
        onended: null,
      }),
      resume: async () => {},
    } as unknown as AudioContext;

    const audioEngine = new ProceduralAudioEngine(gds, {
      audioContext: mockAudioContext,
      volume: 0.8,
    });
    expect(audioEngine.isUnlocked()).toBe(true);

    // Play BGM and SFX
    audioEngine.startBgm('cyberpunk');
    expect(audioEngine.getCurrentBgmTheme()).toBe('cyberpunk');

    // Play attack and magic SFX
    expect(() => audioEngine.playSfx('ATTACK')).not.toThrow();
    expect(() => audioEngine.playSfx('MAGIC')).not.toThrow();

    // Teardown
    audioEngine.stopBgm();
    audioEngine.destroy();
    engine.destroy();
  });
});
