# Nemesis Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Nemesis Studio", an autonomous AI game development environment that translates natural language prompts into complete, playable "HD-2D" Old-School JRPGs running simultaneously on an instant WebGPU in-browser sandbox and an exportable native Rust/Bevy PC release.

**Architecture:** A multi-agent pipeline orchestrated with NVIDIA Nemotron models (Ultra for systems reasoning, Nano/Super for shaders and procedural sound) and Tavily queries produces a declarative Game Definition Specification (GDS). This GDS is immediately rendered in an interactive Three.js/WebGPU engine in the browser (with Pro Developer and Creator Overlay UI modes) and packaged into a pre-compiled native Bevy PC runner alongside exportable Rust source code.

**Tech Stack:** TypeScript, React, Vite, Tailwind CSS, Three.js, WebGPU, Web Audio API, Rust (Bevy Engine, wgpu), Python/Node (FastAPI/Express for agent orchestrator), Nebius Token Factory SDK (Nemotron 3 Ultra, Super, Nano), Tavily API.

**Spec:** [2026-10-21-nemesis-studio-design.md](file:///e:/Code/Nvidia%20Hackathon/docs/superpowers/specs/2026-10-21-nemesis-studio-design.md)

## Global Constraints
- **NVIDIA Models:** Must use NVIDIA open-source models (Nemotron 3 Ultra, Nano, Super) served via Nebius Token Factory.
- **Nebius Cloud Infrastructure:** Must integrate Nebius Serverless Endpoints for agent serving and Nebius Serverless Jobs for packaging/test runs.
- **Bonus Prize Integration:** Active Tavily search for game algorithms, shaders, and combat math.
- **Dual Target Delivery:** Instant <2s WebGPU browser playback and <3s downloadable native PC bundle + clean exportable Rust code.
- **Open Source Licensing:** MIT or Apache 2.0 license with public GitHub repository readiness.

## Review Focus
1. **Malformed or Circular Dialogue Graphs:** If an agent generates an NPC dialogue node pointing to a non-existent child ID, the dialogue system must gracefully terminate or fallback without crashing the engine.
2. **WebGPU Hardware Fallback:** If a judge runs an older browser without WebGPU enabled, the Three.js renderer must gracefully fallback to WebGL without crashing.
3. **Turn-based Combat State Deadlock:** If both the player and enemy HP reach zero simultaneously or an invalid action is dispatched, the combat state machine must cleanly resolve to a victory/defeat screen.
4. **Offline / Missing API Key Resilience:** When running without active Nebius or Tavily API keys (e.g. during local evaluation or network failure), the studio must use high-fidelity cached fallback generators.
5. **Audio Context Autoplay Policy:** Browsers block audio until the first user interaction; the sound synthesizer must queue audio nodes and unlock smoothly on the first keypress or click without console warnings.

---

### Task 1: Core Game Definition Schema (GDS) & Type Validation Engine

**Files:**
- Create: `packages/shared/src/types/gds.ts`
- Create: `packages/shared/src/validator/validateGds.ts`
- Test: `packages/shared/tests/validateGds.test.ts`

**Interfaces:**
- Consumes: None (root foundational schema)
- Produces: `GameDefinition`, `ValidationResult`, `validateGameDefinition(gds: unknown): ValidationResult`

- [ ] **Step 1: Write the failing test for GDS validation**

```typescript
// packages/shared/tests/validateGds.test.ts
import { describe, it, expect } from 'vitest';
import { validateGameDefinition } from '../src/validator/validateGds';

describe('validateGameDefinition', () => {
  it('validates a valid minimal HD-2D JRPG game definition', () => {
    const validGds = {
      meta: { title: 'Clockwork Fate', author: 'Nemesis AI', version: '1.0.0' },
      world: {
        zoneName: 'Cathedral Grounds',
        gridSize: [20, 20],
        playerStart: [5, 5],
        tiles: [{ x: 5, y: 5, type: 'cobblestone', walkable: true }],
        lights: [{ type: 'point', position: [5, 2, 5], color: '#ffaa44', intensity: 2.0 }]
      },
      dialogue: {
        initialNodeId: 'node_1',
        nodes: {
          node_1: { text: 'Welcome traveler.', choices: [{ text: 'Who are you?', nextNodeId: 'node_2' }] },
          node_2: { text: 'I am the keeper of the clockwork.', choices: [] }
        }
      },
      combat: {
        enemy: { name: 'Clockwork Golem', hp: 120, maxHp: 120, attack: 15, defense: 5 },
        player: { name: 'Chronomancer', hp: 100, maxHp: 100, mp: 40, maxMp: 40, attack: 20, defense: 8 }
      }
    };
    const result = validateGameDefinition(validGds);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects dangling dialogue pointers and missing entities', () => {
    const invalidGds = {
      meta: { title: 'Broken Game' },
      world: { gridSize: [10, 10] },
      dialogue: {
        initialNodeId: 'node_1',
        nodes: {
          node_1: { text: 'Broken', choices: [{ text: 'Go', nextNodeId: 'non_existent_node' }] }
        }
      }
    };
    const result = validateGameDefinition(invalidGds);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('non_existent_node'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/shared/tests/validateGds.test.ts`  
Expected: FAIL with module/function not found.

- [ ] **Step 3: Implement GDS interfaces and `validateGameDefinition`**

Define `GameDefinition` and validator in `packages/shared/src/types/gds.ts` and `packages/shared/src/validator/validateGds.ts`, checking required fields, grid boundaries, dialogue graph integrity, and combat stats.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/shared/tests/validateGds.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): implement Game Definition Specification types and validator"
```

---

### Task 2: Multi-Agent Orchestration Service (Nemotron 3 Ultra + Nano + Tavily)

**Files:**
- Create: `packages/agent-orchestrator/src/services/nebiusClient.ts`
- Create: `packages/agent-orchestrator/src/services/tavilyClient.ts`
- Create: `packages/agent-orchestrator/src/orchestrator.ts`
- Test: `packages/agent-orchestrator/tests/orchestrator.test.ts`

**Interfaces:**
- Consumes: `GameDefinition`, `validateGameDefinition` from `packages/shared`
- Produces: `generateGameFromPrompt(prompt: string, apiKeyOverrides?: ApiKeys): Promise<AgentGenerationResult>`

- [ ] **Step 1: Write the failing test for agent orchestration**

```typescript
// packages/agent-orchestrator/tests/orchestrator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateGameFromPrompt } from '../src/orchestrator';

describe('generateGameFromPrompt', () => {
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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/agent-orchestrator/tests/orchestrator.test.ts`  
Expected: FAIL with function undefined.

- [ ] **Step 3: Implement Nebius & Tavily clients and `generateGameFromPrompt`**

In `packages/agent-orchestrator/src/orchestrator.ts`, implement the multi-tier workflow:
1. Director Agent (Nemotron 3 Ultra system prompt) designs GDD and world/combat schema.
2. Tavily queries balance formulas or shader algorithms when obscure keywords appear.
3. Graphics & SFX Agent (Nemotron Nano) populates custom particle WGSL code and audio frequencies.
4. Validation check via `validateGameDefinition`; if errors occur, auto-correct using Nemotron in a 1-pass repair loop.
5. Provide a deterministic offline mock generator for testing and offline hackathon setups.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/agent-orchestrator/tests/orchestrator.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/agent-orchestrator/
git commit -m "feat(orchestrator): implement Nemotron and Tavily multi-agent pipeline"
```

---

### Task 3: Instant Web Preview Runtime (WebGPU / Three.js HD-2D Engine)

**Files:**
- Create: `packages/web-runtime/src/engine/HD2DRenderer.ts`
- Create: `packages/web-runtime/src/engine/OverworldController.ts`
- Create: `packages/web-runtime/src/engine/CombatStateMachine.ts`
- Create: `packages/web-runtime/src/engine/DialogueController.ts`
- Test: `packages/web-runtime/tests/combatStateMachine.test.ts`
- Test: `packages/web-runtime/tests/dialogueController.test.ts`

**Interfaces:**
- Consumes: `GameDefinition` from `packages/shared`
- Produces: `HD2DGameEngine(canvas: HTMLCanvasElement, gds: GameDefinition)` with start/pause/destroy, combat dispatch, and dialogue callbacks.

- [ ] **Step 1: Write failing tests for combat state machine and dialogue controller**

```typescript
// packages/web-runtime/tests/combatStateMachine.test.ts
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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/web-runtime/tests/combatStateMachine.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement Three.js HD-2D Renderer and State Machines**

1. `HD2DRenderer.ts`: Setup Three.js scene, perspective camera with 35-degree tilt-shift isometric angle, ambient and dynamic point lighting with shadow maps, 3D tile ground, and 2D billboard sprite quad with alpha testing.
2. `OverworldController.ts`: Handle keyboard/WASD inputs, grid bounds, collision, and encounter trigger.
3. `CombatStateMachine.ts`: Turn-based loop with damage calculation formula `max(1, attack - defense)`, mana checks for magic, and victory/defeat resolution.
4. `DialogueController.ts`: Graph traversal through dialogue nodes with safe fallback on invalid IDs.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/web-runtime/tests/combatStateMachine.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web-runtime/
git commit -m "feat(web-runtime): implement HD-2D Three.js renderer, combat state machine, and dialogue controller"
```

---

### Task 4: Procedural Web Audio Synthesizer Engine

**Files:**
- Create: `packages/web-runtime/src/audio/ProceduralAudioEngine.ts`
- Test: `packages/web-runtime/tests/audioEngine.test.ts`

**Interfaces:**
- Consumes: Sound FX and music parameters from `GameDefinition`
- Produces: `ProceduralAudioEngine` with `playSfx(type: 'SELECT' | 'ATTACK' | 'MAGIC' | 'VICTORY')`, `startBgm()`, `stopBgm()`

- [ ] **Step 1: Write failing test for audio parameter mapping**

```typescript
// packages/web-runtime/tests/audioEngine.test.ts
import { describe, it, expect } from 'vitest';
import { getSfxConfig } from '../src/audio/ProceduralAudioEngine';

describe('ProceduralAudioEngine', () => {
  it('provides retro oscillator parameters for each sound event', () => {
    const attackSfx = getSfxConfig('ATTACK');
    expect(attackSfx.oscillatorType).toBe('sawtooth');
    expect(attackSfx.startFreq).toBeGreaterThan(attackSfx.endFreq); // frequency drop
    expect(attackSfx.duration).toBeLessThanOrEqual(0.3);

    const victorySfx = getSfxConfig('VICTORY');
    expect(victorySfx.notes.length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/web-runtime/tests/audioEngine.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement Web Audio synthesis graph**

Implement `ProceduralAudioEngine.ts` using Web Audio `AudioContext`, `OscillatorNode`, and `GainNode`. Handle browser autoplay restrictions by unlocking AudioContext on the first user click/keypress.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/web-runtime/tests/audioEngine.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web-runtime/src/audio/
git commit -m "feat(audio): implement procedural retro chiptune audio synthesizer"
```

---

### Task 5: High-Performance Native PC Bevy Runner & Source Exporter

**Files:**
- Create: `crates/nemesis-runner/Cargo.toml`
- Create: `crates/nemesis-runner/src/main.rs`
- Create: `crates/nemesis-runner/src/loader.rs`
- Create: `packages/packager/src/exportRustProject.ts`
- Test: `packages/packager/tests/exportRustProject.test.ts`

**Interfaces:**
- Consumes: `GameDefinition`
- Produces: `exportRustSourceProject(gds: GameDefinition): { files: Record<string, string>, zipBuffer: Buffer }` and pre-compiled native release runner.

- [ ] **Step 1: Write failing test for Rust project exporter**

```typescript
// packages/packager/tests/exportRustProject.test.ts
import { describe, it, expect } from 'vitest';
import { exportRustSourceProject } from '../src/exportRustProject';

describe('exportRustSourceProject', () => {
  it('generates a complete, valid Cargo.toml and main.rs configured with the game title', () => {
    const mockGds = {
      meta: { title: 'Neon Chrono', author: 'Nemesis AI', version: '1.0.0' },
      world: { zoneName: 'Neon City', gridSize: [15, 15] },
      combat: { enemy: { name: 'Cybergolem', hp: 100 } }
    } as any;

    const exported = exportRustSourceProject(mockGds);
    expect(exported.files['Cargo.toml']).toContain('bevy = "0.14"');
    expect(exported.files['src/main.rs']).toContain('Neon Chrono');
    expect(exported.files['assets/game_def.json']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/packager/tests/exportRustProject.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement Bevy Runner code and `exportRustSourceProject`**

1. Create `crates/nemesis-runner` with Bevy ECS, loading `game_def.json`, setting up a 3D orthographic/tilt-shift camera with bloom, spawning directional lights, and rendering billboard sprites.
2. In `exportRustProject.ts`, generate the complete Rust source tree and asset bundle, ready for 1-click zip download or background bundling via Nebius Serverless Job.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/packager/tests/exportRustProject.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates/ packages/packager/
git commit -m "feat(packager): implement native Bevy runner and Rust project source exporter"
```

---

### Task 6: Dual-Mode Studio Frontend (Pro Workspace & Creator Overlay)

**Files:**
- Create: `packages/studio-ui/src/App.tsx`
- Create: `packages/studio-ui/src/components/ProStudioCockpit.tsx`
- Create: `packages/studio-ui/src/components/CreatorOverlay.tsx`
- Create: `packages/studio-ui/src/components/AgentThoughtStream.tsx`
- Create: `packages/studio-ui/src/components/NativeBuildDrawer.tsx`
- Create: `packages/studio-ui/src/components/GameCanvas.tsx`
- Test: `packages/studio-ui/tests/appModes.test.tsx`

**Interfaces:**
- Consumes: `generateGameFromPrompt` (Task 2), `HD2DGameEngine` (Task 3), `exportRustSourceProject` (Task 5)
- Produces: Interactive Studio Web App with Pro/Creator toggle, real-time agent visualization, live playable canvas, and 1-click `.exe` / Rust source export.

- [ ] **Step 1: Write failing component test for mode switching**

```typescript
// packages/studio-ui/tests/appModes.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';

describe('App Studio Workspace', () => {
  it('renders Pro Studio by default and allows toggling to Creator Overlay', async () => {
    render(<App />);
    expect(screen.getByText(/Pro Studio/i)).toBeInTheDocument();
    expect(screen.getByText(/Agent Activity/i)).toBeInTheDocument();

    const switchBtn = screen.getByTestId('mode-toggle-btn');
    fireEvent.click(switchBtn);
    expect(screen.getByTestId('creator-overlay-bar')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/studio-ui/tests/appModes.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Implement React UI components with Tailwind CSS**

1. Build `ProStudioCockpit.tsx`: Left split view showing Nemotron Ultra, Nano, and Tavily streaming logs, center interactive Three.js GameCanvas, and bottom NativeBuildDrawer with download button.
2. Build `CreatorOverlay.tsx`: Full-bleed canvas with floating bottom prompt bar and quick mutation pills (*"Add fire magic"*, *"Increase bloom"*).
3. Connect first-launch onboarding modal and persistent localStorage settings for default mode preference.
4. Add 1-click sample prompt button (*"Playground: Clockwork Chronomancer"*).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/studio-ui/tests/appModes.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/studio-ui/
git commit -m "feat(ui): implement Dual-Mode Pro Studio cockpit and Creator overlay"
```

---

### Task 7: End-to-End Integration, Hackathon Demo Assets & Submission Package

**Files:**
- Create: `README.md` (Hackathon overview, architecture diagrams, Nebius & NVIDIA setup, quickstart)
- Create: `LICENSE` (Apache 2.0)
- Create: `scripts/demo-package.sh`
- Create: `tests/e2e/fullWorkflow.test.ts`
- Test: `tests/e2e/fullWorkflow.test.ts`

**Interfaces:**
- Consumes: All packages (`shared`, `agent-orchestrator`, `web-runtime`, `packager`, `studio-ui`)
- Produces: Fully integrated hackathon deliverable ready for video recording and deployment.

- [ ] **Step 1: Write E2E test for prompt-to-playable workflow**

```typescript
// tests/e2e/fullWorkflow.test.ts
import { describe, it, expect } from 'vitest';
import { generateGameFromPrompt } from '../../packages/agent-orchestrator/src/orchestrator';
import { validateGameDefinition } from '../../packages/shared/src/validator/validateGds';
import { exportRustSourceProject } from '../../packages/packager/src/exportRustProject';

describe('Full End-to-End Game Generation', () => {
  it('generates, validates, and exports a complete HD-2D JRPG from prompt', async () => {
    const prompt = 'An exiled sorceress in a neon crystal sanctuary battling corrupted automata';
    const result = await generateGameFromPrompt(prompt, { mockMode: true });

    expect(result.success).toBe(true);
    const validation = validateGameDefinition(result.gds);
    expect(validation.isValid).toBe(true);

    const exported = exportRustSourceProject(result.gds);
    expect(exported.files['Cargo.toml']).toBeDefined();
    expect(exported.files['src/main.rs']).toContain('neon crystal sanctuary');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/e2e/fullWorkflow.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement E2E integration and create README & submission assets**

1. Wire all modules together and ensure all unit and E2E tests pass cleanly.
2. Author comprehensive `README.md` covering:
   - Live demo URL and video link.
   - Nebius Token Factory & NVIDIA Nemotron usage details.
   - Tavily search integration details ($3k prize category).
   - Setup and local build instructions.
3. Include Apache 2.0 `LICENSE`.

- [ ] **Step 4: Run full test suite to verify all pass**

Run: `pnpm test`  
Expected: All test suites PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md LICENSE scripts/ tests/e2e/
git commit -m "chore: complete end-to-end integration, documentation, and hackathon submission assets"
```
