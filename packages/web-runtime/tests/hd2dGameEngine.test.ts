import { describe, it, expect, vi } from 'vitest';
import { HD2DGameEngine } from '../src/engine/HD2DGameEngine';
import { HD2DRenderer } from '../src/engine/HD2DRenderer';
import { GameDefinition } from '@nemesis/shared';

describe('HD2DGameEngine & HD2DRenderer', () => {
  const sampleGds: GameDefinition = {
    meta: {
      title: 'Clockwork Fate',
      author: 'Nemesis Studio',
      version: '1.0.0'
    },
    world: {
      zoneName: 'Cathedral Grounds',
      gridSize: [12, 12],
      playerStart: [3, 3],
      tiles: [
        { x: 3, y: 3, type: 'cobblestone', walkable: true },
        { x: 4, y: 3, type: 'cobblestone', walkable: true }
      ],
      lights: [
        { type: 'point', position: [3, 2, 3], color: '#ffaa44', intensity: 2.0 }
      ],
      npcs: [
        { id: 'npc_guide', name: 'Guide', position: [4, 3], dialogueNodeId: 'node_intro' }
      ]
    },
    dialogue: {
      initialNodeId: 'node_intro',
      nodes: {
        node_intro: {
          speaker: 'Guide',
          text: 'Welcome to the clockwork realm.',
          choices: [
            { text: 'Let us begin.', nextNodeId: null }
          ]
        }
      }
    },
    combat: {
      player: {
        name: 'Chronomancer',
        hp: 50,
        maxHp: 50,
        mp: 20,
        maxMp: 20,
        attack: 15,
        defense: 2
      },
      enemy: {
        name: 'Slime',
        hp: 10,
        maxHp: 10,
        attack: 4,
        defense: 1
      }
    }
  };

  it('initializes HD2DRenderer with 35-degree isometric tilt angle (Review Focus #2)', () => {
    const renderer = new HD2DRenderer(sampleGds, { canvas: null });
    expect(renderer.scene).toBeDefined();
    expect(renderer.camera).toBeDefined();

    // Verify 35-degree angle setup
    expect(HD2DRenderer.ISOMETRIC_ANGLE_DEG).toBe(35);
    // Camera is elevated and positioned with isometric offset
    expect(renderer.camera.position.y).toBeGreaterThan(0);
    expect(renderer.camera.position.z).toBeGreaterThan(0);
    // When canvas is null / headless, backendType is 'mock' and doesn't crash
    expect(renderer.getBackendType()).toBe('mock');

    renderer.destroy();
  });

  it('initializes HD2DGameEngine and starts in OVERWORLD mode', () => {
    const onModeChange = vi.fn();
    const engine = new HD2DGameEngine(null, sampleGds, { onModeChange });

    expect(engine.getMode()).toBe('OVERWORLD');
    expect(engine.getOverworld().getPlayerPosition()).toEqual([3, 3]);

    engine.pause();
    expect(engine.getMode()).toBe('PAUSED');

    engine.resume();
    expect(engine.getMode()).toBe('OVERWORLD');

    engine.destroy();
  });

  it('manages combat flow and transitions back to OVERWORLD on victory', () => {
    const onCombatEnd = vi.fn();
    const engine = new HD2DGameEngine(null, sampleGds, { onCombatEnd });

    engine.startCombat();
    expect(engine.getMode()).toBe('COMBAT');

    // Attack once: 15 - 1 = 14 damage -> defeats Slime (10 HP)
    const result = engine.dispatchCombatAction({ type: 'ATTACK' });
    expect(result.success).toBe(true);
    expect(onCombatEnd).toHaveBeenCalledWith(true, false);
    expect(engine.getMode()).toBe('OVERWORLD');

    engine.destroy();
  });

  it('manages dialogue flow and transitions back to OVERWORLD on completion', () => {
    const onDialogueEnd = vi.fn();
    const engine = new HD2DGameEngine(null, sampleGds, { onDialogueEnd });

    engine.startDialogue();
    expect(engine.getMode()).toBe('DIALOGUE');
    expect(engine.getDialogue().getCurrentNode()?.text).toContain('clockwork realm');

    // Select the terminal choice
    engine.selectDialogueChoice(0);
    expect(onDialogueEnd).toHaveBeenCalled();
    expect(engine.getMode()).toBe('OVERWORLD');

    engine.destroy();
  });
});
