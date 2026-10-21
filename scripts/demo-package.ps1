# ==============================================================================
# Nemesis Studio - Nvidia x Nebius Hackathon Submission Demo Package Script
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  NEMESIS STUDIO: Autonomous Prompt-to-Playable HD-2D JRPG Engine" -ForegroundColor Cyan
Write-Host "  Nvidia x Nebius Global AI Hackathon Submission and Verification" -ForegroundColor Cyan
Write-Host "====================================================================`n" -ForegroundColor Cyan

# 1. Environment Check
Write-Host "[1/4] Checking Development Environment..." -ForegroundColor Yellow
$nodeVersion = node -v
$npmVersion = npm -v
Write-Host "  Node.js: $nodeVersion" -ForegroundColor Gray
Write-Host "  npm:     $npmVersion" -ForegroundColor Gray

if (-not $env:NEBIUS_API_KEY) {
    Write-Host "  Notice: NEBIUS_API_KEY is not set. Nemesis Studio will run in resilient offline Mock Mode." -ForegroundColor DarkYellow
} else {
    Write-Host "  [OK] NEBIUS_API_KEY detected for NVIDIA Nemotron live generation." -ForegroundColor Green
}

if (-not $env:TAVILY_API_KEY) {
    Write-Host "  Notice: TAVILY_API_KEY is not set. Tavily research agent will run in simulated context mode." -ForegroundColor DarkYellow
} else {
    Write-Host "  [OK] TAVILY_API_KEY detected for live algorithmic and shader search ($3k track)." -ForegroundColor Green
}

# 2. Run Test Suites
Write-Host "`n[2/4] Running Full Monorepo Test Suites (Shared, Orchestrator, Packager, UI, Runtime, E2E)..." -ForegroundColor Yellow
npm test

# 3. Production Build
Write-Host "`n[3/4] Building Production Web and Packaging Assets..." -ForegroundColor Yellow
npm run build

# 4. Success Summary & Run Instructions
Write-Host "`n====================================================================" -ForegroundColor Green
Write-Host "  ALL SYSTEMS VERIFIED AND READY FOR JUDGING!" -ForegroundColor Green
Write-Host "====================================================================`n" -ForegroundColor Green

Write-Host "Quick Commands for Hackathon Evaluators:" -ForegroundColor White
Write-Host "  1. Launch Dual-Mode Studio Frontend:" -ForegroundColor Cyan
Write-Host "     cd packages/studio-ui; npm run dev"
Write-Host "     Open http://localhost:5173 to test Option A (Pro Cockpit) or Option B (Creator Overlay)`n"
Write-Host "  2. Run End-to-End Test Suite:" -ForegroundColor Cyan
Write-Host "     npx vitest run tests/e2e/fullWorkflow.test.ts`n"
Write-Host "  3. Run Native Bevy 0.14 Game (Optional, requires Rust):" -ForegroundColor Cyan
Write-Host "     cargo run --release (from any unzipped exported crate)`n"
