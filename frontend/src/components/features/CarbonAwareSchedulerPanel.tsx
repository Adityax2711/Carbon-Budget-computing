import React, { useState } from 'react';
import { ArrowRightLeft, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { SchedulerRecommendation, AppItem } from '../../types';

interface CarbonAwareSchedulerPanelProps {
  app?: AppItem | null;
  recommendation: SchedulerRecommendation | null;
  onReroute: (targetRegion: string, reason: string) => void;
  isLoading: boolean;
  autoRerouteEnabled: boolean;
  onToggleAutoReroute: () => void;
}

export const CarbonAwareSchedulerPanel: React.FC<CarbonAwareSchedulerPanelProps> = ({
  recommendation,
  onReroute,
  isLoading,
  autoRerouteEnabled,
  onToggleAutoReroute
}) => {
  const [reroutingRegion, setReroutingRegion] = useState<string | null>(null);
  const [recentShiftSuccess, setRecentShiftSuccess] = useState<string | null>(null);

  if (!recommendation) return null;

  const handleTriggerReroute = async (regionId: string, regionName: string) => {
    setReroutingRegion(regionId);
    try {
      await onReroute(regionId, `Manual spatial shift to low-carbon grid: ${regionName}`);
      setRecentShiftSuccess(`Workload successfully rerouted to ${regionName}! Carbon burn rate slashed.`);
      setTimeout(() => setRecentShiftSuccess(null), 6000);
    } finally {
      setReroutingRegion(null);
    }
  };

  const isCurrentOptimal = recommendation.current_region === recommendation.optimal_target_region;

  return (
    <div className="glass-panel p-6 rounded-2xl border border-[#273449]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#4ADE80]/15 text-[#4ADE80]">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-white">
              Carbon-Aware Spatial Scheduler (Auto-Rerouting)
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#4ADE80]/15 text-[#4ADE80] border border-[#4ADE80]/30">
              Active Optimization
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dynamically shifts cloud regions to exploit cleaner renewable energy grids before carbon budget depletion occurs.
          </p>
        </div>

        {/* Autonomous Mitigation Switch */}
        <div className="flex items-center gap-3 bg-[#0F172A] px-3.5 py-2 rounded-xl border border-[#273449]">
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-200">Autonomous Spatial Shift</div>
            <div className="text-[10px] text-slate-400">Auto-reroute at 80% Warning</div>
          </div>
          <button
            onClick={onToggleAutoReroute}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition duration-300 cursor-pointer ${
              autoRerouteEnabled ? 'bg-[#4ADE80] glow-green' : 'bg-[#273449]'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-300 ${
                autoRerouteEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {recentShiftSuccess && (
        <div className="mb-5 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{recentShiftSuccess}</span>
        </div>
      )}

      {/* Recommended Spotlight Card */}
      {!isCurrentOptimal && (
        <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-[#4ADE80]/10 via-[#131F32] to-[#8B7CFF]/10 border border-[#4ADE80]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#4ADE80]/20 text-[#4ADE80] mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wide">
                  Optimal Migration Target:
                </span>
                <span className="text-xs font-bold text-[#4ADE80]">
                  {recommendation.optimal_target_name} ({recommendation.optimal_target_region})
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Migrating from <span className="font-semibold text-white">{recommendation.current_region}</span> to{' '}
                <span className="font-semibold text-emerald-400">{recommendation.optimal_target_region}</span> will slash
                carbon burn rate by{' '}
                <span className="font-bold text-emerald-400 underline">
                  {recommendation.potential_savings_percent}%
                </span>{' '}
                and extend budget runway by{' '}
                <span className="font-bold text-white">+{recommendation.extended_runway_hours} hours</span>.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleTriggerReroute(recommendation.optimal_target_region, recommendation.optimal_target_name)}
            disabled={isLoading || reroutingRegion !== null}
            className="flex-shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#4ADE80] text-slate-900 hover:bg-[#3ec470] transition shadow-lg glow-green disabled:opacity-50"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            {reroutingRegion === recommendation.optimal_target_region ? 'Rerouting...' : 'Migrate Workload Now'}
          </button>
        </div>
      )}

      {/* Grid Candidate Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#273449] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="pb-3 pl-2">Cloud Region & Grid</th>
              <th className="pb-3">Grid Intensity</th>
              <th className="pb-3">Renewable Share</th>
              <th className="pb-3">Est. Burn Rate</th>
              <th className="pb-3">Budget Runway</th>
              <th className="pb-3 pr-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#273449]/50">
            {recommendation.all_regions.map((reg) => {
              const isCurrent = reg.region_id === recommendation.current_region;
              return (
                <tr
                  key={reg.region_id}
                  className={`hover:bg-[#131F32]/50 transition ${isCurrent ? 'bg-[#182740]/40' : ''}`}
                >
                  <td className="py-3 pl-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{reg.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({reg.region_id})</span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Active Region
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate max-w-xs">{reg.primary_grid}</div>
                  </td>

                  <td className="py-3">
                    <span
                      className={`font-mono font-bold ${
                        reg.intensity_g_kwh <= 50
                          ? 'text-emerald-400'
                          : reg.intensity_g_kwh <= 150
                          ? 'text-blue-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {reg.intensity_g_kwh} g/kWh
                    </span>
                  </td>

                  <td className="py-3 text-slate-300 font-medium">
                    {reg.renewable_share}
                  </td>

                  <td className="py-3 text-slate-300 font-mono">
                    {reg.burn_rate_per_hour_g} g/hr
                  </td>

                  <td className="py-3 text-slate-200 font-semibold">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {reg.runway_hours} hrs
                    </span>
                  </td>

                  <td className="py-3 pr-2 text-right">
                    {isCurrent ? (
                      <span className="text-xs text-slate-400 font-medium">Running Here</span>
                    ) : (
                      <button
                        onClick={() => handleTriggerReroute(reg.region_id, reg.name)}
                        disabled={isLoading || reroutingRegion !== null}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#131F32] hover:bg-[#8B7CFF]/20 text-slate-200 hover:text-[#8B7CFF] border border-[#273449] hover:border-[#8B7CFF]/50 transition disabled:opacity-50"
                      >
                        {reroutingRegion === reg.region_id ? 'Migrating...' : 'Reroute'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
