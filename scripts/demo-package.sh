#!/usr/bin/env bash
# ==============================================================================
# Nemesis Studio - Nvidia x Nebius Hackathon Submission & Demo Package Script
# ==============================================================================
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}  ⚔️  NEMESIS STUDIO: Autonomous Prompt-to-Playable HD-2D JRPG Engine${NC}"
echo -e "${CYAN}  Nvidia x Nebius Global AI Hackathon Submission & Verification Suite${NC}"
echo -e "${CYAN}====================================================================${NC}\n"

# 1. Environment Check
echo -e "${YELLOW}[1/4] Checking Development Environment...${NC}"
node -v || { echo -e "${RED}Node.js is required!${NC}"; exit 1; }
npm -v || { echo -e "${RED}npm is required!${NC}"; exit 1; }

if [ -z "$NEBIUS_API_KEY" ]; then
  echo -e "${YELLOW}  Notice: NEBIUS_API_KEY is not set. Nemesis Studio will run in resilient offline Mock Mode.${NC}"
else
  echo -e "${GREEN}  ✓ NEBIUS_API_KEY detected for NVIDIA Nemotron live generation.${NC}"
fi

if [ -z "$TAVILY_API_KEY" ]; then
  echo -e "${YELLOW}  Notice: TAVILY_API_KEY is not set. Tavily research agent will run in simulated context mode.${NC}"
else
  echo -e "${GREEN}  ✓ TAVILY_API_KEY detected for live algorithmic & shader search ($3k track).${NC}"
fi

# 2. Run Test Suites
echo -e "\n${YELLOW}[2/4] Running Full Monorepo Test Suites (Shared, Orchestrator, Packager, UI, Runtime, E2E)...${NC}"
npm test

# 3. Production Build
echo -e "\n${YELLOW}[3/4] Building Production Web & Packaging Assets...${NC}"
npm run build

# 4. Success Summary & Run Instructions
echo -e "\n${GREEN}====================================================================${NC}"
echo -e "${GREEN}  ✓ ALL SYSTEMS VERIFIED & READY FOR JUDGING!${NC}"
echo -e "${GREEN}====================================================================${NC}\n"

echo -e "Quick Commands for Hackathon Evaluators:"
echo -e "  ${CYAN}1. Launch Dual-Mode Studio Frontend:${NC}"
echo -e "     cd packages/studio-ui && npm run dev"
echo -e "     Open http://localhost:5173 to test Option A (Pro Cockpit) or Option B (Creator Overlay)\n"
echo -e "  ${CYAN}2. Run End-to-End Test Suite:${NC}"
echo -e "     npx vitest run tests/e2e/fullWorkflow.test.ts\n"
echo -e "  ${CYAN}3. Run Native Bevy 0.14 Game (Optional, requires Rust):${NC}"
echo -e "     cargo run --release (from any unzipped exported crate)\n"
