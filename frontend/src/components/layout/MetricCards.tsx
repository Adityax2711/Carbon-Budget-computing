import React from 'react';
import { BudgetItem, WorkloadStateItem, SystemMetrics, AppItem } from '../../types';
import { Flame, ShieldCheck, Cpu, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MetricCardsProps {
  app: AppItem | null;
  budget: BudgetItem | null;
  workload: WorkloadStateItem | null;
  metrics: SystemMetrics | null;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  app,
  budget,
  workload,
  metrics
}) => {
  const consumed = budget?.consumed_gco2e || 0;
  const limit = budget?.limit_gco2e || 150;
  const burnPercent = Math.min(Math.round((consumed / limit) * 100), 200);

  const getProgressColor = () => {
    if (burnPercent >= 100) return 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]';
    if (burnPercent >= 80) return 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]';
    return 'bg-[#4ADE80] shadow-[0_0_12px_rgba(74,222,128,0.5)]';
  };

  const getStatusText = () => {
    if (burnPercent >= 100) return 'Budget Exhausted (100%+)';
    if (burnPercent >= 80) return 'Warning Threshold (80%+)';
    return 'Within Safe Allowance';
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Carbon Budget Burn Card */}
      <div className="glass-panel p-5 rounded-2xl border border-[#273449] relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Carbon Allowance
          </span>
          <div className="p-2 rounded-lg bg-[#8B7CFF]/15 text-[#8B7CFF]">
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-bold text-white tracking-tight">
            {consumed.toFixed(1)}
          </span>
          <span className="text-xs text-slate-400 font-medium">
            / {limit.toFixed(0)} gCO₂e
          </span>
          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
            burnPercent >= 100 ? 'bg-rose-500/20 text-rose-400' :
            burnPercent >= 80 ? 'bg-amber-400/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            {burnPercent}%
          </span>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-[#0F172A] h-2.5 rounded-full overflow-hidden p-0.5 border border-[#273449]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
            style={{ width: `${Math.min(burnPercent, 100)}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
          {burnPercent >= 80 ? (
            <AlertTriangle className="w-3 h-3 text-amber-400" />
          ) : (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          )}
          {getStatusText()}
        </p>
      </div>

      {/* 2. Policy Enforcement Rule Card */}
      <div className="glass-panel p-5 rounded-2xl border border-[#273449]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Configured Action
          </span>
          <div className="p-2 rounded-lg bg-[#4ADE80]/15 text-[#4ADE80]">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-white tracking-tight mb-1">
          {budget?.action || 'PAUSE'}
        </div>
        <p className="text-xs text-slate-400">
          Criticality: <span className="font-semibold text-slate-200 uppercase">{app?.criticality || 'STANDARD'}</span>
        </p>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8B7CFF]" />
          At 100%: {app?.criticality === 'critical' ? 'Bypassed (Audited Overrun)' : `Enforces ${budget?.action}`}
        </div>
      </div>

      {/* 3. Workload Runtime State */}
      <div className="glass-panel p-5 rounded-2xl border border-[#273449]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Runtime Engine
          </span>
          <div className="p-2 rounded-lg bg-[#60A5FA]/15 text-[#60A5FA]">
            <Cpu className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-2xl font-bold tracking-tight ${
            workload?.status === 'RUNNING' ? 'text-emerald-400' :
            workload?.status === 'PAUSED' ? 'text-rose-400' :
            workload?.status === 'THROTTLED' ? 'text-amber-400' : 'text-indigo-400'
          }`}>
            {workload?.status || 'RUNNING'}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Concurrency Cap: <span className="font-semibold text-white">{workload?.concurrency_cap || 100}%</span>
        </p>
        <p className="text-[11px] text-slate-400 mt-2 truncate">
          {workload?.override_reason || 'Autonomous policy controller active'}
        </p>
      </div>

      {/* 4. Ledger & Idempotency Health Card */}
      <div className="glass-panel p-5 rounded-2xl border border-[#273449]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Audit Ledger & Safety
          </span>
          <div className="p-2 rounded-lg bg-amber-400/15 text-amber-400">
            <Database className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold text-white tracking-tight">
            {metrics?.total_ledger_entries || 0}
          </span>
          <span className="text-xs text-slate-400">immutable entries</span>
        </div>
        <p className="text-xs text-emerald-400 font-medium">
          ✓ {metrics?.duplicate_suppressions || 0} Replays Suppressed
        </p>
        <p className="text-[11px] text-slate-400 mt-2">
          Idempotency key enforcement verified
        </p>
      </div>
    </div>
  );
};
