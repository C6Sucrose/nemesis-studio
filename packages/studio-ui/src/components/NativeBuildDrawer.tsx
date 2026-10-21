import React, { useState } from 'react';
import { GameDefinition } from '@nemesis/shared';
import { exportRustSourceProject } from '@nemesis/packager';

export interface NativeBuildDrawerProps {
  gds: GameDefinition;
  onExportSuccess?: (filename: string) => void;
}

export const NativeBuildDrawer: React.FC<NativeBuildDrawerProps> = ({ gds, onExportSuccess }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportedFile, setLastExportedFile] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const result = exportRustSourceProject(gds);
      const title = (gds.meta?.title || 'nemesis_rpg')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const filename = `${title}_bevy_native.zip`;

      // Trigger download via Blob
      if (typeof window !== 'undefined' && window.URL && typeof window.URL.createObjectURL === 'function') {
        const blob = new Blob([new Uint8Array(result.zipBuffer)], { type: 'application/zip' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        if (typeof window.URL.revokeObjectURL === 'function') {
          setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
        }
      }

      setLastExportedFile(filename);
      if (onExportSuccess) {
        onExportSuccess(filename);
      }
    } catch (err) {
      console.error('Failed to export native Rust project:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const tileCount = gds.world.tiles?.length ?? (gds.world.gridSize[0] * gds.world.gridSize[1]);
  const lightCount = gds.world.lights?.length ?? 1;
  const npcCount = gds.world.npcs?.length ?? 0;
  const enemyName = gds.combat.enemy.name;

  return (
    <footer className="h-20 bg-slate-900/95 border-t border-slate-800 text-slate-300 px-6 flex items-center justify-between select-none">
      {/* Platform & Engine Fidelity Indicators */}
      <div className="flex items-center space-x-6">
        <div>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold block">
            Target Platform Fidelity
          </span>
          <div className="flex items-center space-x-2 mt-0.5">
            <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Native Bevy / Vulkan 144+ FPS</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-medium">
              35° Isometric Tilt-Shift
            </span>
            <span className="hidden lg:inline-flex px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-medium">
              WGSL Compute Particles
            </span>
          </div>
        </div>

        {/* Engine World & Combat Stats */}
        <div className="hidden md:flex items-center space-x-4 pl-6 border-l border-slate-800 text-xs text-slate-400">
          <div>
            <span className="text-slate-500 text-[10px] uppercase block">Tiles</span>
            <span className="font-mono text-slate-200">{tileCount}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] uppercase block">Lights</span>
            <span className="font-mono text-slate-200">{lightCount}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] uppercase block">NPCs</span>
            <span className="font-mono text-slate-200">{npcCount}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] uppercase block">Enemy</span>
            <span className="font-mono text-rose-300">{enemyName}</span>
          </div>
        </div>
      </div>

      {/* 1-Click Native PC Exporter Button */}
      <div className="flex items-center space-x-3">
        {lastExportedFile && (
          <span className="hidden sm:inline-block text-xs text-emerald-400 font-mono">
            ✓ Exported {lastExportedFile}
          </span>
        )}
        <button
          data-testid="export-native-btn"
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium text-xs shadow-lg shadow-orange-950/40 border border-amber-400/30 active:scale-95 transition-all disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>{isExporting ? 'Packaging Rust Crate...' : 'Download Native PC Package (.zip)'}</span>
        </button>
      </div>
    </footer>
  );
};
