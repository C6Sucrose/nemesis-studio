import { GameDefinition, CombatantDefinition } from '@nemesis/shared';
import { HD2DRenderer } from './HD2DRenderer';
import { OverworldController } from './OverworldController';
import { CombatStateMachine, CombatAction, CombatActionResult } from './CombatStateMachine';
import { DialogueController } from './DialogueController';

export type EngineMode = 'OVERWORLD' | 'COMBAT' | 'DIALOGUE' | 'PAUSED';

export interface HD2DGameEngineCallbacks {
  onModeChange?: (mode: EngineMode) => void;
  onCombatEnd?: (victory: boolean, fled: boolean) => void;
  onDialogueEnd?: () => void;
}

export class HD2DGameEngine {
  private gds: GameDefinition;
  private canvas: HTMLCanvasElement | null;
  private renderer: HD2DRenderer;
  private overworld: OverworldController;
  private combat: CombatStateMachine;
  private dialogue: DialogueController;

  private mode: EngineMode = 'OVERWORLD';
  private previousMode: EngineMode = 'OVERWORLD';
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private callbacks: HD2DGameEngineCallbacks;

  private keyListener?: (e: KeyboardEvent) => void;

  constructor(
    canvas: HTMLCanvasElement | null,
    gds: GameDefinition,
    callbacks: HD2DGameEngineCallbacks = {}
  ) {
    this.gds = gds;
    this.canvas = canvas;
    this.callbacks = callbacks;

    // 1. Initialize Renderer
    this.renderer = new HD2DRenderer(gds, { canvas });

    // 2. Initialize Overworld Controller
    this.overworld = new OverworldController(gds.world, {
      onMove: (pos) => {
        this.renderer.updatePlayerPosition(pos[0], pos[1]);
      },
      onEncounter: () => {
        this.startCombat();
      },
      onInteract: (npc) => {
        if (npc.dialogueNodeId) {
          this.startDialogue(npc.dialogueNodeId);
        } else {
          this.startDialogue();
        }
      }
    });

    // 3. Initialize Combat State Machine
    this.combat = new CombatStateMachine({
      player: gds.combat.player,
      enemy: gds.combat.enemy,
      turnTimer: gds.combat.turnTimer
    });

    // 4. Initialize Dialogue Controller
    this.dialogue = new DialogueController(gds.dialogue);

    // 5. Setup keyboard listener if window is available
    this.setupInputListeners();
  }

  private setupInputListeners(): void {
    if (typeof window === 'undefined') return;

    this.keyListener = (e: KeyboardEvent) => {
      if (this.mode === 'OVERWORLD') {
        this.overworld.handleKey(e.code || e.key);
      }
    };

    window.addEventListener('keydown', this.keyListener);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loop();
  }

  public pause(): void {
    if (this.mode !== 'PAUSED') {
      this.previousMode = this.mode;
      this.setMode('PAUSED');
    }
  }

  public resume(): void {
    if (this.mode === 'PAUSED') {
      this.setMode(this.previousMode);
    }
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    if (this.mode !== 'PAUSED') {
      this.renderer.render();
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  };

  public getMode(): EngineMode {
    return this.mode;
  }

  public setMode(newMode: EngineMode): void {
    if (this.mode === newMode) return;
    this.mode = newMode;
    if (this.callbacks.onModeChange) {
      this.callbacks.onModeChange(newMode);
    }
  }

  public getRenderer(): HD2DRenderer {
    return this.renderer;
  }

  public getOverworld(): OverworldController {
    return this.overworld;
  }

  public getCombat(): CombatStateMachine {
    return this.combat;
  }

  public getDialogue(): DialogueController {
    return this.dialogue;
  }

  public getGds(): GameDefinition {
    return this.gds;
  }

  // --- Combat Methods ---
  public startCombat(enemyOverride?: CombatantDefinition): void {
    const enemy = enemyOverride ?? this.gds.combat.enemy;
    this.combat = new CombatStateMachine({
      player: this.gds.combat.player,
      enemy,
      turnTimer: this.gds.combat.turnTimer
    });

    this.renderer.setCombatMode(true, enemy);
    this.setMode('COMBAT');
  }

  public dispatchCombatAction(action: CombatAction): CombatActionResult {
    const result = this.combat.executeAction(action);

    if (this.combat.isFinished()) {
      const isVictory = this.combat.isVictory();
      const isFled = this.combat.getCurrentState() === 'FLED';

      if (this.callbacks.onCombatEnd) {
        this.callbacks.onCombatEnd(isVictory, isFled);
      }

      // Return to overworld
      this.renderer.setCombatMode(false);
      this.setMode('OVERWORLD');
    }

    return result;
  }

  // --- Dialogue Methods ---
  public startDialogue(initialNodeId?: string): void {
    if (initialNodeId && this.gds.dialogue.nodes[initialNodeId]) {
      this.dialogue = new DialogueController({
        initialNodeId,
        nodes: this.gds.dialogue.nodes
      });
    } else {
      this.dialogue.reset();
    }

    this.setMode('DIALOGUE');
  }

  public selectDialogueChoice(index: number): boolean {
    const success = this.dialogue.selectChoice(index);

    if (this.dialogue.isFinished()) {
      if (this.callbacks.onDialogueEnd) {
        this.callbacks.onDialogueEnd();
      }
      this.setMode('OVERWORLD');
    }

    return success;
  }

  public closeDialogue(): void {
    if (this.callbacks.onDialogueEnd) {
      this.callbacks.onDialogueEnd();
    }
    this.setMode('OVERWORLD');
  }

  public destroy(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.keyListener && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keyListener);
    }

    this.renderer.destroy();
  }
}
