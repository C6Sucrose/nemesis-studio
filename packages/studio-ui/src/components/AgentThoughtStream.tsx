import React, { useState } from 'react';
import { AgentLogEntry } from '@nemesis/agent-orchestrator';

export interface AgentThoughtStreamProps {
  logs: AgentLogEntry[];
  isGenerating?: boolean;
}

export const AgentThoughtStream: React.FC<AgentThoughtStreamProps> = ({ logs, isGenerating = false }) => {
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});

  const toggleExpand = (index: number) => {
    setExpandedIndices((prev) => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getAgentBadge = (agent: string) => {
    if (agent.toLowerCase().includes('director') || agent.toLowerCase().includes('ultra')) {
      return {
        label: 'Director (Nemotron 3 Ultra)',
        color: 'bg-purple-900/60 text-purple-300 border-purple-700/50'
      };
    }
    if (agent.toLowerCase().includes('graphic') || agent.toLowerCase().includes('audio') || agent.toLowerCase().includes('nano')) {
      return {
        label: 'Graphics & SFX (Nemotron Nano)',
        color: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50'
      };
    }
    if (agent.toLowerCase().includes('tavily') || agent.toLowerCase().includes('research') || agent.toLowerCase().includes('search')) {
      return {
        label: 'Knowledge Search (Tavily)',
        color: 'bg-sky-900/60 text-sky-300 border-sky-700/50'
      };
    }
    return {
      label: agent,
      color: 'bg-amber-900/60 text-amber-300 border-amber-700/50'
    };
  };

  return (
    <aside className="w-80 md:w-96 flex flex-col bg-slate-900/90 border-r border-slate-800 text-slate-200 h-full overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/95 backdrop-blur-sm">
        <div className="flex items-center space-x-2.5">
          <div className="relative flex items-center justify-center">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isGenerating ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`w-2 h-2 rounded-full absolute ${
                isGenerating ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
          </div>
          <h2 className="text-sm font-semibold tracking-wide text-slate-100 uppercase">Agent Activity</h2>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
          {logs.length} events
        </span>
      </div>

      {/* Real-time Agent Status Cards */}
      <div className="p-3 border-b border-slate-800/60 bg-slate-950/40 grid grid-cols-1 gap-2 text-xs">
        {/* Game Director */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="font-medium text-slate-200">Director</span>
          </div>
          <span className="text-[11px] text-purple-300 font-mono">Nemotron 3 Ultra</span>
        </div>

        {/* Graphics & SFX */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-medium text-slate-200">Graphics & SFX</span>
          </div>
          <span className="text-[11px] text-emerald-300 font-mono">Nemotron Nano</span>
        </div>

        {/* Knowledge Search */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span className="font-medium text-slate-200">Knowledge Search</span>
          </div>
          <span className="text-[11px] text-sky-300 font-mono">Tavily Engine</span>
        </div>
      </div>

      {/* Stream Logs List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 font-sans">
        {logs.map((log, index) => {
          const badge = getAgentBadge(log.agent);
          const isExpanded = Boolean(expandedIndices[index]);
          const hasDetails = Boolean(log.details);

          return (
            <div
              key={index}
              className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-all text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded border font-mono tracking-tight ${badge.color}`}
                >
                  {badge.label}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {log.timestamp}
                </span>
              </div>

              <p className="text-slate-300 leading-relaxed font-normal">
                {log.action}
              </p>

              {hasDetails && (
                <div>
                  <button
                    onClick={() => toggleExpand(index)}
                    className="text-[10px] text-slate-400 hover:text-cyan-300 transition-colors flex items-center space-x-1 underline decoration-dotted"
                  >
                    <span>{isExpanded ? '▾ Hide telemetry' : '▸ View telemetry payload'}</span>
                  </button>

                  {isExpanded && (
                    <pre className="mt-1.5 p-2 bg-slate-900/90 rounded border border-slate-800 text-[10px] text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                      {typeof log.details === 'string'
                        ? log.details
                        : JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
