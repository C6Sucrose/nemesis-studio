import React, { useState, useEffect, useCallback } from 'react';
import { GameDefinition } from '@nemesis/shared';
import { generateGameFromPrompt, AgentLogEntry } from '@nemesis/agent-orchestrator';
import { STARTER_GDS, INITIAL_AGENT_LOGS } from './constants/starterGds';
import { ProStudioCockpit } from './components/ProStudioCockpit';
import { CreatorOverlay } from './components/CreatorOverlay';
import { FirstLaunchModal } from './components/FirstLaunchModal';

export type StudioMode = 'pro' | 'creator';

export const App: React.FC = () => {
  // Mode selection & persistence
  const [mode, setMode] = useState<StudioMode>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedMode = window.localStorage.getItem('nemesis_studio_mode');
      if (savedMode === 'creator' || savedMode === 'pro') {
        return savedMode;
      }
    }
    return 'pro';
  });

  // First-launch modal status
  const [showFirstLaunchModal, setShowFirstLaunchModal] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return !window.localStorage.getItem('nemesis_studio_onboarded');
    }
    return false;
  });

  // Active game state and agent activity logs
  const [gds, setGds] = useState<GameDefinition>(STARTER_GDS);
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>(INITIAL_AGENT_LOGS);
  const [prompt, setPrompt] = useState<string>(STARTER_GDS.meta?.prompt || '');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Synchronize mode to localStorage whenever it changes
  const updateMode = useCallback((newMode: StudioMode) => {
    setMode(newMode);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('nemesis_studio_mode', newMode);
    }
  }, []);

  const handleToggleMode = useCallback(() => {
    updateMode(mode === 'pro' ? 'creator' : 'pro');
  }, [mode, updateMode]);

  const handleCloseModal = useCallback(() => {
    setShowFirstLaunchModal(false);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('nemesis_studio_onboarded', 'true');
    }
  }, []);

  const handleSelectModalMode = useCallback((selectedMode: StudioMode) => {
    updateMode(selectedMode);
    handleCloseModal();
  }, [updateMode, handleCloseModal]);

  // Multi-Agent Generation Trigger
  const handleGenerate = useCallback(async (promptToUse?: string) => {
    const activePrompt = promptToUse || prompt;
    if (!activePrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setStatusMessage('Consulting multi-agent orchestrator...');

    try {
      const result = await generateGameFromPrompt(activePrompt);

      if (result.success && result.gds) {
        setGds(result.gds);
      }

      if (result.agentLogs && result.agentLogs.length > 0) {
        setAgentLogs((prev) => [...result.agentLogs, ...prev]);
      }

      setStatusMessage(result.success ? 'Generation successful!' : 'Generation completed with fallbacks.');
    } catch (err) {
      console.error('Error generating game from prompt:', err);
      setStatusMessage('Encountered generation error. High-resilience fallback active.');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, isGenerating]);

  // Creator Overlay quick mutations
  const handleQuickMutate = useCallback((type: 'fire_magic' | 'increase_bloom') => {
    if (type === 'increase_bloom') {
      setGds((prev) => ({
        ...prev,
        shaders: {
          ...prev.shaders,
          bloom: {
            enabled: true,
            intensity: Math.min(3.0, (prev.shaders?.bloom?.intensity || 1.0) + 0.5)
          }
        }
      }));
      setAgentLogs((prev) => [
        {
          agent: 'Nemotron-Nano-Graphics',
          action: 'Graphics Agent: Mutated bloom shader intensity parameter',
          timestamp: new Date().toLocaleTimeString(),
          details: { bloomIntensity: 'Boosted +0.5' }
        },
        ...prev
      ]);
    } else if (type === 'fire_magic') {
      setGds((prev) => ({
        ...prev,
        combat: {
          ...prev.combat,
          player: {
            ...prev.combat.player,
            skills: [
              ...(prev.combat.player.skills || []),
              {
                id: `skill_pyro_${Date.now()}`,
                name: 'Pyroclastic Surge',
                mpCost: 25,
                power: 55,
                type: 'magic'
              }
            ]
          }
        }
      }));
      setAgentLogs((prev) => [
        {
          agent: 'Nemotron-3-Ultra-Director',
          action: 'Game Director: Injected Pyroclastic Surge fire magic skill to player combat schema',
          timestamp: new Date().toLocaleTimeString(),
          details: { skill: 'Pyroclastic Surge', power: 55, mpCost: 25 }
        },
        ...prev
      ]);
    }
  }, []);

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Active Studio View */}
      {mode === 'pro' ? (
        <ProStudioCockpit
          gds={gds}
          agentLogs={agentLogs}
          isGenerating={isGenerating}
          prompt={prompt}
          onPromptChange={setPrompt}
          onGenerate={handleGenerate}
          onToggleMode={handleToggleMode}
        />
      ) : (
        <CreatorOverlay
          gds={gds}
          isGenerating={isGenerating}
          prompt={prompt}
          onPromptChange={setPrompt}
          onGenerate={handleGenerate}
          onToggleMode={handleToggleMode}
          onQuickMutate={handleQuickMutate}
        />
      )}

      {/* First-Launch Onboarding Modal */}
      <FirstLaunchModal
        isOpen={showFirstLaunchModal}
        onSelectMode={handleSelectModalMode}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default App;
