import React from 'react';
import { Play, Square, Zap, Globe, Repeat, CheckCircle } from 'lucide-react';
import { SimulationStatus, AppItem } from '../../types';

interface SimulationControlDeckProps {
  app?: AppItem | null;
  simStatus: SimulationStatus | null;
  onToggleStream: () => void;
  onSetLoad: (load: 'idle' | 'normal' | 'stress') => void;
  onSetRegion: (region: string) => void;
  onInjectSpike: () => void;
  onTestIdempotency: () => void;
  isActionLoading: boolean;
  idempotencyResult: any;
}

export const SimulationControlDeck: React.FC<SimulationControlDeckProps> = ({
  simStatus,
  onToggleStream,
  onSetLoad,
  onSetRegion,
  onInjectSpike,
  onTestIdempotency,
  isActionLoading,
  idempotencyResult
}) => {
  const regions = [
    { id: 'us-east-1', name: 'us-east-1 (Virginia)', intensity: '380 g/kWh', tag: 'Standard' },
    { id: 'us-west-2', name: 'us-west-2 (Oregon)', intensity: '110 g/kWh', tag: 'Hydro Clean' },
    { id: 'eu-north-1', name: 'eu-north-1 (Sweden)', intensity: '35 g/kWh', tag: 'Ultra Low Carbon' },
  ];

  return (
    <div className="glass-panel p-6 rounded-2xl border border-[#273449]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#4ADE80]" />
            Telemetry & Demonstration Control Deck
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Drive live synthetic workloads, shift grid carbon intensity, and verify policy triggers.
          </p>
        </div>
        {simStatus?.is_running && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 glow-green animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            STREAMING (2s ticks)
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Stream & Power Controls */}
        <div className="bg-[#0F172A]/70 p-4 rounded-xl border border-[#273449]">
          <span className="text-xs font-semibold text-slate-300 block mb-2.5">
            1. Continuous Workload Stream
          </span>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={onToggleStream}
              disabled={isActionLoading}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                simStatus?.is_running
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 glow-green'
              }`}
            >
              {simStatus?.is_running ? (
                <>
                  <Square className="w-3.5 h-3.5" /> Stop Stream
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Start Telemetry Stream
                </>
              )}
            </button>
          </div>

          <div className="text-[11px] text-slate-400 mb-1.5 font-medium">Power Load Intensity:</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['idle', 'normal', 'stress'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => onSetLoad(lvl)}
                className={`py-1 px-2 rounded text-xs font-medium capitalize border transition ${
                  simStatus?.load_profile === lvl
                    ? 'bg-[#8B7CFF]/20 text-[#8B7CFF] border-[#8B7CFF]'
                    : 'bg-[#131F32] text-slate-400 border-[#273449] hover:text-white'
                }`}
              >
                {lvl} {lvl === 'idle' ? '15W' : lvl === 'normal' ? '65W' : '280W'}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Grid Carbon Intensity Region Switcher */}
        <div className="bg-[#0F172A]/70 p-4 rounded-xl border border-[#273449]">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2.5">
            <Globe className="w-3.5 h-3.5 text-[#60A5FA]" />
            2. Grid Carbon Intensity (Cloud Region)
          </span>
          <div className="space-y-1.5">
            {regions.map((reg) => (
              <button
                key={reg.id}
                onClick={() => onSetRegion(reg.id)}
                className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs border transition ${
                  simStatus?.region === reg.id
                    ? 'bg-[#60A5FA]/15 text-white border-[#60A5FA]/60'
                    : 'bg-[#131F32] text-slate-400 border-[#273449] hover:bg-[#182740]'
                }`}
              >
                <div className="text-left">
                  <div className="font-semibold text-slate-200">{reg.id}</div>
                  <div className="text-[10px] text-slate-400">{reg.tag}</div>
                </div>
                <span className={`text-[11px] font-bold ${
                  reg.id === 'eu-north-1' ? 'text-emerald-400' :
                  reg.id === 'us-west-2' ? 'text-blue-400' : 'text-amber-400'
                }`}>
                  {reg.intensity}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Edge Case Triggers: Spike & Idempotency */}
        <div className="bg-[#0F172A]/70 p-4 rounded-xl border border-[#273449] flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-300 block mb-2.5">
              3. Verification & Chaos Testing
            </span>
            <div className="space-y-2">
              <button
                onClick={onInjectSpike}
                disabled={isActionLoading}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Inject Instant 80Wh Power Spike
              </button>

              <button
                onClick={onTestIdempotency}
                disabled={isActionLoading}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 transition"
              >
                <Repeat className="w-3.5 h-3.5 text-indigo-400" />
                Replay Duplicate Telemetry (Idempotency)
              </button>
            </div>
          </div>

          {idempotencyResult && (
            <div className="mt-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-start gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Deduplication Verified!</span> Replay event was safely ignored.
                Delta gCO₂e: 0.0g.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
