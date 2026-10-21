import { describe, it, expect } from 'vitest';
import { CombatStateMachine } from '../src/engine/CombatStateMachine';

describe('CombatStateMachine', () => {
  it('handles player attack, enemy retaliation, and victory detection', () => {
    const sm = new CombatStateMachine({
      player: { name: 'Hero', hp: 50, maxHp: 50, mp: 20, maxMp: 20, attack: 15, defense: 2 },
      enemy: { name: 'Slime', hp: 20, maxHp: 20, attack: 5, defense: 1 }
    });

    expect(sm.getCurrentState()).toBe('PLAYER_TURN');
    const attackResult = sm.executeAction({ type: 'ATTACK' });
    expect(attackResult.damageDealt).toBeGreaterThan(0);
    expect(sm.getEnemyHp()).toBeLessThan(20);

    // Continue until enemy defeated
    sm.executeAction({ type: 'ATTACK' });
    expect(sm.isVictory()).toBe(true);
    expect(sm.getCurrentState()).toBe('VICTORY');
  });

  it('calculates damage using max(1, attack - defense)', () => {
    const sm = new CombatStateMachine({
      player: { name: 'Hero', hp: 50, maxHp: 50, attack: 5, defense: 10 },
      enemy: { name: 'Armored Crab', hp: 30, maxHp: 30, attack: 8, defense: 20 }
    });

    const result = sm.executeAction({ type: 'ATTACK' });
    // Player attack 5 - defense 20 = -15 -> max(1, -15) = 1
    expect(result.damageDealt).toBe(1);
    expect(sm.getEnemyHp()).toBe(29);
  });

  it('handles enemy retaliation when enemy survives', () => {
    const sm = new CombatStateMachine({
      player: { name: 'Hero', hp: 50, maxHp: 50, attack: 10, defense: 4 },
      enemy: { name: 'Goblin', hp: 50, maxHp: 50, attack: 12, defense: 2 }
    });

    const result = sm.executeAction({ type: 'ATTACK' });
    // Player deals 10 - 2 = 8 damage -> enemy has 42 HP
    expect(result.damageDealt).toBe(8);
    expect(sm.getEnemyHp()).toBe(42);

    // Enemy retaliates: 12 - 4 = 8 damage to player -> player has 42 HP
    expect(result.retaliationDamage).toBe(8);
    expect(sm.getPlayerHp()).toBe(42);
    expect(sm.getCurrentState()).toBe('PLAYER_TURN');
  });

  it('handles magic casting with mana checks and skill power', () => {
    const sm = new CombatStateMachine({
      player: {
        name: 'Mage',
        hp: 30,
        maxHp: 30,
        mp: 10,
        maxMp: 10,
        attack: 5,
        defense: 2,
        skills: [
          { id: 'fireball', name: 'Fireball', mpCost: 6, power: 25, type: 'magic' },
          { id: 'heal', name: 'Heal', mpCost: 5, power: 20, type: 'heal' }
        ]
      },
      enemy: { name: 'Boss', hp: 100, maxHp: 100, attack: 6, defense: 3 }
    });

    // Cast Fireball (costs 6 MP)
    const magicResult = sm.executeAction({ type: 'MAGIC', skillId: 'fireball' });
    expect(magicResult.success).toBe(true);
    expect(sm.getPlayerMp()).toBe(4);
    // Magic damage = max(1, power - defense) = 25 - 3 = 22
    expect(magicResult.damageDealt).toBe(22);

    // Try casting Fireball again with only 4 MP -> should fail mana check
    const insufficientMpResult = sm.executeAction({ type: 'MAGIC', skillId: 'fireball' });
    expect(insufficientMpResult.success).toBe(false);
    expect(insufficientMpResult.message).toMatch(/insufficient|not enough mp/i);
    // State remains player's turn
    expect(sm.getCurrentState()).toBe('PLAYER_TURN');
  });

  it('handles healing magic', () => {
    const sm = new CombatStateMachine({
      player: {
        name: 'Cleric',
        hp: 15,
        maxHp: 40,
        mp: 10,
        maxMp: 10,
        attack: 5,
        defense: 5,
        skills: [
          { id: 'heal', name: 'Heal', mpCost: 5, power: 15, type: 'heal' }
        ]
      },
      enemy: { name: 'Skeleton', hp: 50, maxHp: 50, attack: 7, defense: 2 }
    });

    const result = sm.executeAction({ type: 'MAGIC', skillId: 'heal' });
    expect(result.success).toBe(true);
    // Healed 15 HP -> from 15 to 30, minus enemy retaliation (7 - 5 = 2) = 28
    expect(sm.getPlayerHp()).toBe(28);
    expect(sm.getPlayerMp()).toBe(5);
  });

  it('handles item usage for HP recovery', () => {
    const sm = new CombatStateMachine({
      player: { name: 'Hero', hp: 10, maxHp: 50, attack: 10, defense: 2 },
      enemy: { name: 'Bat', hp: 20, maxHp: 20, attack: 4, defense: 1 }
    });

    const result = sm.executeAction({ type: 'ITEM', itemId: 'potion', value: 25 });
    expect(result.success).toBe(true);
    // Healed 25 HP: 10 + 25 = 35. Retaliation: 4 - 2 = 2. Final HP = 33.
    expect(sm.getPlayerHp()).toBe(33);
  });

  it('handles fleeing from combat', () => {
    const sm = new CombatStateMachine({
      player: { name: 'Hero', hp: 50, maxHp: 50, attack: 10, defense: 2 },
      enemy: { name: 'Dragon', hp: 500, maxHp: 500, attack: 50, defense: 20 }
    });

    const result = sm.executeAction({ type: 'FLEE' });
    expect(result.success).toBe(true);
    expect(sm.getCurrentState()).toBe('FLED');
  });

  it('handles player defeat cleanly (deadlock prevention)', () => {
    const sm = new CombatStateMachine({
      player: { name: 'Hero', hp: 5, maxHp: 50, attack: 2, defense: 0 },
      enemy: { name: 'Titan', hp: 100, maxHp: 100, attack: 20, defense: 10 }
    });

    sm.executeAction({ type: 'ATTACK' });
    // Player deals 1 damage (5 - 0 retaliation kills player)
    expect(sm.getPlayerHp()).toBe(0);
    expect(sm.isDefeat()).toBe(true);
    expect(sm.getCurrentState()).toBe('DEFEAT');

    // Attempting action while defeated doesn't crash or alter state
    const afterDefeatResult = sm.executeAction({ type: 'ATTACK' });
    expect(afterDefeatResult.success).toBe(false);
    expect(sm.getCurrentState()).toBe('DEFEAT');
  });
});
