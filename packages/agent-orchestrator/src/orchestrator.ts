/**
 * Multi-Agent Orchestrator for Nemesis Studio
 * Coordinates:
 * 1. Tavily Research Agent: searches game algorithms, balance formulas, and shader implementations.
 * 2. Game Director Agent (Nemotron 3 Ultra): designs GDD, world layout, dialogue tree, and combat.
 * 3. Graphics & SFX Agent (Nemotron Nano / Super): generates custom WGSL particles and audio frequencies.
 * 4. Auto-Repair Loop: verifies with validateGameDefinition and executes targeted 1-pass auto-correction.
 */

import {
  GameDefinition,
  ValidationResult,
  validateGameDefinition
} from '@nemesis/shared';
import { NebiusClient } from './services/nebiusClient';
import { TavilyClient } from './services/tavilyClient';

export interface ApiKeys {
  nebiusApiKey?: string;
  tavilyApiKey?: string;
  nebiusBaseUrl?: string;
  mockMode?: boolean;
}

export interface AgentLogEntry {
  agent:
    | 'Nemotron-3-Ultra-Director'
    | 'Tavily-Research'
    | 'Nemotron-Nano-Graphics'
    | 'Nemotron-Nano-Audio'
    | 'Nemotron-Auto-Repair'
    | string;
  action: string;
  timestamp: string;
  details?: Record<string, unknown> | string;
}

export interface AgentGenerationResult {
  success: boolean;
  gds: GameDefinition;
  agentLogs: AgentLogEntry[];
  rawGdd?: string;
  validation?: ValidationResult;
  error?: string;
}

export class AgentOrchestrator {
  private nebius: NebiusClient;
  private tavily: TavilyClient;
  private mockMode: boolean;

  constructor(options: ApiKeys = {}) {
    this.mockMode = options.mockMode ?? false;
    this.nebius = new NebiusClient({
      apiKey: options.nebiusApiKey,
      baseUrl: options.nebiusBaseUrl,
      mockMode: this.mockMode
    });
    this.tavily = new TavilyClient({
      apiKey: options.tavilyApiKey,
      mockMode: this.mockMode
    });
  }

  /**
   * Executes the full multi-agent generation pipeline from prompt to validated GDS.
   */
  public async generate(prompt: string): Promise<AgentGenerationResult> {
    const logs: AgentLogEntry[] = [];
    const now = () => new Date().toISOString();

    try {
      // -------------------------------------------------------------
      // 1. Tavily Research Agent: Ingest keywords & query mechanics
      // -------------------------------------------------------------
      const searchQuery = this.deriveSearchQuery(prompt);
      logs.push({
        agent: 'Tavily-Research',
        action: 'Querying technical algorithms, combat balance math, and shader techniques',
        timestamp: now(),
        details: { query: searchQuery }
      });

      const tavilyResponse = await this.tavily.search(searchQuery, 'basic');
      const researchContext = tavilyResponse.answer
        ? `${tavilyResponse.answer}\n${tavilyResponse.results.map((r) => `- ${r.title}: ${r.content}`).join('\n')}`
        : tavilyResponse.results.map((r) => `- ${r.title}: ${r.content}`).join('\n');

      logs.push({
        agent: 'Tavily-Research',
        action: 'Synthesized research context for Director Agent',
        timestamp: now(),
        details: {
          resultsCount: tavilyResponse.results.length,
          summary: tavilyResponse.answer || 'Domain context compiled.'
        }
      });

      // -------------------------------------------------------------
      // 2. Game Director Agent (Nemotron 3 Ultra): Architect GDD & GDS
      // -------------------------------------------------------------
      logs.push({
        agent: 'Nemotron-3-Ultra-Director',
        action: 'Architecting Game Design Document, world layout, dialogue graphs, and combat schema',
        timestamp: now(),
        details: { prompt }
      });

      const directorResult = await this.nebius.generateDirectorGds(prompt, researchContext);
      let candidateGds = directorResult.gds as GameDefinition;

      logs.push({
        agent: 'Nemotron-3-Ultra-Director',
        action: 'Produced initial GDS schema',
        timestamp: now(),
        details: {
          title: candidateGds.meta?.title,
          zoneName: candidateGds.world?.zoneName,
          enemy: candidateGds.combat?.enemy?.name
        }
      });

      // -------------------------------------------------------------
      // 3. Graphics & SFX Agent (Nemotron Nano / Super)
      // -------------------------------------------------------------
      logs.push({
        agent: 'Nemotron-Nano-Graphics',
        action: 'Synthesizing custom WGSL compute particles and tilt-shift depth shaders',
        timestamp: now(),
        details: { theme: candidateGds.world?.theme || 'retro_hd2d' }
      });

      const shaderAndSfx = await this.nebius.generateShaderAndSfx(
        candidateGds.world?.theme || 'retro_hd2d',
        prompt
      );

      // Attach shaders
      candidateGds.shaders = {
        customWgsl: shaderAndSfx.customWgsl,
        bloom: { enabled: true, intensity: 1.5 },
        tiltShift: { enabled: true, blurRadius: 4 }
      };

      logs.push({
        agent: 'Nemotron-Nano-Audio',
        action: 'Synthesizing procedural retro chiptune audio frequencies and SFX envelopes',
        timestamp: now(),
        details: {
          sfxCount: Object.keys(shaderAndSfx.sfx || {}).length,
          bgmTheme: candidateGds.world?.theme || 'theme_loop'
        }
      });

      // Attach audio
      candidateGds.audio = {
        bgmTheme: candidateGds.world?.theme || 'theme_loop',
        sfx: shaderAndSfx.sfx
      };

      // -------------------------------------------------------------
      // 4. Pre-Flight Schema Verification & 1-Pass Auto-Repair Loop
      // -------------------------------------------------------------
      let validation = validateGameDefinition(candidateGds);

      if (!validation.isValid) {
        logs.push({
          agent: 'Nemotron-Auto-Repair',
          action: 'Detected GDS schema validation errors, triggering 1-pass repair loop',
          timestamp: now(),
          details: { errors: validation.errors }
        });

        // Execute repair pass
        const repairedCandidate = await this.nebius.repairGds(candidateGds, validation.errors);
        candidateGds = repairedCandidate as GameDefinition;

        // Re-validate post-repair
        validation = validateGameDefinition(candidateGds);

        // If edge cases remain, enforce deterministic fallback guarantees
        if (!validation.isValid) {
          candidateGds = this.nebius.deterministicRepair(
            candidateGds,
            validation.errors
          ) as GameDefinition;
          validation = validateGameDefinition(candidateGds);
        }

        logs.push({
          agent: 'Nemotron-Auto-Repair',
          action: 'Auto-repair pass completed',
          timestamp: now(),
          details: { isValid: validation.isValid, remainingErrors: validation.errors }
        });
      }

      return {
        success: validation.isValid,
        gds: candidateGds,
        agentLogs: logs,
        rawGdd: directorResult.rawResponse,
        validation
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // High-resilience fallback to deterministic mock generator
      const fallbackGds = this.nebius.getMockDirectorGds(prompt);
      const fallbackShaderAndSfx = this.nebius.getMockShaderAndSfx(
        fallbackGds.world.theme || 'retro_hd2d',
        prompt
      );
      fallbackGds.shaders = {
        customWgsl: fallbackShaderAndSfx.customWgsl,
        bloom: { enabled: true, intensity: 1.5 },
        tiltShift: { enabled: true, blurRadius: 4 }
      };
      fallbackGds.audio = {
        bgmTheme: fallbackGds.world.theme,
        sfx: fallbackShaderAndSfx.sfx
      };

      logs.push({
        agent: 'Nemotron-Auto-Repair',
        action: 'Pipeline exception encountered; engaged high-fidelity offline fallback',
        timestamp: now(),
        details: { error: errorMessage }
      });

      const validation = validateGameDefinition(fallbackGds);

      return {
        success: validation.isValid,
        gds: fallbackGds,
        agentLogs: logs,
        validation,
        error: errorMessage
      };
    }
  }

  /**
   * Constructs contextual search queries for Tavily based on keywords in user prompt.
   */
  private deriveSearchQuery(prompt: string): string {
    const p = prompt.toLowerCase();
    const keywords: string[] = [];

    if (p.includes('steampunk') || p.includes('clockwork')) {
      keywords.push('steampunk clockwork JRPG aesthetic');
    }
    if (p.includes('chronomancer') || p.includes('time')) {
      keywords.push('turn-based time manipulation combat mechanics');
    }
    if (p.includes('dragon') || p.includes('boss')) {
      keywords.push('JRPG boss encounter phase design balance formulas');
    }
    if (p.includes('cyber') || p.includes('neon') || p.includes('sci-fi')) {
      keywords.push('cyberpunk neon lighting WebGPU shader parameters');
    }

    if (keywords.length > 0) {
      return keywords.join(' AND ');
    }

    return `HD-2D turn-based JRPG combat balance formulas and WebGPU shaders for: ${prompt.slice(0, 50)}`;
  }
}

/**
 * Convenience entry point matching plan and brief interface:
 * generateGameFromPrompt(prompt: string, apiKeyOverrides?: ApiKeys): Promise<AgentGenerationResult>
 */
export async function generateGameFromPrompt(
  prompt: string,
  apiKeyOverrides?: ApiKeys
): Promise<AgentGenerationResult> {
  const orchestrator = new AgentOrchestrator(apiKeyOverrides);
  return orchestrator.generate(prompt);
}
