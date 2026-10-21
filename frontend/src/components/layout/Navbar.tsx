import { Leaf, Cpu, RefreshCw, ShieldAlert } from 'lucide-react';
import { AppItem, BudgetItem, WorkloadStateItem } from '../../types';

interface NavbarProps {
  apps: AppItem[];
  selectedApp: AppItem | null;
  onSelectApp: (app: AppItem) => void;
  budget?: BudgetItem | null;
  workload: WorkloadStateItem | null;
  onResetDemo: () => void;
  isResetting: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  apps,
  selectedApp,
  onSelectApp,
  workload,
  onResetDemo,
  isResetting
}) => {
  const getStatusBadge = () => {
    if (!workload) return null;
    switch (workload.status) {
      case 'RUNNING':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 glow-green">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            WORKLOAD ACTIVE
          </span>
        );
      case 'PAUSED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/40 glow-red">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            POLICY ENFORCED: PAUSED
          </span>
        );
      case 'THROTTLED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/40 glow-amber">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" />
            THROTTLED ({workload.concurrency_cap}%)
          </span>
        );
      case 'OVERRIDDEN':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/40 glow-purple">
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
            OVERRIDE ACTIVE
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-[#273449]/80 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative p-2.5 rounded-xl bg-gradient-to-tr from-[#8B7CFF]/20 to-[#4ADE80]/20 border border-[#8B7CFF]/40 shadow-lg">
            <Leaf className="w-5 h-5 text-[#4ADE80]" />
            <Cpu className="w-3.5 h-3.5 text-[#8B7CFF] absolute -bottom-0.5 -right-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-[#8B7CFF] bg-clip-text text-transparent">
                CarbonGuard
              </h1>
              <span className="text-[10px] tracking-wider uppercase font-semibold px-2 py-0.5 rounded-full bg-[#8B7CFF]/15 text-[#8B7CFF] border border-[#8B7CFF]/30">
                MVP v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">Carbon Budget Accounting & Autonomous Policy Engine</p>
          </div>
        </div>

        {/* Center App Switcher */}
        <div className="flex items-center gap-3 bg-[#0F172A]/80 p-1.5 rounded-xl border border-[#273449]">
          <span className="text-xs text-slate-400 pl-2 font-medium">Target Workload:</span>
          <select
            value={selectedApp?.id || ''}
            onChange={(e) => {
              const app = apps.find(a => a.id === e.target.value);
              if (app) onSelectApp(app);
            }}
            className="bg-[#131F32] text-sm text-slate-200 border border-[#273449] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#8B7CFF] cursor-pointer"
          >
            {apps.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name} ({app.criticality.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Right Status Badge & Reset */}
        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <button
            onClick={onResetDemo}
            disabled={isResetting}
            title="Reset to deterministic evaluation fixture"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-[#131F32] hover:bg-[#182740] border border-[#273449] transition hover:border-[#8B7CFF]/40 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#8B7CFF] ${isResetting ? 'animate-spin' : ''}`} />
            Reset Fixture
          </button>
        </div>
      </div>
    </header>
  );
};
