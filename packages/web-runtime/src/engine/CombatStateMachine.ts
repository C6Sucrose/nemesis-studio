import { CombatantDefinition, SkillDefinition } from '@nemesis/shared';

export type CombatState = 'PLAYER_TURN' | 'ENEMY_TURN' | 'VICTORY' | 'DEFEAT' | 'FLED';

export type CombatActionType = 'ATTACK' | 'MAGIC' | 'ITEM' | 'FLEE';

export interface CombatAction {
  type: CombatActionType;
  skillId?: string;
  itemId?: string;
  value?: number;
}

export interface CombatActionResult {
  success: boolean;
  damageDealt?: number;
  retaliationDamage?: number;
  healedAmount?: number;
  message?: string;
  state: CombatState;
}

export interface CombatStateMachineConfig {
  player: CombatantDefinition;
  enemy: CombatantDefinition;
  turnTimer?: number;
}

export class CombatStateMachine {
  private player: CombatantDefinition;
  private enemy: CombatantDefinition;
  private initialPlayer: CombatantDefinition;
  private initialEnemy: CombatantDefinition;
  private state: CombatState = 'PLAYER_TURN';
  private logs: string[] = [];

  constructor(config: CombatStateMachineConfig) {
    this.initialPlayer = JSON.parse(JSON.stringify(config.player));
    this.initialEnemy = JSON.parse(JSON.stringify(config.enemy));
    this.player = JSON.parse(JSON.stringify(config.player));
    this.enemy = JSON.parse(JSON.stringify(config.enemy));

    // Ensure defaults for MP
    if (this.player.mp === undefined) this.player.mp = this.player.maxMp ?? 20;
    if (this.player.maxMp === undefined) this.player.maxMp = this.player.mp;
    if (this.enemy.mp === undefined) this.enemy.mp = this.enemy.maxMp ?? 0;
    if (this.enemy.maxMp === undefined) this.enemy.maxMp = this.enemy.mp;

    // Edge check: if enemy already has 0 hp at start
    if (this.enemy.hp <= 0) {
      this.state = 'VICTORY';
    } else if (this.player.hp <= 0) {
      this.state = 'DEFEAT';
    }
  }

  public getCurrentState(): CombatState {
    return this.state;
  }

  public getPlayerHp(): number {
    return this.player.hp;
  }

  public getPlayerMaxHp(): number {
    return this.player.maxHp;
  }

  public getPlayerMp(): number {
    return this.player.mp ?? 0;
  }

  public getPlayerMaxMp(): number {
    return this.player.maxMp ?? 0;
  }

  public getEnemyHp(): number {
    return this.enemy.hp;
  }

  public getEnemyMaxHp(): number {
    return this.enemy.maxHp;
  }

  public getPlayer(): Readonly<CombatantDefinition> {
    return this.player;
  }

  public getEnemy(): Readonly<CombatantDefinition> {
    return this.enemy;
  }

  public isVictory(): boolean {
    return this.state === 'VICTORY';
  }

  public isDefeat(): boolean {
    return this.state === 'DEFEAT';
  }

  public isFinished(): boolean {
    return this.state === 'VICTORY' || this.state === 'DEFEAT' || this.state === 'FLED';
  }

  public getLogs(): readonly string[] {
    return this.logs;
  }

  public executeAction(action: CombatAction): CombatActionResult {
    // If battle has already ended, do not allow further actions
    if (this.isFinished()) {
      return {
        success: false,
        message: `Battle has already ended in state: ${this.state}`,
        state: this.state
      };
    }

    switch (action.type) {
      case 'ATTACK': {
        return this.handlePlayerAttack();
      }
      case 'MAGIC': {
        return this.handlePlayerMagic(action.skillId);
      }
      case 'ITEM': {
        return this.handlePlayerItem(action.itemId, action.value);
      }
      case 'FLEE': {
        return this.handlePlayerFlee();
      }
      default: {
        return {
          success: false,
          message: `Unknown combat action: ${(action as any).type}`,
          state: this.state
        };
      }
    }
  }

  private handlePlayerAttack(): CombatActionResult {
    const rawDamage = this.player.attack - this.enemy.defense;
    const damageDealt = Math.max(1, rawDamage);

    this.enemy.hp = Math.max(0, this.enemy.hp - damageDealt);
    this.logs.push(`${this.player.name} attacked ${this.enemy.name} for ${damageDealt} damage.`);

    if (this.enemy.hp <= 0) {
      this.state = 'VICTORY';
      this.logs.push(`${this.enemy.name} was defeated! Victory!`);
      return {
        success: true,
        damageDealt,
        state: this.state
      };
    }

    // Enemy Retaliation
    const retaliationDamage = this.executeEnemyRetaliation();

    return {
      success: true,
      damageDealt,
      retaliationDamage,
      state: this.state
    };
  }

  private handlePlayerMagic(skillId?: string): CombatActionResult {
    const skill = this.findSkill(skillId);
    if (!skill) {
      return {
        success: false,
        message: `Skill '${skillId}' not found`,
        state: this.state
      };
    }

    const currentMp = this.player.mp ?? 0;
    if (currentMp < skill.mpCost) {
      return {
        success: false,
        message: `Insufficient MP. Required: ${skill.mpCost}, Available: ${currentMp}`,
        state: this.state
      };
    }

    // Deduct MP
    this.player.mp = currentMp - skill.mpCost;

    if (skill.type === 'heal') {
      const healAmount = skill.power;
      const prevHp = this.player.hp;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
      const actualHealed = this.player.hp - prevHp;
      this.logs.push(`${this.player.name} cast ${skill.name} and recovered ${actualHealed} HP.`);

      const retaliationDamage = this.executeEnemyRetaliation();

      return {
        success: true,
        healedAmount: actualHealed,
        retaliationDamage,
        state: this.state
      };
    } else {
      // Offensive Magic / Physical skill
      const rawDamage = skill.power - this.enemy.defense;
      const damageDealt = Math.max(1, rawDamage);

      this.enemy.hp = Math.max(0, this.enemy.hp - damageDealt);
      this.logs.push(`${this.player.name} cast ${skill.name} for ${damageDealt} damage!`);

      if (this.enemy.hp <= 0) {
        this.state = 'VICTORY';
        this.logs.push(`${this.enemy.name} was defeated! Victory!`);
        return {
          success: true,
          damageDealt,
          state: this.state
        };
      }

      const retaliationDamage = this.executeEnemyRetaliation();

      return {
        success: true,
        damageDealt,
        retaliationDamage,
        state: this.state
      };
    }
  }

  private handlePlayerItem(itemId?: string, healValue?: number): CombatActionResult {
    const healAmount = healValue ?? 25;
    const prevHp = this.player.hp;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
    const actualHealed = this.player.hp - prevHp;

    this.logs.push(`${this.player.name} used ${itemId || 'Potion'} and restored ${actualHealed} HP.`);

    const retaliationDamage = this.executeEnemyRetaliation();

    return {
      success: true,
      healedAmount: actualHealed,
      retaliationDamage,
      state: this.state
    };
  }

  private handlePlayerFlee(): CombatActionResult {
    this.state = 'FLED';
    this.logs.push(`${this.player.name} fled from battle!`);
    return {
      success: true,
      state: 'FLED'
    };
  }

  private executeEnemyRetaliation(): number {
    const rawRetaliation = this.enemy.attack - this.player.defense;
    const retaliationDamage = Math.max(1, rawRetaliation);

    this.player.hp = Math.max(0, this.player.hp - retaliationDamage);
    this.logs.push(`${this.enemy.name} retaliated against ${this.player.name} for ${retaliationDamage} damage.`);

    if (this.player.hp <= 0) {
      this.state = 'DEFEAT';
      this.logs.push(`${this.player.name} fell in combat. Defeat.`);
    } else {
      this.state = 'PLAYER_TURN';
    }

    return retaliationDamage;
  }

  private findSkill(skillId?: string): SkillDefinition | undefined {
    if (!this.player.skills || this.player.skills.length === 0) {
      return undefined;
    }
    if (!skillId) {
      return this.player.skills[0];
    }
    return this.player.skills.find(s => s.id === skillId);
  }

  public reset(): void {
    this.player = JSON.parse(JSON.stringify(this.initialPlayer));
    this.enemy = JSON.parse(JSON.stringify(this.initialEnemy));
    this.state = 'PLAYER_TURN';
    this.logs = [];
  }
}
