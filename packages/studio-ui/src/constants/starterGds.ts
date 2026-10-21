import { GameDefinition } from '@nemesis/shared';
import { AgentLogEntry } from '@nemesis/agent-orchestrator';

export const STARTER_GDS: GameDefinition = {
  meta: {
    title: 'Clockwork Chronomancer',
    author: 'Nemesis Studio AI (Nemotron 3 Ultra)',
    version: '1.0.0',
    description: 'A turn-based time manipulation retro HD-2D JRPG set in a brass clocktower.',
    prompt: 'Clockwork Chronomancer in a brass clocktower'
  },
  world: {
    zoneName: 'Gearwork Sanctum',
    gridSize: [16, 16],
    playerStart: [8, 8],
    theme: 'steampunk_hd2d',
    tiles: [
      { x: 8, y: 8, type: 'cobblestone', walkable: true },
      { x: 8, y: 7, type: 'cobblestone', walkable: true },
      { x: 9, y: 8, type: 'cobblestone', walkable: true },
      { x: 7, y: 8, type: 'cobblestone', walkable: true },
      { x: 8, y: 9, type: 'cobblestone', walkable: true },
      { x: 7, y: 7, type: 'stone', walkable: true },
      { x: 9, y: 9, type: 'stone', walkable: true },
      { x: 6, y: 8, type: 'wall', walkable: false },
      { x: 10, y: 8, type: 'wall', walkable: false }
    ],
    lights: [
      { type: 'point', position: [8, 3, 8], color: '#ffb347', intensity: 2.5, distance: 30 },
      { type: 'directional', position: [12, 20, 12], color: '#ffe6cc', intensity: 1.8 }
    ],
    npcs: [
      {
        id: 'npc_chronos_automaton',
        name: 'Chronos Automaton',
        position: [9, 8],
        dialogueNodeId: 'node_intro'
      }
    ]
  },
  dialogue: {
    initialNodeId: 'node_intro',
    nodes: {
      node_intro: {
        speaker: 'Chronos Automaton',
        text: 'The pendulum swings eternal across the gearwork lattice. Will you rewind time or face the Gears of Ruin?',
        choices: [
          { text: 'Engage Combat Mode: Challenge the Chrono-Chimera!', nextNodeId: 'node_combat_init' },
          { text: 'Inquire regarding the brass clockwork mechanism.', nextNodeId: 'node_lore' }
        ]
      },
      node_lore: {
        speaker: 'Chronos Automaton',
        text: 'Our clockwork matrix renders at 144+ FPS with a 35-degree isometric tilt-shift lens. Every cog is calibrated in Rust Bevy.',
        choices: [
          { text: 'Draw weapon and calibrate chronometer.', nextNodeId: null }
        ]
      },
      node_combat_init: {
        speaker: 'Chronos Automaton',
        text: 'Initiating temporal duel! Prepare your Chrono-Strike.',
        choices: [
          { text: 'Commence battle!', nextNodeId: null }
        ]
      }
    }
  },
  combat: {
    turnTimer: 30,
    player: {
      name: 'Chronomancer Aethel',
      hp: 120,
      maxHp: 120,
      mp: 60,
      maxMp: 60,
      attack: 28,
      defense: 14,
      skills: [
        { id: 'skill_temporal_strike', name: 'Temporal Strike', mpCost: 15, power: 35, type: 'physical' },
        { id: 'skill_time_dilation', name: 'Time Dilation', mpCost: 20, power: 45, type: 'magic' }
      ]
    },
    enemy: {
      name: 'Clockwork Chimera',
      hp: 160,
      maxHp: 160,
      attack: 20,
      defense: 10,
      skills: [
        { id: 'skill_gear_shred', name: 'Gear Shred', mpCost: 10, power: 25, type: 'physical' }
      ]
    }
  },
  shaders: {
    customWgsl: '// Custom WGSL Tilt-Shift & Particle Depth Shader\n@compute @workgroup_size(64)\nfn main() { /* WGSL Compute Kernel */ }',
    bloom: { enabled: true, intensity: 1.5 },
    tiltShift: { enabled: true, blurRadius: 4 }
  },
  audio: {
    bgmTheme: 'steampunk_clockwork_chiptune',
    sfx: {
      attack: { oscillatorType: 'sawtooth', startFreq: 440, endFreq: 220, duration: 0.15 },
      hit: { oscillatorType: 'triangle', startFreq: 220, endFreq: 110, duration: 0.2 },
      victory: { oscillatorType: 'sine', startFreq: 880, endFreq: 1760, duration: 0.5 }
    }
  }
};

export const INITIAL_AGENT_LOGS: AgentLogEntry[] = [
  {
    agent: 'Tavily-Research',
    action: 'Knowledge Search: Harvested HD-2D isometric math & turn-based time balance formulas',
    timestamp: new Date().toLocaleTimeString(),
    details: { query: 'steampunk clockwork JRPG aesthetic AND turn-based time manipulation' }
  },
  {
    agent: 'Nemotron-3-Ultra-Director',
    action: 'Game Director: Synthesized Clockwork Chronomancer GDD & GDS topology',
    timestamp: new Date().toLocaleTimeString(),
    details: { zone: 'Gearwork Sanctum', player: 'Chronomancer Aethel', enemy: 'Clockwork Chimera' }
  },
  {
    agent: 'Nemotron-Nano-Graphics',
    action: 'Graphics & SFX: Synthesized WGSL compute particles and 35° tilt-shift depth blur',
    timestamp: new Date().toLocaleTimeString(),
    details: { tiltAngle: '35 deg', bloom: '1.5x', particles: 'brass_cogs' }
  }
];
