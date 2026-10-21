/**
 * Nebius Token Factory Client
 * Integrates NVIDIA Nemotron models (Nemotron 3 Ultra, Nano, Super)
 * for Game Director architecture, WGSL shader synthesis, audio parameters, and GDS repair.
 */

import type { GameDefinition, AudioSfxConfig } from '@nemesis/shared';

export interface NebiusClientOptions {
  apiKey?: string;
  baseUrl?: string;
  mockMode?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface NebiusChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export interface NebiusChatResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

export const NEMOTRON_MODELS = {
  DIRECTOR_ULTRA: 'nvidia/nemotron-4-340b-instruct',
  NANO_GRAPHICS: 'nvidia/nemotron-nano-9b',
  NANO_AUDIO: 'nvidia/nemotron-mini-4b-instruct'
} as const;

export class NebiusClient {
  private apiKey: string | undefined;
  private baseUrl: string;
  private mockMode: boolean;

  constructor(options: NebiusClientOptions = {}) {
    this.apiKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.NEBIUS_API_KEY : undefined);
    this.baseUrl = options.baseUrl || 'https://api.studio.nebius.ai/v1';
    this.mockMode = options.mockMode ?? (!this.apiKey);
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey) && !this.mockMode;
  }

  /**
   * Dispatches a chat completion call to Nebius Token Factory.
   */
  public async chatCompletion(request: NebiusChatRequest): Promise<string> {
    if (this.mockMode || !this.apiKey) {
      throw new Error('NebiusClient running in mockMode or without API key. Use mock generators directly.');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 2048,
        ...(request.response_format ? { response_format: request.response_format } : {})
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Nebius API returned status ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as NebiusChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Nebius API returned empty choice content');
    }

    return content;
  }

  /**
   * Game Director Agent (Nemotron 3 Ultra):
   * Generates the core Game Design Document and foundational GDS (world, dialogue, combat).
   */
  public async generateDirectorGds(
    prompt: string,
    researchContext?: string
  ): Promise<{ rawResponse: string; gds: Partial<GameDefinition> }> {
    if (this.mockMode || !this.apiKey) {
      const mockGds = this.getMockDirectorGds(prompt);
      return {
        rawResponse: JSON.stringify(mockGds, null, 2),
        gds: mockGds
      };
    }

    const systemPrompt = `You are the Game Director Agent for Nemesis Studio, powered by NVIDIA Nemotron 3 Ultra.
Your role is to design an Old-School HD-2D JRPG vertical slice based on the user's prompt.
You must output a strictly valid JSON object adhering to the Game Definition Specification (GDS).

JSON Structure:
{
  "meta": { "title": "string", "author": "Nemesis AI", "version": "1.0.0", "description": "string", "prompt": "${prompt}" },
  "world": {
    "zoneName": "string",
    "gridSize": [16, 16],
    "playerStart": [8, 8],
    "theme": "string",
    "tiles": [ { "x": 8, "y": 8, "type": "stone", "walkable": true } ],
    "lights": [ { "type": "point", "position": [8, 2, 8], "color": "#ffaa44", "intensity": 2.0 } ],
    "npcs": [ { "id": "npc_1", "name": "string", "position": [8, 6], "dialogueNodeId": "node_start" } ]
  },
  "dialogue": {
    "initialNodeId": "node_start",
    "nodes": {
      "node_start": {
        "text": "string",
        "choices": [ { "text": "Choice 1", "nextNodeId": "node_2" } ]
      },
      "node_2": {
        "text": "string",
        "choices": []
      }
    }
  },
  "combat": {
    "player": { "name": "string", "hp": 100, "maxHp": 100, "mp": 40, "maxMp": 40, "attack": 18, "defense": 6 },
    "enemy": { "name": "string", "hp": 120, "maxHp": 120, "attack": 14, "defense": 4 }
  }
}

CRITICAL RULES:
1. Every choice's nextNodeId MUST point to a key that exists in dialogue.nodes (NO dangling pointers).
2. NPC dialogueNodeId must exist in dialogue.nodes.
3. Coordinates must remain inside [0..gridSize[0]-1, 0..gridSize[1]-1].
4. Return ONLY valid JSON, with no markdown backticks or commentary.`;

    const userMessage = `Design an HD-2D JRPG for prompt: "${prompt}".\n` +
      (researchContext ? `\nTavily Research Insights:\n${researchContext}` : '');

    const responseText = await this.chatCompletion({
      model: NEMOTRON_MODELS.DIRECTOR_ULTRA,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.6,
      response_format: { type: 'json_object' }
    });

    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as Partial<GameDefinition>;
    return { rawResponse: responseText, gds: parsed };
  }

  /**
   * Graphics & SFX Agent (Nemotron Nano / Super):
   * Generates custom WebGPU WGSL shaders and procedural audio frequencies.
   */
  public async generateShaderAndSfx(
    theme: string,
    prompt: string
  ): Promise<{ customWgsl: string; sfx: Record<string, AudioSfxConfig> }> {
    if (this.mockMode || !this.apiKey) {
      return this.getMockShaderAndSfx(theme, prompt);
    }

    const systemPrompt = `You are the Graphics and SFX Agent powered by NVIDIA Nemotron Nano.
Synthesize custom WGSL particle/lighting shaders and Web Audio frequency parameters matching the theme.
Respond ONLY with a JSON object:
{
  "customWgsl": "// WGSL shader code",
  "sfx": {
    "attack": { "oscillatorType": "square", "startFreq": 440, "endFreq": 110, "duration": 0.15 },
    "hit": { "oscillatorType": "sawtooth", "startFreq": 200, "endFreq": 60, "duration": 0.1 },
    "magic": { "oscillatorType": "sine", "startFreq": 300, "endFreq": 880, "duration": 0.35 },
    "victory": { "oscillatorType": "triangle", "startFreq": 523, "endFreq": 1046, "duration": 0.5, "notes": [523, 659, 784, 1046] }
  }
}`;

    try {
      const responseText = await this.chatCompletion({
        model: NEMOTRON_MODELS.NANO_GRAPHICS,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Theme: ${theme}\nPrompt: ${prompt}` }
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' }
      });

      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        customWgsl: parsed.customWgsl || this.getMockShaderAndSfx(theme, prompt).customWgsl,
        sfx: parsed.sfx || this.getMockShaderAndSfx(theme, prompt).sfx
      };
    } catch {
      return this.getMockShaderAndSfx(theme, prompt);
    }
  }

  /**
   * Auto-Repair Agent (Nemotron 3 Ultra):
   * Repairs an invalid GDS by resolving validation errors in a single targeted pass.
   */
  public async repairGds(
    invalidGds: Partial<GameDefinition>,
    errors: string[]
  ): Promise<Partial<GameDefinition>> {
    if (this.mockMode || !this.apiKey) {
      return this.deterministicRepair(invalidGds, errors);
    }

    const systemPrompt = `You are the GDS Repair Agent for Nemesis Studio.
You receive a JSON GameDefinition that failed pre-flight schema validation, along with the list of error messages.
Your task is to fix every identified issue and return ONLY the corrected, fully valid JSON object.
Ensure:
1. All referenced dialogue nodes exist.
2. Coordinates fall inside world bounds.
3. Health and stats are positive and hp <= maxHp.
4. Output valid JSON only.`;

    try {
      const responseText = await this.chatCompletion({
        model: NEMOTRON_MODELS.DIRECTOR_ULTRA,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Errors:\n${errors.join('\n')}\n\nInvalid GDS:\n${JSON.stringify(invalidGds, null, 2)}`
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned) as Partial<GameDefinition>;
      return parsed;
    } catch {
      return this.deterministicRepair(invalidGds, errors);
    }
  }

  /**
   * Deterministic auto-repair algorithm for offline resilience and tests.
   */
  public deterministicRepair(
    candidate: Partial<GameDefinition>,
    errors: string[]
  ): Partial<GameDefinition> {
    const repaired = JSON.parse(JSON.stringify(candidate)) as Partial<GameDefinition>;

    // 1. Repair Meta
    if (!repaired.meta) {
      repaired.meta = { title: 'Repaired Adventure', author: 'Nemesis AI' };
    } else if (!repaired.meta.title || repaired.meta.title.trim().length === 0) {
      repaired.meta.title = 'Untitled Adventure';
    }

    // 2. Repair World
    if (!repaired.world) {
      repaired.world = {
        zoneName: 'Default Zone',
        gridSize: [16, 16],
        playerStart: [8, 8],
        tiles: []
      };
    } else {
      if (!Array.isArray(repaired.world.gridSize) || repaired.world.gridSize.length !== 2) {
        repaired.world.gridSize = [16, 16];
      }
      const [w, h] = repaired.world.gridSize;
      if (repaired.world.playerStart) {
        const [px, py] = repaired.world.playerStart;
        repaired.world.playerStart = [
          Math.max(0, Math.min(w - 1, px)),
          Math.max(0, Math.min(h - 1, py))
        ];
      } else {
        repaired.world.playerStart = [Math.floor(w / 2), Math.floor(h / 2)];
      }

      if (!repaired.world.zoneName) {
        repaired.world.zoneName = 'Sanctuary';
      }
    }

    // 3. Repair Dialogue
    if (!repaired.dialogue || typeof repaired.dialogue !== 'object') {
      repaired.dialogue = {
        initialNodeId: 'node_start',
        nodes: {
          node_start: { text: 'Welcome traveler.', choices: [] }
        }
      };
    } else {
      if (!repaired.dialogue.nodes || typeof repaired.dialogue.nodes !== 'object') {
        repaired.dialogue.nodes = {
          node_start: { text: 'Welcome traveler.', choices: [] }
        };
      }

      const nodeKeys = Object.keys(repaired.dialogue.nodes);
      if (nodeKeys.length === 0) {
        repaired.dialogue.nodes = {
          node_start: { text: 'Welcome traveler.', choices: [] }
        };
        repaired.dialogue.initialNodeId = 'node_start';
      } else if (!repaired.dialogue.initialNodeId || !nodeKeys.includes(repaired.dialogue.initialNodeId)) {
        repaired.dialogue.initialNodeId = nodeKeys[0];
      }

      // Repair dangling choice links
      for (const node of Object.values(repaired.dialogue.nodes)) {
        if (node && Array.isArray(node.choices)) {
          for (const choice of node.choices) {
            if (choice.nextNodeId && !nodeKeys.includes(choice.nextNodeId)) {
              choice.nextNodeId = null; // Cleanly sever broken pointer
            }
          }
        }
      }
    }

    // 4. Repair NPCs
    if (repaired.world.npcs && Array.isArray(repaired.world.npcs)) {
      const dialogueKeys = Object.keys(repaired.dialogue.nodes);
      for (const npc of repaired.world.npcs) {
        if (npc.dialogueNodeId && !dialogueKeys.includes(npc.dialogueNodeId)) {
          npc.dialogueNodeId = repaired.dialogue.initialNodeId;
        }
      }
    }

    // 5. Repair Combat
    if (!repaired.combat) {
      repaired.combat = {
        player: { name: 'Hero', hp: 100, maxHp: 100, attack: 15, defense: 5 },
        enemy: { name: 'Shadow Beast', hp: 80, maxHp: 80, attack: 12, defense: 3 }
      };
    } else {
      if (!repaired.combat.player) {
        repaired.combat.player = { name: 'Hero', hp: 100, maxHp: 100, attack: 15, defense: 5 };
      } else {
        if (typeof repaired.combat.player.maxHp !== 'number' || repaired.combat.player.maxHp <= 0) {
          repaired.combat.player.maxHp = 100;
        }
        if (typeof repaired.combat.player.hp !== 'number' || repaired.combat.player.hp < 0) {
          repaired.combat.player.hp = repaired.combat.player.maxHp;
        } else if (repaired.combat.player.hp > repaired.combat.player.maxHp) {
          repaired.combat.player.hp = repaired.combat.player.maxHp;
        }
        if (typeof repaired.combat.player.attack !== 'number' || repaired.combat.player.attack < 0) {
          repaired.combat.player.attack = 15;
        }
        if (typeof repaired.combat.player.defense !== 'number' || repaired.combat.player.defense < 0) {
          repaired.combat.player.defense = 5;
        }
      }

      if (!repaired.combat.enemy) {
        repaired.combat.enemy = { name: 'Enemy', hp: 80, maxHp: 80, attack: 10, defense: 2 };
      } else {
        if (typeof repaired.combat.enemy.maxHp !== 'number' || repaired.combat.enemy.maxHp <= 0) {
          repaired.combat.enemy.maxHp = 80;
        }
        if (typeof repaired.combat.enemy.hp !== 'number' || repaired.combat.enemy.hp < 0) {
          repaired.combat.enemy.hp = repaired.combat.enemy.maxHp;
        } else if (repaired.combat.enemy.hp > repaired.combat.enemy.maxHp) {
          repaired.combat.enemy.hp = repaired.combat.enemy.maxHp;
        }
        if (typeof repaired.combat.enemy.attack !== 'number' || repaired.combat.enemy.attack < 0) {
          repaired.combat.enemy.attack = 12;
        }
        if (typeof repaired.combat.enemy.defense !== 'number' || repaired.combat.enemy.defense < 0) {
          repaired.combat.enemy.defense = 3;
        }
      }
    }

    return repaired;
  }

  /**
   * Deterministic director mock output parameterized by the prompt.
   */
  public getMockDirectorGds(prompt: string): GameDefinition {
    const p = prompt.toLowerCase();
    const isClockwork = p.includes('steampunk') || p.includes('clockwork') || p.includes('chronomancer');
    const isSciFi = p.includes('cyber') || p.includes('neon') || p.includes('samurai') || p.includes('space');

    const title = isClockwork
      ? 'Chrono Gears: Cathedral of Time'
      : isSciFi
      ? 'Neo-Kyoto: Cyber Blades'
      : 'Eldoria: Whispers of the Realm';

    const zoneName = isClockwork
      ? 'Clockwork Cathedral Nave'
      : isSciFi
      ? 'Neon Alleyway'
      : 'Ancient Stone Ruins';

    const enemyName = isClockwork
      ? 'Mechanical Dragon'
      : isSciFi
      ? 'Cyber Wyrm'
      : 'Abyssal Golem';

    const playerName = isClockwork
      ? 'Chronomancer'
      : isSciFi
      ? 'Cyber Samurai'
      : 'Knight of Light';

    const gridWidth = 16;
    const gridHeight = 16;
    const tiles: GameDefinition['world']['tiles'] = [];

    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        const isBorder = x === 0 || x === gridWidth - 1 || y === 0 || y === gridHeight - 1;
        tiles.push({
          x,
          y,
          type: isBorder ? 'wall' : isClockwork ? 'stone' : 'cobblestone',
          walkable: !isBorder
        });
      }
    }

    return {
      meta: {
        title,
        author: 'Nemesis AI (Nemotron 3 Ultra)',
        version: '1.0.0',
        description: `Autonomous HD-2D JRPG generated for prompt: "${prompt}"`,
        prompt,
        createdAt: new Date().toISOString()
      },
      world: {
        zoneName,
        gridSize: [gridWidth, gridHeight],
        playerStart: [8, 8],
        theme: isClockwork ? 'steampunk_cathedral' : isSciFi ? 'cyberpunk' : 'medieval_fantasy',
        tiles,
        lights: [
          {
            type: 'point',
            position: [8, 3, 8],
            color: isClockwork ? '#ffaa44' : isSciFi ? '#00f0ff' : '#ffeebb',
            intensity: 2.2,
            distance: 12
          },
          {
            type: 'ambient',
            position: [0, 10, 0],
            color: '#334455',
            intensity: 0.6
          }
        ],
        npcs: [
          {
            id: 'npc_oracle',
            name: isClockwork ? 'Gearsmith Tobias' : 'Wandering Chronicler',
            position: [8, 6],
            dialogueNodeId: 'node_start'
          }
        ]
      },
      dialogue: {
        initialNodeId: 'node_start',
        nodes: {
          node_start: {
            text: isClockwork
              ? 'The great cogwheels are spinning in reverse! The Mechanical Dragon has breached the inner sanctum.'
              : 'Traveler, dangerous anomalies stir ahead. Will you step forward?',
            choices: [
              {
                text: 'Tell me about the anomaly.',
                nextNodeId: 'node_lore'
              },
              {
                text: 'I am ready for battle.',
                nextNodeId: 'node_ready'
              }
            ]
          },
          node_lore: {
            text: isClockwork
              ? 'Ancient chronomancy powers this cathedral. If the central mainspring snaps, time unravels across all realms.'
              : 'The creature draws power from the shattered core. Strike hard and conserve your mana.',
            choices: [
              {
                text: 'Draw weapon and advance.',
                nextNodeId: 'node_ready'
              }
            ]
          },
          node_ready: {
            text: 'May the fates guide your blade. Entering the arena!',
            choices: []
          }
        }
      },
      combat: {
        player: {
          name: playerName,
          hp: 110,
          maxHp: 110,
          mp: 50,
          maxMp: 50,
          attack: 18,
          defense: 6,
          skills: [
            { id: 'time_warp', name: 'Temporal Slash', mpCost: 12, power: 28, type: 'magic' },
            { id: 'chrono_heal', name: 'Rewind Wound', mpCost: 15, power: 35, type: 'heal' }
          ]
        },
        enemy: {
          name: enemyName,
          hp: 130,
          maxHp: 130,
          attack: 15,
          defense: 5,
          skills: [
            { id: 'gear_crush', name: 'Gear Crush', mpCost: 0, power: 22, type: 'physical' }
          ]
        }
      }
    };
  }

  /**
   * Mock WGSL shaders and procedural audio parameters.
   */
  public getMockShaderAndSfx(
    theme: string,
    prompt: string
  ): { customWgsl: string; sfx: Record<string, AudioSfxConfig> } {
    const customWgsl = `
// Nemesis Studio HD-2D Custom Atmospheric Particle & Lighting WGSL Shader
// Generated by Nemotron Nano for theme: ${theme}

struct Particle {
  position: vec3<f32>,
  velocity: vec3<f32>,
  life: f32,
  size: f32,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= arrayLength(&particles)) {
    return;
  }
  
  particles[idx].position += particles[idx].velocity * 0.016;
  particles[idx].life -= 0.016;
  
  if (particles[idx].life <= 0.0) {
    particles[idx].position = vec3<f32>(f32(idx % 16u) - 8.0, 0.5, f32((idx / 16u) % 16u) - 8.0);
    particles[idx].life = 2.0;
  }
}
`.trim();

    const sfx: Record<string, AudioSfxConfig> = {
      attack: {
        oscillatorType: 'square',
        startFreq: 480,
        endFreq: 120,
        duration: 0.14
      },
      hit: {
        oscillatorType: 'sawtooth',
        startFreq: 220,
        endFreq: 50,
        duration: 0.12
      },
      magic: {
        oscillatorType: 'sine',
        startFreq: 320,
        endFreq: 880,
        duration: 0.32
      },
      victory: {
        oscillatorType: 'triangle',
        startFreq: 523,
        endFreq: 1046,
        duration: 0.45,
        notes: [523.25, 659.25, 783.99, 1046.5]
      }
    };

    return { customWgsl, sfx };
  }
}
