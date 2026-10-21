import React, { useState } from 'react';
import { WorkloadStateItem, AppItem } from '../../types';
import { PauseCircle, PlayCircle, ShieldAlert, X, Check } from 'lucide-react';

interface WorkloadEnforcementPanelProps {
  app: AppItem | null;
  workload: WorkloadStateItem | null;
  onPause: (reason: string) => void;
  onResume: (reason: string) => void;
  onOverride: (reason: string, boost: number) => void;
  isLoading: boolean;
}

export const WorkloadEnforcementPanel: React.FC<WorkloadEnforcementPanelProps> = ({
  app,
  workload,
  onPause,
  onResume,
  onOverride,
  isLoading
}) => {
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('Emergency production maintenance requirement');
  const [boostAmount, setBoostAmount] = useState(50);

  const pauseReason = 'Routine manual inspection';

  return (
    <>
      <div className="glass-panel p-6 rounded-2xl border border-[#273449]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#8B7CFF]" />
              Workload Enforcement & Platform Operations
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Manual interventions and emergency exceptions require logged justifications in the compliance audit trail.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {workload?.status === 'RUNNING' ? (
              <button
                onClick={() => onPause(pauseReason)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition disabled:opacity-50"
              >
                <PauseCircle className="w-4 h-4 text-rose-400" />
                Manual Pause Workload
              </button>
            ) : (
              <button
                onClick={() => onResume('Manual operator restoration')}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition disabled:opacity-50 glow-green"
              >
                <PlayCircle className="w-4 h-4 text-emerald-400" />
                Resume Workload
              </button>
            )}

            <button
              onClick={() => setShowOverrideModal(true)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/40 hover:bg-[#8B7CFF]/30 transition disabled:opacity-50"
            >
              <ShieldAlert className="w-4 h-4 text-[#8B7CFF]" />
              Grant Emergency Override
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-[#8B7CFF]/40 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h4 className="text-base font-bold text-white">Emergency Policy Exception</h4>
              </div>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Granting an emergency override allows <span className="font-semibold text-white">{app?.name}</span> to
              continue execution despite budget depletion. An immutable record will be stored with your actor signature.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">
                  Compliance Justification Reason *
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-[#0F172A] border border-[#273449] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#8B7CFF]"
                  placeholder="e.g. Critical customer batch repair"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">
                  Temporary Carbon Allowance Boost (gCO₂e)
                </label>
                <input
                  type="number"
                  value={boostAmount}
                  onChange={(e) => setBoostAmount(Number(e.target.value))}
                  className="w-full bg-[#0F172A] border border-[#273449] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#8B7CFF]"
                  min="0"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-[#182740] transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onOverride(overrideReason, boostAmount);
                  setShowOverrideModal(false);
                }}
                disabled={!overrideReason.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#8B7CFF] text-white hover:bg-[#7A6AE6] transition shadow-lg glow-purple disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                Authorize Override
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
