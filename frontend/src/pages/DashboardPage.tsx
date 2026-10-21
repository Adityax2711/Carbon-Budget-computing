import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { AppItem, BudgetItem, WorkloadStateItem, TelemetryRecord, AuditLogItem, SystemMetrics, SimulationStatus, SchedulerRecommendation } from '../types';
import { Navbar } from '../components/layout/Navbar';
import { MetricCards } from '../components/layout/MetricCards';
import { BurnRateChart } from '../components/charts/BurnRateChart';
import { SimulationControlDeck } from '../components/features/SimulationControlDeck';
import { CarbonAwareSchedulerPanel } from '../components/features/CarbonAwareSchedulerPanel';
import { WorkloadEnforcementPanel } from '../components/features/WorkloadEnforcementPanel';
import { AuditTable } from '../components/features/AuditTable';
import { AISuitePanel } from '../components/features/ai/AISuitePanel';
import { AlertCircle } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [budget, setBudget] = useState<BudgetItem | null>(null);
  const [workload, setWorkload] = useState<WorkloadStateItem | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [simStatus, setSimStatus] = useState<SimulationStatus | null>(null);
  const [schedulerRec, setSchedulerRec] = useState<SchedulerRecommendation | null>(null);
  const [autoRerouteEnabled, setAutoRerouteEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyResult, setIdempotencyResult] = useState<any | null>(null);

  // Load apps
  const loadApps = useCallback(async () => {
    try {
      const appList = await api.getApps();
      setApps(appList);
      if (appList.length > 0 && !selectedApp) {
        setSelectedApp(appList[0]);
      }
    } catch (err: any) {
      console.error('Failed to load apps:', err);
      setError(err.message || 'Could not connect to CarbonGuard API');
    }
  }, [selectedApp]);

  // Load app-specific data
  const loadAppData = useCallback(async (appId: string) => {
    try {
      const [b, w, t, a, m, s, sc] = await Promise.all([
        api.getBudget(appId).catch(() => null),
        api.getWorkloadStatus(appId).catch(() => null),
        api.getTelemetryHistory(appId).catch(() => []),
        api.getAuditLogs(appId).catch(() => []),
        api.getMetrics().catch(() => null),
        api.getSimulationStatus().catch(() => null),
        api.getSchedulerOptions(appId).catch(() => null),
      ]);
      setBudget(b);
      setWorkload(w);
      setTelemetry(t);
      setAuditLogs(a);
      setMetrics(m);
      setSimStatus(s);
      setSchedulerRec(sc);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load app data:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadApps();
      setIsLoading(false);
    };
    init();
  }, [loadApps]);

  // When selectedApp changes, refresh data
  useEffect(() => {
    if (selectedApp) {
      loadAppData(selectedApp.id);
    }
  }, [selectedApp, loadAppData]);

  // Poll for live telemetry and audit changes every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedApp) {
        loadAppData(selectedApp.id);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedApp, loadAppData]);

  // Handlers
  const handleToggleStream = async () => {
    if (!selectedApp) return;
    try {
      if (simStatus?.is_running) {
        await api.stopSimulation();
      } else {
        await api.startSimulation(selectedApp.id, simStatus?.region || 'us-east-1', simStatus?.load_profile || 'normal');
      }
      await loadAppData(selectedApp.id);
    } catch (err: any) {
      alert(`Error toggling stream: ${err.message}`);
    }
  };

  const handleSetLoad = async (load: 'idle' | 'normal' | 'stress') => {
    try {
      await api.setLoadProfile(load);
      if (selectedApp) await loadAppData(selectedApp.id);
    } catch (err: any) {
      alert(`Error setting load: ${err.message}`);
    }
  };

  const handleSetRegion = async (region: string) => {
    try {
      await api.setRegion(region);
      if (selectedApp) await loadAppData(selectedApp.id);
    } catch (err: any) {
      alert(`Error setting region: ${err.message}`);
    }
  };

  const handleInjectSpike = async () => {
    if (!selectedApp) return;
    try {
      await api.injectSpike(selectedApp.id, 90.0);
      await loadAppData(selectedApp.id);
    } catch (err: any) {
      alert(`Error injecting spike: ${err.message}`);
    }
  };

  const handleTestIdempotency = async () => {
    if (!selectedApp) return;
    try {
      const res = await api.testIdempotency(selectedApp.id);
      setIdempotencyResult(res);
      await loadAppData(selectedApp.id);
    } catch (err: any) {
      alert(`Error testing idempotency: ${err.message}`);
    }
  };

  const handlePauseWorkload = async (reason: string) => {
    if (!selectedApp) return;
    try {
      await api.pauseWorkload(selectedApp.id, reason);
      await loadAppData(selectedApp.id);
    } catch (err: any) {
      alert(`Error pausing workload: ${err.message}`);
    }
  };

  const handleResumeWorkload = async (reason: string) => {
    if (!selectedApp) return;
    try {
      await api.resumeWorkload(selectedApp.id, reason);
      await loadAppData(selectedApp.id);
    } catch (err: any) {
      alert(`Error resuming workload: ${err.message}`);
    }
  };

  const handleOverrideWorkload = async (reason: string, boost: number) => {
    if (!selectedApp) return;
    try {
      await api.overrideWorkload(selectedApp.id, reason, boost);
      await loadAppData(selectedApp.id);
    } catch (err: any) {
      alert(`Error overriding workload: ${err.message}`);
    }
  };

  const handleRerouteWorkload = async (targetRegion: string, reason: string) => {
    if (!selectedApp) return;
    try {
      await api.executeReroute(selectedApp.id, targetRegion, reason);
      await loadAppData(selectedApp.id);
    } catch (err: any) {
      alert(`Error rerouting workload: ${err.message}`);
    }
  };

  const handleToggleAutoReroute = () => {
    setAutoRerouteEnabled(prev => !prev);
  };

  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      await api.resetDemo();
      const freshApps = await api.getApps();
      setApps(freshApps);
      if (freshApps.length > 0) {
        setSelectedApp(freshApps[1]); // Default to ML-Recommender
      }
      setIdempotencyResult(null);
    } catch (err: any) {
      alert(`Error resetting demo fixture: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col">
      <Navbar
        apps={apps}
        selectedApp={selectedApp}
        onSelectApp={(app) => {
          setSelectedApp(app);
          setIdempotencyResult(null);
        }}
        budget={budget}
        workload={workload}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{error} — ensure the FastAPI backend is running on http://localhost:8000</span>
            </div>
            <button
              onClick={() => selectedApp && loadAppData(selectedApp.id)}
              className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* 1. Primary KPI Metric Cards */}
        <MetricCards
          app={selectedApp}
          budget={budget}
          workload={workload}
          metrics={metrics}
        />

        {/* 2. Main Visual Burn Rate Chart */}
        <BurnRateChart telemetry={telemetry} budget={budget} />

        {/* 3. AI Carbon Intelligence Suite (Forecasting, Leak Sentry, Copilot, EcoOptimizer) */}
        <AISuitePanel
          app={selectedApp}
          onRefreshParent={() => selectedApp && loadAppData(selectedApp.id)}
        />

        {/* 4. Carbon-Aware Spatial Scheduler (Auto-Rerouting & Green Cloud Regions) */}
        <CarbonAwareSchedulerPanel
          app={selectedApp}
          recommendation={schedulerRec}
          onReroute={handleRerouteWorkload}
          isLoading={isLoading}
          autoRerouteEnabled={autoRerouteEnabled}
          onToggleAutoReroute={handleToggleAutoReroute}
        />

        {/* 4. Live Demonstration & Simulation Control Deck */}
        <SimulationControlDeck
          app={selectedApp}
          simStatus={simStatus}
          onToggleStream={handleToggleStream}
          onSetLoad={handleSetLoad}
          onSetRegion={handleSetRegion}
          onInjectSpike={handleInjectSpike}
          onTestIdempotency={handleTestIdempotency}
          isActionLoading={isLoading}
          idempotencyResult={idempotencyResult}
        />

        {/* 5. Workload Enforcement & Operations Panel */}
        <WorkloadEnforcementPanel
          app={selectedApp}
          workload={workload}
          onPause={handlePauseWorkload}
          onResume={handleResumeWorkload}
          onOverride={handleOverrideWorkload}
          isLoading={isLoading}
        />

        {/* 6. Immutable Audit Log Trail */}
        <AuditTable logs={auditLogs} />
      </main>

      <footer className="border-t border-[#273449]/60 py-4 px-6 text-center text-xs text-slate-500">
        CarbonGuard — Autonomous Carbon Quota Governance & Ledger Infrastructure. Built for Sustainability & Platform Engineering.
      </footer>
    </div>
  );
};
