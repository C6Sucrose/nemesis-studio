import type { GameDefinition, ValidationResult } from '../types/gds';

/**
 * Validates a candidate Game Definition Specification (GDS) against
 * structural, boundary, graph integrity, and balance constraints.
 */
export function validateGameDefinition(gds: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!gds || typeof gds !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid Game Definition: expected non-null object'],
      warnings: []
    };
  }

  const candidate = gds as Partial<GameDefinition>;

  // 1. Meta Validation
  if (!candidate.meta || typeof candidate.meta !== 'object') {
    errors.push('Missing or invalid required section: meta');
  } else {
    if (!candidate.meta.title || typeof candidate.meta.title !== 'string' || candidate.meta.title.trim().length === 0) {
      errors.push('Invalid meta.title: expected non-empty string');
    }
  }

  // 2. World Validation
  let gridWidth = 0;
  let gridHeight = 0;
  if (!candidate.world || typeof candidate.world !== 'object') {
    errors.push('Missing or invalid required section: world');
  } else {
    const world = candidate.world;
    if (
      !Array.isArray(world.gridSize) ||
      world.gridSize.length !== 2 ||
      typeof world.gridSize[0] !== 'number' ||
      typeof world.gridSize[1] !== 'number' ||
      world.gridSize[0] <= 0 ||
      world.gridSize[1] <= 0
    ) {
      errors.push('Invalid world.gridSize: expected [width, height] with positive integers');
    } else {
      [gridWidth, gridHeight] = world.gridSize;
    }

    if (world.playerStart) {
      if (
        !Array.isArray(world.playerStart) ||
        world.playerStart.length !== 2 ||
        typeof world.playerStart[0] !== 'number' ||
        typeof world.playerStart[1] !== 'number'
      ) {
        errors.push('Invalid world.playerStart: expected [x, y] coordinates');
      } else if (gridWidth > 0 && gridHeight > 0) {
        const [px, py] = world.playerStart;
        if (px < 0 || px >= gridWidth || py < 0 || py >= gridHeight) {
          errors.push(
            `world.playerStart [${px}, ${py}] is outside grid boundaries [0..${gridWidth - 1}, 0..${gridHeight - 1}]`
          );
        }
      }
    }

    if (world.tiles && !Array.isArray(world.tiles)) {
      errors.push('world.tiles must be an array if provided');
    }

    if (world.lights && !Array.isArray(world.lights)) {
      errors.push('world.lights must be an array if provided');
    }
  }

  // 3. Dialogue Validation
  if (!candidate.dialogue || typeof candidate.dialogue !== 'object') {
    errors.push('Missing or invalid required section: dialogue');
  } else {
    const dialogue = candidate.dialogue;
    const nodes = dialogue.nodes;

    if (!nodes || typeof nodes !== 'object') {
      errors.push('dialogue.nodes must be a valid node dictionary');
    } else {
      const nodeKeys = Object.keys(nodes);

      if (!dialogue.initialNodeId || typeof dialogue.initialNodeId !== 'string') {
        errors.push('Invalid dialogue.initialNodeId: expected string identifier');
      } else if (!nodeKeys.includes(dialogue.initialNodeId)) {
        errors.push(
          `dialogue.initialNodeId points to non-existent node: '${dialogue.initialNodeId}'`
        );
      }

      for (const [nodeId, node] of Object.entries(nodes)) {
        if (!node || typeof node !== 'object') {
          errors.push(`Invalid dialogue node definition for id '${nodeId}'`);
          continue;
        }

        if (typeof node.text !== 'string') {
          errors.push(`Dialogue node '${nodeId}' is missing valid text`);
        }

        if (!Array.isArray(node.choices)) {
          errors.push(`Dialogue node '${nodeId}' choices must be an array`);
        } else {
          for (const choice of node.choices) {
            if (!choice || typeof choice !== 'object') {
              errors.push(`Dialogue node '${nodeId}' contains invalid choice object`);
              continue;
            }

            if (choice.nextNodeId && !nodeKeys.includes(choice.nextNodeId)) {
              errors.push(
                `Dangling dialogue pointer: node '${nodeId}' has choice pointing to non_existent_node '${choice.nextNodeId}'`
              );
            }
          }
        }
      }
    }
  }

  // 4. Combat Validation
  if (!candidate.combat || typeof candidate.combat !== 'object') {
    errors.push('Missing or invalid required section: combat');
  } else {
    const combat = candidate.combat;

    // Player validation
    if (!combat.player || typeof combat.player !== 'object') {
      errors.push('Missing required combat.player definition');
    } else {
      const p = combat.player;
      if (!p.name || typeof p.name !== 'string') {
        errors.push('combat.player missing valid name');
      }
      if (typeof p.hp !== 'number' || p.hp < 0) {
        errors.push('Invalid combat.player hp: expected non-negative number');
      }
      if (typeof p.attack !== 'number' || p.attack < 0) {
        errors.push('Invalid combat.player attack: expected non-negative number');
      }
      if (typeof p.defense !== 'number' || p.defense < 0) {
        errors.push('Invalid combat.player defense: expected non-negative number');
      }
    }

    // Enemy validation
    if (!combat.enemy || typeof combat.enemy !== 'object') {
      errors.push('Missing required combat.enemy definition');
    } else {
      const e = combat.enemy;
      if (!e.name || typeof e.name !== 'string') {
        errors.push('combat.enemy missing valid name');
      }
      if (typeof e.hp !== 'number' || e.hp < 0) {
        errors.push('Invalid combat.enemy hp: expected non-negative number');
      }
      if (typeof e.attack !== 'number' || e.attack < 0) {
        errors.push('Invalid combat.enemy attack: expected non-negative number');
      }
      if (typeof e.defense !== 'number' || e.defense < 0) {
        errors.push('Invalid combat.enemy defense: expected non-negative number');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
