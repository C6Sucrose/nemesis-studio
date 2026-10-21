import { WorldDefinition, TileDefinition, NpcDefinition } from '@nemesis/shared';

export type FacingDirection = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

export interface OverworldControllerOptions {
  encounterRate?: number;
  onEncounter?: () => void;
  onMove?: (pos: [number, number]) => void;
  onInteract?: (npc: NpcDefinition) => void;
}

export class OverworldController {
  private world: WorldDefinition;
  private playerPos: [number, number];
  private facing: FacingDirection = 'SOUTH';
  private encounterRate: number;
  private onEncounter?: () => void;
  private onMove?: (pos: [number, number]) => void;
  private onInteract?: (npc: NpcDefinition) => void;
  private tileMap: Map<string, TileDefinition> = new Map();
  private npcMap: Map<string, NpcDefinition> = new Map();

  constructor(world: WorldDefinition, options: OverworldControllerOptions = {}) {
    this.world = world;
    this.playerPos = [...(world.playerStart ?? [0, 0])];
    this.encounterRate = options.encounterRate ?? 0.08;
    this.onEncounter = options.onEncounter;
    this.onMove = options.onMove;
    this.onInteract = options.onInteract;

    if (world.tiles) {
      for (const tile of world.tiles) {
        this.tileMap.set(`${tile.x},${tile.y}`, tile);
      }
    }

    if (world.npcs) {
      for (const npc of world.npcs) {
        this.npcMap.set(`${npc.position[0]},${npc.position[1]}`, npc);
      }
    }
  }

  public getPlayerPosition(): [number, number] {
    return [this.playerPos[0], this.playerPos[1]];
  }

  public setPlayerPosition(pos: [number, number]): void {
    this.playerPos = [pos[0], pos[1]];
  }

  public getFacing(): FacingDirection {
    return this.facing;
  }

  public setFacing(dir: FacingDirection): void {
    this.facing = dir;
  }

  public getZoneName(): string {
    return this.world.zoneName;
  }

  public getGridSize(): [number, number] {
    return [this.world.gridSize[0], this.world.gridSize[1]];
  }

  public getNpcs(): NpcDefinition[] {
    return this.world.npcs ?? [];
  }

  public getTiles(): TileDefinition[] {
    return this.world.tiles ?? [];
  }

  public canMoveTo(x: number, y: number): boolean {
    const [width, height] = this.world.gridSize;

    // Check grid bounds
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return false;
    }

    // Check tile walkable property
    const tile = this.tileMap.get(`${x},${y}`);
    if (tile && tile.walkable === false) {
      return false;
    }

    return true;
  }

  public move(dx: number, dy: number): boolean {
    // Determine facing direction from movement delta
    if (Math.abs(dx) > Math.abs(dy)) {
      this.facing = dx > 0 ? 'EAST' : 'WEST';
    } else if (dy !== 0) {
      this.facing = dy > 0 ? 'SOUTH' : 'NORTH';
    }

    const targetX = this.playerPos[0] + dx;
    const targetY = this.playerPos[1] + dy;

    if (!this.canMoveTo(targetX, targetY)) {
      return false;
    }

    this.playerPos = [targetX, targetY];

    if (this.onMove) {
      this.onMove([targetX, targetY]);
    }

    // Check random encounter
    if (this.encounterRate > 0 && Math.random() < this.encounterRate) {
      if (this.onEncounter) {
        this.onEncounter();
      }
    }

    return true;
  }

  public handleKey(key: string): boolean {
    switch (key) {
      case 'KeyW':
      case 'ArrowUp':
      case 'w':
      case 'W':
        return this.move(0, -1);
      case 'KeyS':
      case 'ArrowDown':
      case 's':
      case 'S':
        return this.move(0, 1);
      case 'KeyA':
      case 'ArrowLeft':
      case 'a':
      case 'A':
        return this.move(-1, 0);
      case 'KeyD':
      case 'ArrowRight':
      case 'd':
      case 'D':
        return this.move(1, 0);
      case 'KeyE':
      case 'Space':
      case 'Enter':
      case 'e':
      case 'E':
        const npc = this.interact();
        return npc !== null;
      default:
        return false;
    }
  }

  public interact(): NpcDefinition | null {
    // Calculate targeted tile based on facing direction
    let targetX = this.playerPos[0];
    let targetY = this.playerPos[1];

    switch (this.facing) {
      case 'NORTH':
        targetY -= 1;
        break;
      case 'SOUTH':
        targetY += 1;
        break;
      case 'EAST':
        targetX += 1;
        break;
      case 'WEST':
        targetX -= 1;
        break;
    }

    // Look for NPC on targeted tile or directly on player tile
    let targetNpc = this.npcMap.get(`${targetX},${targetY}`);
    if (!targetNpc) {
      targetNpc = this.npcMap.get(`${this.playerPos[0]},${this.playerPos[1]}`);
    }

    if (targetNpc && this.onInteract) {
      this.onInteract(targetNpc);
    }

    return targetNpc ?? null;
  }
}
