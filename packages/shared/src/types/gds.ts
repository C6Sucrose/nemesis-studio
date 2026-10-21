/**
 * Nemesis Studio - Game Definition Specification (GDS) Types
 * Declarative schema defining the HD-2D JRPG runtime data model.
 */

export interface GameMetadata {
  title: string;
  author?: string;
  version?: string;
  description?: string;
  prompt?: string;
  createdAt?: string;
}

export type TileType = 'cobblestone' | 'grass' | 'dirt' | 'stone' | 'water' | 'wall' | 'wood' | string;

export interface TileDefinition {
  x: number;
  y: number;
  type: TileType;
  walkable: boolean;
  elevation?: number;
}

export type LightType = 'point' | 'directional' | 'ambient' | 'spot';

export interface LightDefinition {
  type: LightType;
  position: [number, number, number];
  color: string;
  intensity: number;
  distance?: number;
  decay?: number;
}

export interface NpcDefinition {
  id: string;
  name: string;
  position: [number, number];
  sprite?: string;
  dialogueNodeId?: string;
}

export interface WorldDefinition {
  zoneName: string;
  gridSize: [number, number]; // [width, height]
  playerStart?: [number, number]; // [x, y]
  tiles?: TileDefinition[];
  lights?: LightDefinition[];
  npcs?: NpcDefinition[];
  theme?: string;
}

export interface DialogueChoice {
  text: string;
  nextNodeId?: string | null;
  action?: string;
}

export interface DialogueNode {
  text: string;
  speaker?: string;
  choices: DialogueChoice[];
}

export interface DialogueDefinition {
  initialNodeId: string;
  nodes: Record<string, DialogueNode>;
}

export interface SkillDefinition {
  id: string;
  name: string;
  mpCost: number;
  power: number;
  type: 'physical' | 'magic' | 'heal';
}

export interface CombatantDefinition {
  name: string;
  hp: number;
  maxHp: number;
  mp?: number;
  maxMp?: number;
  attack: number;
  defense: number;
  speed?: number;
  sprite?: string;
  skills?: SkillDefinition[];
}

export interface CombatDefinition {
  enemy: CombatantDefinition;
  player: CombatantDefinition;
  background?: string;
  turnTimer?: number;
}

export interface AudioSfxConfig {
  oscillatorType?: 'sine' | 'square' | 'sawtooth' | 'triangle';
  startFreq?: number;
  endFreq?: number;
  duration?: number;
  notes?: number[];
}

export interface AudioDefinition {
  bgmTheme?: string;
  sfx?: Record<string, AudioSfxConfig>;
}

export interface ShaderDefinition {
  customWgsl?: string;
  customGlsl?: string;
  bloom?: {
    enabled: boolean;
    intensity?: number;
  };
  tiltShift?: {
    enabled: boolean;
    blurRadius?: number;
  };
}

export interface GameDefinition {
  meta: GameMetadata;
  world: WorldDefinition;
  dialogue: DialogueDefinition;
  combat: CombatDefinition;
  audio?: AudioDefinition;
  shaders?: ShaderDefinition;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
