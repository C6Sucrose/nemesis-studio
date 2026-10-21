import React from 'react';

export interface FirstLaunchModalProps {
  isOpen: boolean;
  onSelectMode: (mode: 'pro' | 'creator') => void;
  onClose: () => void;
}

export const FirstLaunchModal: React.FC<FirstLaunchModalProps> = ({
  isOpen,
  onSelectMode,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-6 animate-fadeIn">
        <div className="text-center space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
            Welcome to Nemesis Studio
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-slate-100">
            Choose Your Studio Experience
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Autonomous Prompt-to-Playable HD-2D JRPG Engine powered by NVIDIA Nemotron & Rust Bevy. You can switch modes at any time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option A: Pro Studio Cockpit */}
          <button
            onClick={() => {
              onSelectMode('pro');
              onClose();
            }}
            className="flex flex-col text-left p-5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border-2 border-slate-700/60 hover:border-purple-500/80 transition-all group space-y-2.5 active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-mono">
                Option A
              </span>
              <span className="text-purple-400 text-sm group-hover:translate-x-1 transition-transform">
                →
              </span>
            </div>
            <h3 className="font-semibold text-slate-100 text-sm">Professional Cockpit (Option A)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Full multi-agent thought streams (Nemotron 3 Ultra, Nano, Tavily), interactive viewport inspection, and 1-click Native Bevy source package exporter.
            </p>
          </button>

          {/* Option B: Creator Overlay */}
          <button
            onClick={() => {
              onSelectMode('creator');
              onClose();
            }}
            className="flex flex-col text-left p-5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border-2 border-slate-700/60 hover:border-sky-500/80 transition-all group space-y-2.5 active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-mono">
                Option B
              </span>
              <span className="text-sky-400 text-sm group-hover:translate-x-1 transition-transform">
                →
              </span>
            </div>
            <h3 className="font-semibold text-slate-100 text-sm">Creator Overlay (Option B)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Distraction-free full-bleed canvas with floating prompt bar and instant mutation chips (*"Add fire magic"*, *"Increase bloom"*).
            </p>
          </button>
        </div>

        <div className="flex justify-center pt-2">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 transition underline underline-offset-4"
          >
            Skip and continue to Cockpit
          </button>
        </div>
      </div>
    </div>
  );
};
