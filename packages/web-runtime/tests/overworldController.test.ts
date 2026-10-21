import { describe, it, expect, vi } from 'vitest';
import { OverworldController } from '../src/engine/OverworldController';

describe('OverworldController', () => {
  const sampleWorld = {
    zoneName: 'Clockwork Plaza',
    gridSize: [10, 10] as [number, number],
    playerStart: [2, 2] as [number, number],
    tiles: [
      { x: 2, y: 2, type: 'cobblestone', walkable: true },
      { x: 3, y: 2, type: 'cobblestone', walkable: true },
      { x: 4, y: 2, type: 'wall', walkable: false },
      { x: 2, y: 3, type: 'cobblestone', walkable: true }
    ],
    npcs: [
      { id: 'npc_elder', name: 'Elder', position: [3, 2] as [number, number], dialogueNodeId: 'node_welcome' }
    ]
  };

  it('initializes at playerStart position and faces SOUTH by default', () => {
    const controller = new OverworldController(sampleWorld);
    expect(controller.getPlayerPosition()).toEqual([2, 2]);
    expect(controller.getFacing()).toBe('SOUTH');
  });

  it('moves player into walkable tiles and updates facing direction', () => {
    const controller = new OverworldController(sampleWorld);
    const moved = controller.move(0, 1); // Move down/south to [2, 3]
    expect(moved).toBe(true);
    expect(controller.getPlayerPosition()).toEqual([2, 3]);
    expect(controller.getFacing()).toBe('SOUTH');
  });

  it('blocks movement into non-walkable tiles', () => {
    const controller = new OverworldController(sampleWorld);
    // Move to [3, 2] first
    controller.move(1, 0);
    expect(controller.getPlayerPosition()).toEqual([3, 2]);

    // Try moving to [4, 2] which is a wall
    const movedIntoWall = controller.move(1, 0);
    expect(movedIntoWall).toBe(false);
    expect(controller.getPlayerPosition()).toEqual([3, 2]);
  });

  it('blocks movement outside grid bounds', () => {
    const controller = new OverworldController({
      zoneName: 'Edge',
      gridSize: [3, 3] as [number, number],
      playerStart: [0, 0] as [number, number]
    });

    const movedWest = controller.move(-1, 0);
    expect(movedWest).toBe(false);
    expect(controller.getPlayerPosition()).toEqual([0, 0]);

    const movedNorth = controller.move(0, -1);
    expect(movedNorth).toBe(false);
    expect(controller.getPlayerPosition()).toEqual([0, 0]);
  });

  it('detects interaction with adjacent NPC facing them', () => {
    const controller = new OverworldController(sampleWorld);
    // Player is at [2, 2], NPC is at [3, 2].
    // If player faces EAST, interact finds npc_elder
    controller.setFacing('EAST');
    const npc = controller.interact();
    expect(npc).not.toBeNull();
    expect(npc?.id).toBe('npc_elder');
  });

  it('triggers encounter callback when random encounter occurs', () => {
    const onEncounter = vi.fn();
    const controller = new OverworldController(sampleWorld, {
      encounterRate: 1.0, // 100% encounter rate for testing
      onEncounter
    });

    controller.move(0, 1);
    expect(onEncounter).toHaveBeenCalled();
  });

  it('maps key presses to directional movements', () => {
    const controller = new OverworldController(sampleWorld);
    controller.handleKey('KeyD'); // Move right (+1, 0)
    expect(controller.getPlayerPosition()).toEqual([3, 2]);
  });
});
