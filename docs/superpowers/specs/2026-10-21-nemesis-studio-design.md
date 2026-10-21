# Nemesis Studio: Design Document
**Date:** 2026-10-21  
**Project:** Nemesis Studio (Autonomous "Prompt-to-Playable" HD-2D JRPG Engine)  
**Target Tracks:** Best Apps & Agents Track, Coding & Agentic Engineering Track  
**Bonus Prize Target:** Best Use of Tavily ($3,000)  
**Status:** Approved & Finalized  

---

## 1. Intent and the "Why"
Creating video games has traditionally required disparate domain knowledge: systems architecture (Entity Component Systems), 3D graphics and shader programming (Vulkan/WGSL), game math (collision, pathfinding), audio synthesis, and narrative state machines. While single-prompt LLMs can produce trivial web toys (like Pong or Flappy Bird), they fail at generating coherent, multi-system video games with high graphical fidelity.

**Nemesis Studio** is an autonomous multi-agent game studio that converts natural language prompts or game design references into fully playable, multi-system **"HD-2D" Old-School JRPGs**. It targets two complementary runtimes:
1. **An Instant Web Sandbox (WebGPU / Three.js):** Launches in under two seconds in any modern browser for immediate judge testing and zero-friction sharing via public URL.
2. **A High-Performance Modern PC Native Build (Rust + Bevy):** Leverages modern PC hardware to run Vulkan Forward+ rendering with real-time dynamic point lighting, volumetric bloom, tilt-shift depth of field, and compute shader particle effects at 144+ FPS.

This project demonstrates deep agentic engineering, systems programming, and high visual/nostalgic appeal for judges and portfolios.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Autonomous Multi-System Generation:** The agent cluster must autonomously generate the core pillars of an old-school JRPG:
  - 3D Overworld exploration with grid/smooth player movement, collision, and camera tracking.
  - Interactive NPC with an AI-generated branching dialogue tree and quest flags.
  - Turn-based / Active-Time Battle (ATB) combat arena with action menus (Attack, Magic, Item, Flee), enemy AI, health/mana gauges, and victory fanfare.
  - Procedural retro audio synthesis (chiptune SFX for menu, sword hits, spells, and ambient loop).
- **Dual-Mode UI Workspace:**
  - *Pro Mode ("Dual-Cockpit"):* Left side streams multi-agent reasoning, ECS schema, and shader compilation; right side hosts the instant playable game canvas; bottom drawer manages native compilation and build artifacts. Developed first.
  - *Casual / Creator Mode:* Full-bleed immersive game viewport with a floating glassmorphism prompt bar and quick export toggles. Selectable on first launch and switchable in settings.
- **Deep Nebius & NVIDIA Open Source Model Integration:**
  - **Nemotron 3 Ultra:** Orchestrates game architecture, ECS relationships, combat state machines, and Rust memory-safe structures.
  - **Nemotron Super / Nano:** Rapid generation of GLSL/WGSL shaders, particle systems, procedural textures, and audio synthesizer code.
  - **Nebius Serverless Endpoints:** Serves low-latency agent generation APIs.
  - **Nebius Serverless Jobs:** Sandboxed background packaging of native Rust PC binaries, asset bundles, and automated headless regression test suites.
- **Best Use of Tavily:** Tavily acts as the engine's "Research Agent", querying algorithms, combat damage formulas, procedural dungeon/tilemap generators, and WebGL/WGSL shader implementations.

### Non-Goals
- Generating a 40-hour sprawling RPG campaign. The target is a pristine, playable **Vertical Slice** (an overworld zone, an NPC quest dialogue, and a full boss/enemy combat encounter).
- Complex photorealistic 3D AAA physics simulation (e.g. Unreal Chaos destruction); the project deliberately targets the stylish "HD-2D" aesthetic (Octopath Traveler style: 2D pixel characters billboarded in dynamic 3D lighting).

### Anti-Goals
- **Pre-baked or "Fake" AI:** No hardcoded demo mockups that do not genuinely respond to user prompts or runtime compilation. The agent loop must write, validate, and hot-reload executable game code.
- **Web-Only Toy:** The project must not be limited to an in-browser canvas; the native Rust/Vulkan desktop runtime is a first-class citizen for modern PC fidelity and performance.

---

## 3. Constraints & Submission Requirements
- **NVIDIA Models:** Must use open source NVIDIA models (NVIDIA Nemotron family: Nemotron 3 Ultra, Nano, Super) hosted on Nebius Token Factory.
- **Nebius Infrastructure:** Must run on Nebius Token Factory or Nebius AI Cloud (leveraging Nebius Serverless Endpoints and Jobs).
- **Deliverables:**
  - Public GitHub repository with open source license (MIT or Apache 2.0) and clear README.
  - Working hosted public URL for instant browser playability.
  - Downloadable native Windows/Linux desktop release artifact (compiled Rust/Bevy executable).
  - High-impact ≤3-minute YouTube demonstration video.
  - Written feedback on Nebius Token Factory and NVIDIA tools.

---

## 4. Architectural Decisions & Tech Stack

### 4.1 Dual Runtime & Delivery Architecture
- **Data-Driven Core:** The agent cluster generates a unified **Game Definition Specification (GDS)**:
  - Declarative JSON ECS entities, components, and systems.
  - Dialogue state machines and quest variables.
  - Combat formula tables and enemy behavior trees.
  - Custom WGSL / GLSL procedural shaders and lighting parameters.
- **Web Runtime (Instant Play):**
  - High-performance Three.js / WebGPU interpreter that executes the GDS directly in the browser at 60 FPS without compilation lag.
- **Native PC Runtime (Dual-Delivery Model):**
  1. *Instant Downloadable Release (.exe):* Nebius Serverless bundles the generated GDS, WGSL shaders, and procedural assets into a pre-compiled high-performance Rust/Bevy runner in under 3 seconds so judges can immediately run the game locally on modern PC hardware.
  2. *Full Source Export:* The studio also exports the complete, documented Rust source code (`main.rs`, `Cargo.toml`, custom systems) for developers to inspect or compile locally with `cargo run`.

### 4.2 Multi-Agent Orchestration Loop
1. **Game Director Agent (Nemotron 3 Ultra):** Ingests prompt -> designs Game Design Document (GDD), entity component definitions (Stats, Health, Inventory, Position, State), dialogue graphs, and battle state transitions.
2. **Graphics & Shader Agent (Nemotron Nano / Super):** Generates procedural sprite data (procedural pixel art / sprite atlas), 3D tile environment geometry, and WGSL/GLSL shaders (fog, lighting, tilt-shift blur, spell FX).
3. **Sound & SFX Agent (Nemotron Nano):** Synthesizes procedural audio parameters (pitch envelopes, frequency modulation, noise bursts for hits).
4. **Research Agent (Tavily):** Searches technical repositories and documentation for specialized JRPG algorithms (e.g., ATB charge formulas, A* pathfinding, Bresenham line-of-sight).
5. **Self-Healing Test Harness (Nebius Serverless):** Dual-tier verification:
   - Server-side pre-flight JSON/WGSL syntax and type verification before delivering to the frontend.
   - Client-side error telemetry boundary that captures unhandled exceptions and triggers an automated repair prompt to Nemotron.

### 4.3 Studio Frontend (Next.js / Vite + React)
- **Pro Mode Workspace (Default):**
  - Left Panel: Multi-Agent Activity & Thought Stream (collapsible tabs: GDD, ECS Inspector, Shader Source, Tavily Queries).
  - Center/Right: Live WebGPU interactive canvas with keyboard (WASD / Arrows) and mouse/touch controls.
  - Bottom Drawer: Native Build Terminal showing compilation status, compiler warnings/errors, and a "Download Native PC Release (.exe)" button.
- **Creator Overlay:**
  - One-click toggle in top header or settings.
  - Hides sidebars and expands the viewport full-screen.
  - Floating bottom prompt bar with quick mutation buttons (*"Increase bloom"*, *"Add fire magic"*, *"Change boss phase"*).
  - Mutations execute a clean re-generation pass seeded with current state to reliably update the game without broken state migration.
- **Onboarding Flow:**
  - First-time launch modal asking: *"Choose Your View: Pro Studio (for Engineers/Judges) vs Creator Canvas (for Players)"*.

---

## 5. What is Left to the Builder
- Selection of specific frontend styling framework (Tailwind CSS with dark theme).
- Exact procedural pixel-art generation approach (procedural canvas drawing of sprite sheets vs SVG matrix synthesis).
- Packaging script structure for Rust/Bevy native desktop runner bundling.
- Specific default sample prompts to showcase in the UI for effortless 1-click judging.
