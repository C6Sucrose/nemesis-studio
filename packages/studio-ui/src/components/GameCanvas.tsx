import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameDefinition } from '@nemesis/shared';
import { HD2DGameEngine, EngineMode } from '@nemesis/web-runtime';

export interface GameCanvasProps {
  gds: GameDefinition;
  className?: string;
  onModeChange?: (mode: EngineMode) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ gds, className = '', onModeChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<HD2DGameEngine | null>(null);

  const [engineMode, setEngineMode] = useState<EngineMode>('OVERWORLD');
  const [playerHp, setPlayerHp] = useState<number>(gds.combat.player.hp);
  const [playerMp, setPlayerMp] = useState<number>(gds.combat.player.mp || 0);
  const [enemyHp, setEnemyHp] = useState<number>(gds.combat.enemy.hp);
  const [combatLog, setCombatLog] = useState<string>('Encounter started! Select an action.');
  const [dialogueSpeaker, setDialogueSpeaker] = useState<string>('');
  const [dialogueText, setDialogueText] = useState<string>('');
  const [dialogueChoices, setDialogueChoices] = useState<Array<{ text: string }>>([]);

  // Initialize or re-create engine when gds changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.destroy();
    }

    const engine = new HD2DGameEngine(canvasRef.current, gds, {
      onModeChange: (newMode) => {
        setEngineMode(newMode);
        if (onModeChange) onModeChange(newMode);

        if (newMode === 'COMBAT') {
          const combatSm = engine.getCombat();
          setPlayerHp(combatSm.getPlayerHp());
          setPlayerMp(combatSm.getPlayerMp());
          setEnemyHp(combatSm.getEnemyHp());
          setCombatLog(`Engaged ${combatSm.getEnemy().name}! Choose your command.`);
        } else if (newMode === 'DIALOGUE') {
          const diagCtrl = engine.getDialogue();
          const node = diagCtrl.getCurrentNode();
          if (node) {
            setDialogueSpeaker(node.speaker || 'Narrator');
            setDialogueText(node.text);
            setDialogueChoices(node.choices || []);
          }
        }
      },
      onCombatEnd: (victory, fled) => {
        if (victory) {
          setCombatLog('Victory! Foe vanquished.');
        } else if (fled) {
          setCombatLog('Successfully escaped the battle!');
        } else {
          setCombatLog('Defeat! The temporal lattice collapsed.');
        }
      },
      onDialogueEnd: () => {
        setDialogueText('');
      }
    });

    engine.start();
    engineRef.current = engine;

    setPlayerHp(gds.combat.player.hp);
    setPlayerMp(gds.combat.player.mp || 0);
    setEnemyHp(gds.combat.enemy.hp);

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [gds, onModeChange]);

  // Combat Handlers
  const handleAttack = useCallback(() => {
    if (!engineRef.current) return;
    const res = engineRef.current.dispatchCombatAction({ type: 'ATTACK' });
    const combatSm = engineRef.current.getCombat();
    setPlayerHp(combatSm.getPlayerHp());
    setPlayerMp(combatSm.getPlayerMp());
    setEnemyHp(combatSm.getEnemyHp());
    setCombatLog(res.message || 'Attack executed.');
  }, []);

  const handleSkill = useCallback((skillId: string) => {
    if (!engineRef.current) return;
    const res = engineRef.current.dispatchCombatAction({ type: 'MAGIC', skillId });
    const combatSm = engineRef.current.getCombat();
    setPlayerHp(combatSm.getPlayerHp());
    setPlayerMp(combatSm.getPlayerMp());
    setEnemyHp(combatSm.getEnemyHp());
    setCombatLog(res.message || 'Spell cast.');
  }, []);

  const handleFlee = useCallback(() => {
    if (!engineRef.current) return;
    const res = engineRef.current.dispatchCombatAction({ type: 'FLEE' });
    setCombatLog(res.message || 'Retreat attempted.');
  }, []);

  // Dialogue Handlers
  const handleSelectChoice = useCallback((idx: number) => {
    if (!engineRef.current) return;
    engineRef.current.selectDialogueChoice(idx);
    const diagCtrl = engineRef.current.getDialogue();
    const node = diagCtrl.getCurrentNode();
    if (node) {
      setDialogueSpeaker(node.speaker || 'Narrator');
      setDialogueText(node.text);
      setDialogueChoices(node.choices || []);
    }
  }, []);

  const handleCloseDialogue = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.closeDialogue();
  }, []);

  // Quick Action triggers
  const triggerCombat = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.startCombat();
  }, []);

  const triggerDialogue = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.startDialogue();
  }, []);

  const togglePause = useCallback(() => {
    if (!engineRef.current) return;
    if (engineMode === 'PAUSED') {
      engineRef.current.resume();
    } else {
      engineRef.current.pause();
    }
  }, [engineMode]);

  return (
    <div className={`relative w-full h-full bg-slate-950 overflow-hidden flex items-center justify-center ${className}`}>
      {/* Three.js Canvas Element */}
      <canvas
        ref={canvasRef}
        data-testid="hd2d-canvas"
        className="w-full h-full block object-cover"
      />

      {/* Overworld HUD Controls (Top Right) */}
      <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
        <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs text-slate-300 font-mono flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{gds.world.zoneName}</span>
        </span>

        <button
          onClick={triggerCombat}
          title="Simulate Combat Encounter"
          className="px-3 py-1 rounded bg-rose-900/70 hover:bg-rose-800 text-rose-200 border border-rose-700/60 text-xs font-medium shadow-md transition-all active:scale-95"
        >
          ⚔ Encounter
        </button>

        <button
          onClick={triggerDialogue}
          title="Simulate NPC Interaction"
          className="px-3 py-1 rounded bg-sky-900/70 hover:bg-sky-800 text-sky-200 border border-sky-700/60 text-xs font-medium shadow-md transition-all active:scale-95"
        >
          💬 Talk
        </button>

        <button
          onClick={togglePause}
          title="Pause or Resume Engine"
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-all"
        >
          {engineMode === 'PAUSED' ? '▶' : '⏸'}
        </button>
      </div>

      {/* Movement helper pill for Overworld */}
      {engineMode === 'OVERWORLD' && (
        <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded bg-slate-900/70 backdrop-blur border border-slate-800 text-[11px] text-slate-400 font-mono">
          [W, A, S, D] Move Chronomancer &bull; 35° Tilt-Shift Active
        </div>
      )}

      {/* Combat Overlay */}
      {engineMode === 'COMBAT' && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col justify-between p-6 z-20 animate-fadeIn">
          {/* Top: Enemy Card */}
          <div className="max-w-md mx-auto w-full bg-slate-900/90 border border-rose-800/80 rounded-xl p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-rose-300 text-sm">{gds.combat.enemy.name}</span>
              <span className="text-xs text-rose-400 font-mono">
                HP: {Math.max(0, enemyHp)} / {gds.combat.enemy.maxHp}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
              <div
                className="bg-gradient-to-r from-rose-600 to-red-500 h-full transition-all duration-300"
                style={{
                  width: `${Math.max(0, Math.min(100, (enemyHp / gds.combat.enemy.maxHp) * 100))}%`
                }}
              />
            </div>
          </div>

          {/* Combat Log Banner */}
          <div className="text-center font-mono text-xs text-amber-300 bg-slate-900/80 py-2 px-4 rounded-lg max-w-lg mx-auto border border-amber-500/30">
            {combatLog}
          </div>

          {/* Bottom: Player Card & Command Buttons */}
          <div className="max-w-2xl mx-auto w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200">{gds.combat.player.name}</span>
              <div className="flex space-x-4 font-mono">
                <span className="text-emerald-400">
                  HP: {playerHp}/{gds.combat.player.maxHp}
                </span>
                <span className="text-sky-400">
                  MP: {playerMp}/{gds.combat.player.maxMp || 0}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={handleAttack}
                className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-600 text-white font-medium text-xs shadow transition active:scale-95"
              >
                ⚔ Attack
              </button>

              {gds.combat.player.skills?.slice(0, 2).map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => handleSkill(skill.id)}
                  className="px-3 py-2 rounded bg-purple-700 hover:bg-purple-600 text-white font-medium text-xs shadow transition active:scale-95 flex flex-col items-center justify-center"
                >
                  <span>{skill.name}</span>
                  <span className="text-[10px] text-purple-200">{skill.mpCost} MP</span>
                </button>
              ))}

              <button
                onClick={handleFlee}
                className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs border border-slate-700 transition active:scale-95"
              >
                🏃 Flee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogue Overlay */}
      {engineMode === 'DIALOGUE' && (
        <div className="absolute bottom-6 left-6 right-6 max-w-3xl mx-auto bg-slate-900/95 backdrop-blur-md border-2 border-amber-600/60 rounded-xl p-5 shadow-2xl z-20 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="px-3 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold uppercase tracking-wider">
              {dialogueSpeaker || 'Guide'}
            </span>
            <button
              onClick={handleCloseDialogue}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              ✕ Close
            </button>
          </div>

          <p className="text-sm text-slate-200 leading-relaxed font-sans">
            {dialogueText}
          </p>

          {dialogueChoices.length > 0 && (
            <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2">
              {dialogueChoices.map((choice, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectChoice(idx)}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-600/30 text-amber-200 border border-amber-600/30 text-xs font-medium transition active:scale-95"
                >
                  &bull; {choice.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
