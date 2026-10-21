import React, { useState } from 'react';
import { GameDefinition } from '@nemesis/shared';
import { GameCanvas } from './GameCanvas';

export interface CreatorOverlayProps {
  gds: GameDefinition;
  isGenerating: boolean;
  prompt: string;
  onPromptChange: (val: string) => void;
  onGenerate: (promptToUse?: string) => void;
  onToggleMode: () => void;
  onQuickMutate?: (type: 'fire_magic' | 'increase_bloom') => void;
}

export const CreatorOverlay: React.FC<CreatorOverlayProps> = ({
  gds,
  isGenerating,
  prompt,
  onPromptChange,
  onGenerate,
  onToggleMode,
  onQuickMutate
}) => {
  const [localPrompt, setLocalPrompt] = useState(prompt);

  const sampleChips = [
    { label: 'Clockwork Chronomancer', prompt: 'Clockwork Chronomancer in a brass clocktower with turn-based time dilation' },
    { label: 'Neon Ronin', prompt: 'Cyberpunk neon ronin katana combat in rain-slicked neo-tokyo alleyways' },
    { label: 'Add fire magic', action: 'fire_magic' },
    { label: 'Increase bloom', action: 'increase_bloom' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localPrompt.trim() || isGenerating) return;
    onPromptChange(localPrompt);
    onGenerate(localPrompt);
  };

  const handleChipClick = (chip: typeof sampleChips[0]) => {
    if (chip.action) {
      if (onQuickMutate) {
        onQuickMutate(chip.action as 'fire_magic' | 'increase_bloom');
      } else {
        const mutatedPrompt = `${gds.meta?.title || 'Game'} with ${chip.label.toLowerCase()}`;
        setLocalPrompt(mutatedPrompt);
        onPromptChange(mutatedPrompt);
        onGenerate(mutatedPrompt);
      }
    } else if (chip.prompt) {
      setLocalPrompt(chip.prompt);
      onPromptChange(chip.prompt);
      onGenerate(chip.prompt);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Full-bleed Canvas */}
      <GameCanvas gds={gds} className="w-full h-full" />

      {/* Top Floating Header with Pro Studio Toggle */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30 pointer-events-none">
        <div className="pointer-events-auto flex items-center space-x-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700/60 shadow-xl">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-bold text-sm text-slate-100">{gds.meta?.title || 'Nemesis Studio'}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/80 font-mono">
            Creator Mode
          </span>
        </div>

        <button
          data-testid="mode-toggle-btn"
          onClick={onToggleMode}
          className="pointer-events-auto flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium shadow-xl backdrop-blur-md transition-all active:scale-95"
        >
          <span>Pro Studio Cockpit</span>
          <span className="text-slate-400">⚙</span>
        </button>
      </div>

      {/* Floating Bottom Prompt Bar */}
      <div
        data-testid="creator-overlay-bar"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-30 space-y-2 pointer-events-auto"
      >
        {/* Sample Chips / Quick Mutation Pills */}
        <div className="flex items-center justify-center space-x-2 overflow-x-auto py-1">
          {sampleChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleChipClick(chip)}
              disabled={isGenerating}
              className="px-3 py-1 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700/80 hover:border-cyan-500/50 text-[11px] font-medium backdrop-blur-md transition-all active:scale-95 whitespace-nowrap shadow-md disabled:opacity-50"
            >
              {chip.action ? `✨ ${chip.label}` : `🎮 ${chip.label}`}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2 shadow-2xl space-x-2 focus-within:border-cyan-500/80 transition-colors"
        >
          <input
            type="text"
            value={localPrompt}
            onChange={(e) => {
              setLocalPrompt(e.target.value);
              onPromptChange(e.target.value);
            }}
            placeholder="Type a JRPG prompt or mutation (e.g. 'Clockwork Chronomancer')..."
            disabled={isGenerating}
            className="flex-1 bg-transparent px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />

          <button
            type="submit"
            disabled={isGenerating || !localPrompt.trim()}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center space-x-1.5"
          >
            {isGenerating ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Forging...</span>
              </>
            ) : (
              <span>Forge</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
