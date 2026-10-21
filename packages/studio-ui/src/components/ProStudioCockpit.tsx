import React, { useState } from 'react';
import { GameDefinition } from '@nemesis/shared';
import { AgentLogEntry } from '@nemesis/agent-orchestrator';
import { AgentThoughtStream } from './AgentThoughtStream';
import { GameCanvas } from './GameCanvas';
import { NativeBuildDrawer } from './NativeBuildDrawer';

export interface ProStudioCockpitProps {
  gds: GameDefinition;
  agentLogs: AgentLogEntry[];
  isGenerating: boolean;
  prompt: string;
  onPromptChange: (val: string) => void;
  onGenerate: (promptToUse?: string) => void;
  onToggleMode: () => void;
}

export const ProStudioCockpit: React.FC<ProStudioCockpitProps> = ({
  gds,
  agentLogs,
  isGenerating,
  prompt,
  onPromptChange,
  onGenerate,
  onToggleMode
}) => {
  const [localPrompt, setLocalPrompt] = useState(prompt);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localPrompt.trim() || isGenerating) return;
    onPromptChange(localPrompt);
    onGenerate(localPrompt);
  };

  const handleSamplePrompt = () => {
    const sample = 'Clockwork Chronomancer in a brass clocktower';
    setLocalPrompt(sample);
    onPromptChange(sample);
    onGenerate(sample);
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Header & Prompt Cockpit Bar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-20">
        {/* Branding & Mode Indicator */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-gradient-to-tr from-purple-500 to-amber-500 shadow-lg shadow-purple-500/50" />
            <h1 className="font-extrabold text-base tracking-wide bg-gradient-to-r from-slate-100 via-amber-200 to-amber-500 bg-clip-text text-transparent">
              Nemesis Studio
            </h1>
          </div>

          <span className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-purple-950/80 border border-purple-700/60 text-purple-300 text-xs font-medium">
            <span>Pro Studio</span>
          </span>

          <span className="hidden md:inline-block text-xs text-slate-400 font-mono">
            &bull; {gds.meta?.title || 'Loaded JRPG'}
          </span>
        </div>

        {/* Center Prompt Input */}
        <form onSubmit={handleSubmit} className="flex-1 max-w-xl mx-4 flex items-center space-x-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={localPrompt}
              onChange={(e) => {
                setLocalPrompt(e.target.value);
                onPromptChange(e.target.value);
              }}
              placeholder="Describe your dream HD-2D JRPG (e.g. 'Clockwork Chronomancer')..."
              disabled={isGenerating}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isGenerating || !localPrompt.trim()}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center space-x-1.5 whitespace-nowrap"
          >
            {isGenerating ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Forging...</span>
              </>
            ) : (
              <span>Forge JRPG</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleSamplePrompt}
            disabled={isGenerating}
            title="Load Playground Sample Prompt"
            className="hidden lg:inline-flex px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-600/30 text-xs transition whitespace-nowrap"
          >
            Playground: Clockwork Chronomancer
          </button>
        </form>

        {/* Right Toggle to Creator Overlay */}
        <div className="flex items-center space-x-3">
          <button
            data-testid="mode-toggle-btn"
            onClick={onToggleMode}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition active:scale-95"
          >
            <span>Creator Overlay</span>
            <span className="text-cyan-400">✨</span>
          </button>
        </div>
      </header>

      {/* Main Split: Left Thought Stream + Center Game Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Agent Thought Stream */}
        <AgentThoughtStream logs={agentLogs} isGenerating={isGenerating} />

        {/* Center Interactive Game Canvas */}
        <main className="flex-1 relative overflow-hidden bg-slate-950">
          <GameCanvas gds={gds} className="w-full h-full" />
        </main>
      </div>

      {/* Bottom Native Build Drawer */}
      <NativeBuildDrawer gds={gds} />
    </div>
  );
};
