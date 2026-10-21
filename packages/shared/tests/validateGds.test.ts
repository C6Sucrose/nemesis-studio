import { describe, it, expect } from 'vitest';
import { validateGameDefinition } from '../src/validator/validateGds';

describe('validateGameDefinition', () => {
  it('validates a valid minimal HD-2D JRPG game definition', () => {
    const validGds = {
      meta: { title: 'Clockwork Fate', author: 'Nemesis AI', version: '1.0.0' },
      world: {
        zoneName: 'Cathedral Grounds',
        gridSize: [20, 20],
        playerStart: [5, 5],
        tiles: [{ x: 5, y: 5, type: 'cobblestone', walkable: true }],
        lights: [{ type: 'point', position: [5, 2, 5], color: '#ffaa44', intensity: 2.0 }]
      },
      dialogue: {
        initialNodeId: 'node_1',
        nodes: {
          node_1: { text: 'Welcome traveler.', choices: [{ text: 'Who are you?', nextNodeId: 'node_2' }] },
          node_2: { text: 'I am the keeper of the clockwork.', choices: [] }
        }
      },
      combat: {
        enemy: { name: 'Clockwork Golem', hp: 120, maxHp: 120, attack: 15, defense: 5 },
        player: { name: 'Chronomancer', hp: 100, maxHp: 100, mp: 40, maxMp: 40, attack: 20, defense: 8 }
      }
    };
    const result = validateGameDefinition(validGds);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects dangling dialogue pointers and missing entities', () => {
    const invalidGds = {
      meta: { title: 'Broken Game' },
      world: { gridSize: [10, 10] },
      dialogue: {
        initialNodeId: 'node_1',
        nodes: {
          node_1: { text: 'Broken', choices: [{ text: 'Go', nextNodeId: 'non_existent_node' }] }
        }
      }
    };
    const result = validateGameDefinition(invalidGds);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('non_existent_node'))).toBe(true);
  });

  it('rejects null, undefined, or non-object values', () => {
    expect(validateGameDefinition(null).isValid).toBe(false);
    expect(validateGameDefinition(undefined).isValid).toBe(false);
    expect(validateGameDefinition('invalid string').isValid).toBe(false);
    expect(validateGameDefinition(42).isValid).toBe(false);
  });

  it('detects missing required top-level sections', () => {
    const incomplete = { meta: { title: 'Only Meta' } };
    const result = validateGameDefinition(incomplete);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('world'))).toBe(true);
    expect(result.errors.some(e => e.includes('dialogue'))).toBe(true);
    expect(result.errors.some(e => e.includes('combat'))).toBe(true);
  });

  it('detects missing or invalid meta title', () => {
    const gds = {
      meta: { title: '', author: 'Dev' },
      world: { zoneName: 'Area', gridSize: [10, 10] },
      dialogue: { initialNodeId: 'n1', nodes: { n1: { text: 'Hi', choices: [] } } },
      combat: {
        player: { name: 'Hero', hp: 100, maxHp: 100, attack: 10, defense: 5 },
        enemy: { name: 'Monster', hp: 50, maxHp: 50, attack: 5, defense: 2 }
      }
    };
    const result = validateGameDefinition(gds);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('meta.title'))).toBe(true);
  });

  it('detects invalid world grid size and out-of-bounds playerStart', () => {
    const gds = {
      meta: { title: 'Bounds Test' },
      world: {
        zoneName: 'Area',
        gridSize: [10, 10],
        playerStart: [15, 5] // out of bounds: x=15 >= width=10
      },
      dialogue: { initialNodeId: 'n1', nodes: { n1: { text: 'Hi', choices: [] } } },
      combat: {
        player: { name: 'Hero', hp: 100, maxHp: 100, attack: 10, defense: 5 },
        enemy: { name: 'Monster', hp: 50, maxHp: 50, attack: 5, defense: 2 }
      }
    };
    const result = validateGameDefinition(gds);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('playerStart'))).toBe(true);
  });

  it('detects dangling initialNodeId in dialogue', () => {
    const gds = {
      meta: { title: 'Dialogue Test' },
      world: { zoneName: 'Area', gridSize: [10, 10] },
      dialogue: {
        initialNodeId: 'missing_initial_node',
        nodes: {
          n1: { text: 'Hi', choices: [] }
        }
      },
      combat: {
        player: { name: 'Hero', hp: 100, maxHp: 100, attack: 10, defense: 5 },
        enemy: { name: 'Monster', hp: 50, maxHp: 50, attack: 5, defense: 2 }
      }
    };
    const result = validateGameDefinition(gds);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('initialNodeId') && e.includes('missing_initial_node'))).toBe(true);
  });

  it('detects invalid combat stats (e.g. negative or missing hp/attack)', () => {
    const gds = {
      meta: { title: 'Combat Stat Test' },
      world: { zoneName: 'Area', gridSize: [10, 10] },
      dialogue: { initialNodeId: 'n1', nodes: { n1: { text: 'Hi', choices: [] } } },
      combat: {
        player: { name: 'Hero', hp: -10, maxHp: 100, attack: 10, defense: 5 },
        enemy: { name: 'Monster', hp: 50, maxHp: 50, attack: -2, defense: 2 }
      }
    };
    const result = validateGameDefinition(gds);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('hp') || e.includes('combat.player'))).toBe(true);
    expect(result.errors.some(e => e.includes('attack') || e.includes('combat.enemy'))).toBe(true);
  });
});
