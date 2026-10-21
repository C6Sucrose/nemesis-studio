import { describe, it, expect, vi } from 'vitest';
import { generateGameFromPrompt, AgentOrchestrator } from '../src/orchestrator';
import { NebiusClient, NEMOTRON_MODELS } from '../src/services/nebiusClient';
import { TavilyClient } from '../src/services/tavilyClient';
import { validateGameDefinition, GameDefinition } from '@nemesis/shared';

describe('Agent Orchestration Pipeline', () => {
  it('coordinates Nemotron director, shader agent, and Tavily to return a valid GDS', async () => {
    const prompt = 'A steampunk chronomancer exploring a clockwork cathedral to stop a mechanical dragon';
    const result = await generateGameFromPrompt(prompt, { mockMode: true });

    expect(result.success).toBe(true);
    expect(result.gds.world.zoneName).toBeDefined();
    expect(result.gds.combat.enemy.name).toBeDefined();
    expect(result.agentLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agent: 'Nemotron-3-Ultra-Director' }),
        expect.objectContaining({ agent: 'Tavily-Research' })
      ])
    );

    // Verify against shared schema validator
    const validation = validateGameDefinition(result.gds);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Verify audio and shader definitions populated
    expect(result.gds.shaders?.customWgsl).toBeDefined();
    expect(result.gds.shaders?.bloom?.enabled).toBe(true);
    expect(result.gds.audio?.sfx?.attack).toBeDefined();
  });

  it('generates thematic GDS customized to cyber/sci-fi prompt', async () => {
    const prompt = 'A neon cyber samurai infiltrating an orbital space fortress';
    const result = await generateGameFromPrompt(prompt, { mockMode: true });

    expect(result.success).toBe(true);
    expect(result.gds.world.theme).toBe('cyberpunk');
    expect(result.gds.meta.title).toContain('Neo-Kyoto');
    expect(result.gds.combat.player.name).toContain('Cyber Samurai');
    expect(result.gds.combat.enemy.name).toContain('Cyber Wyrm');

    const validation = validateGameDefinition(result.gds);
    expect(validation.isValid).toBe(true);
  });

  it('triggers auto-repair loop and fixes dangling dialogue pointers and invalid HP bounds', async () => {
    const orchestrator = new AgentOrchestrator({ mockMode: true });

    // Intentionally create a defective candidate GDS
    const brokenCandidate: Partial<GameDefinition> = {
      meta: { title: 'Broken Timeline' },
      world: {
        zoneName: 'Glitch Void',
        gridSize: [10, 10],
        playerStart: [15, 20], // Out of bounds
        npcs: [
          {
            id: 'npc_ghost',
            name: 'Ghost',
            position: [2, 2],
            dialogueNodeId: 'non_existent_node' // Dangling pointer
          }
        ]
      },
      dialogue: {
        initialNodeId: 'node_start',
        nodes: {
          node_start: {
            text: 'Hello',
            choices: [
              { text: 'Broken Path', nextNodeId: 'node_missing' } // Dangling choice pointer
            ]
          }
        }
      },
      combat: {
        player: { name: 'Hero', hp: 200, maxHp: 100, attack: 15, defense: 5 }, // hp > maxHp
        enemy: { name: 'Bug', hp: -10, maxHp: -5, attack: -2, defense: -1 } // invalid negative stats
      }
    };

    const initialValidation = validateGameDefinition(brokenCandidate);
    expect(initialValidation.isValid).toBe(false);
    expect(initialValidation.errors.length).toBeGreaterThan(0);

    // Repair using deterministic auto-repair
    const client = new NebiusClient({ mockMode: true });
    const repaired = client.deterministicRepair(brokenCandidate, initialValidation.errors);

    const postRepairValidation = validateGameDefinition(repaired);
    expect(postRepairValidation.isValid).toBe(true);
    expect(postRepairValidation.errors).toHaveLength(0);

    // Verify player start was clamped inside grid [0..9, 0..9]
    expect(repaired.world?.playerStart?.[0]).toBeLessThanOrEqual(9);
    expect(repaired.world?.playerStart?.[1]).toBeLessThanOrEqual(9);

    // Verify dangling choice nextNodeId was severed safely
    expect(repaired.dialogue?.nodes?.['node_start']?.choices[0].nextNodeId).toBeNull();

    // Verify combat hp bounds restored
    expect(repaired.combat?.player?.hp).toBeLessThanOrEqual(repaired.combat?.player?.maxHp || 100);
    expect(repaired.combat?.enemy?.maxHp).toBeGreaterThan(0);
    expect(repaired.combat?.enemy?.hp).toBeGreaterThanOrEqual(0);
  });

  it('survives API network failures by falling back to high-fidelity offline generation', async () => {
    // Provide dummy API keys but mock fetch to reject
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

    try {
      const result = await generateGameFromPrompt(
        'A dark fantasy necromancer crypt',
        { nebiusApiKey: 'fake-key', tavilyApiKey: 'fake-key', mockMode: false }
      );

      expect(result.success).toBe(true);
      expect(result.gds).toBeDefined();
      expect(result.gds.world.zoneName).toBeDefined();
      expect(result.agentLogs.some(l => l.agent === 'Nemotron-Auto-Repair')).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('TavilyClient searches and formats JRPG algorithms and shaders', async () => {
    const tavily = new TavilyClient({ mockMode: true });
    const response = await tavily.search('HD-2D WebGPU WGSL tilt-shift shader');

    expect(response.query).toBe('HD-2D WebGPU WGSL tilt-shift shader');
    expect(response.answer).toBeDefined();
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0].content).toContain('WGSL');
  });

  it('NebiusClient constants expose configured Nemotron models', () => {
    expect(NEMOTRON_MODELS.DIRECTOR_ULTRA).toBe('nvidia/nemotron-4-340b-instruct');
    expect(NEMOTRON_MODELS.NANO_GRAPHICS).toBe('nvidia/nemotron-nano-9b');
    expect(NEMOTRON_MODELS.NANO_AUDIO).toBe('nvidia/nemotron-mini-4b-instruct');
  });
});
