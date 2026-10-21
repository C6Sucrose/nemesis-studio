import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { exportRustSourceProject } from '../src/exportRustProject';
import type { GameDefinition } from '@nemesis/shared';

describe('exportRustSourceProject', () => {
  const mockGds: GameDefinition = {
    meta: {
      title: 'Neon Chrono',
      author: 'Nemesis AI',
      version: '1.0.0',
      description: 'A cyberpunk HD-2D JRPG odyssey',
    },
    world: {
      zoneName: 'Neon City',
      gridSize: [15, 15],
      playerStart: [7, 7],
      tiles: [
        { x: 0, y: 0, type: 'cobblestone', walkable: true, elevation: 0 },
        { x: 1, y: 1, type: 'wall', walkable: false, elevation: 1 },
      ],
      lights: [
        { type: 'directional', position: [5, 10, 5], color: '#ffffff', intensity: 1000 },
        { type: 'point', position: [7, 2, 7], color: '#ff44aa', intensity: 500, distance: 10 },
      ],
      npcs: [
        { id: 'npc_1', name: 'Deckard', position: [6, 7], dialogueNodeId: 'node_1' },
      ],
    },
    dialogue: {
      initialNodeId: 'node_1',
      nodes: {
        node_1: {
          text: 'Wake up, Runner. The grid is compromised.',
          speaker: 'Deckard',
          choices: [
            { text: 'I am ready.', nextNodeId: 'node_combat', action: 'START_COMBAT' },
            { text: 'Tell me more.', nextNodeId: null },
          ],
        },
      },
    },
    combat: {
      player: {
        name: 'Chrono',
        hp: 100,
        maxHp: 100,
        mp: 30,
        maxMp: 30,
        attack: 25,
        defense: 12,
        speed: 15,
      },
      enemy: {
        name: 'Cybergolem',
        hp: 120,
        maxHp: 120,
        attack: 20,
        defense: 10,
        speed: 10,
      },
    },
    shaders: {
      bloom: { enabled: true, intensity: 1.5 },
      tiltShift: { enabled: true, blurRadius: 2.0 },
    },
  };

  it('generates a complete, valid Cargo.toml and main.rs configured with the game title', () => {
    const exported = exportRustSourceProject(mockGds);
    expect(exported.files['Cargo.toml']).toContain('bevy = "0.14"');
    expect(exported.files['Cargo.toml']).toContain('name = "neon_chrono"');
    expect(exported.files['src/main.rs']).toContain('Neon Chrono');
    expect(exported.files['assets/game_def.json']).toBeDefined();
  });

  it('generates all expected files in the source tree', () => {
    const exported = exportRustSourceProject(mockGds);
    const expectedPaths = [
      'Cargo.toml',
      'src/main.rs',
      'src/loader.rs',
      'assets/game_def.json',
      'README.md',
    ];

    for (const path of expectedPaths) {
      expect(exported.files[path], `Missing file: ${path}`).toBeDefined();
    }

    // Verify serde dependencies in Cargo.toml
    expect(exported.files['Cargo.toml']).toContain('serde');
    expect(exported.files['Cargo.toml']).toContain('serde_json');

    // Verify loader.rs contains GDS structs and loader functions
    expect(exported.files['src/loader.rs']).toContain('GameDefinition');
    expect(exported.files['src/loader.rs']).toContain('load_game_definition');

    // Verify assets/game_def.json contains serialized GDS
    const parsedGds = JSON.parse(exported.files['assets/game_def.json']);
    expect(parsedGds.meta.title).toBe('Neon Chrono');
    expect(parsedGds.world.zoneName).toBe('Neon City');

    // Verify README.md contains cargo run instructions
    expect(exported.files['README.md']).toContain('cargo run --release');
    expect(exported.files['README.md']).toContain('Neon Chrono');
  });

  it('produces a valid binary zipBuffer containing all files', async () => {
    const exported = exportRustSourceProject(mockGds);
    expect(Buffer.isBuffer(exported.zipBuffer)).toBe(true);
    expect(exported.zipBuffer.length).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(exported.zipBuffer);
    const zipFileNames = Object.keys(zip.files);

    expect(zipFileNames).toContain('Cargo.toml');
    expect(zipFileNames).toContain('src/main.rs');
    expect(zipFileNames).toContain('src/loader.rs');
    expect(zipFileNames).toContain('assets/game_def.json');
    expect(zipFileNames).toContain('README.md');

    // Verify content inside ZIP matches exported.files
    const mainRsContent = await zip.file('src/main.rs')?.async('string');
    expect(mainRsContent).toBe(exported.files['src/main.rs']);

    const cargoContent = await zip.file('Cargo.toml')?.async('string');
    expect(cargoContent).toBe(exported.files['Cargo.toml']);
  });
});
