import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Bot, 
  TrendingDown, 
  ShieldCheck, 
  Zap, 
  Sliders, 
  Cpu, 
  Send, 
  RefreshCw, 
  Leaf, 
  CheckCircle2, 
  Flame,
  Activity,
  ArrowRight,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';
import { 
  AppItem, 
  AIForecastResponse, 
  AIAnomalyReport, 
  AnomalyIncident, 
  EcoModelResponse, 
  PolicySynthesisResponse, 
  GreenScorecardResponse 
} from '../../../types';
import { api } from '../../../services/api';

interface AISuitePanelProps {
  app: AppItem | null;
  onRefreshParent: () => void;
}

export const AISuitePanel: React.FC<AISuitePanelProps> = ({
  app,
  onRefreshParent
}) => {
  const [activeTab, setActiveTab] = useState<'forecast' | 'anomalies' | 'copilot' | 'eco_model'>('forecast');
  
  // Data States
  const [forecast, setForecast] = useState<AIForecastResponse | null>(null);
  const [anomalies, setAnomalies] = useState<AIAnomalyReport | null>(null);
  const [scorecard, setScorecard] = useState<GreenScorecardResponse | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('baseline');
  
  // Eco Optimizer State
  const [ecoParamB, setEcoParamB] = useState<number>(70);
  const [ecoModelName, setEcoModelName] = useState<string>('Llama-3-70B');
  const ecoCurrentP = 'fp16';
  const [ecoTargetP, setEcoTargetP] = useState<'fp32' | 'fp16' | 'int8' | 'int4'>('int4');
  const [ecoQueries, setEcoQueries] = useState<number>(50000);
  const [ecoResult, setEcoResult] = useState<EcoModelResponse | null>(null);

  // Copilot State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; actionItems?: string[] }>>([
    {
      sender: 'ai',
      text: "👋 Hello! I am your autonomous **GreenOps Copilot**. I analyze real-time grid emissions, telemetry anomalies, and cloud quota burn rates. Ask me anything or try a prompt below!"
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Policy Synthesizer State
  const [policyInput, setPolicyInput] = useState('Throttle batch jobs to 20% if carbon intensity > 300 g/kWh and budget > 80%');
  const [synthesizedPolicy, setSynthesizedPolicy] = useState<PolicySynthesisResponse | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [deployedPolicySuccess, setDeployedPolicySuccess] = useState(false);

  // Anomaly Remediation State
  const [remediatingId, setRemediatingId] = useState<string | null>(null);
  const [remediationMsg, setRemediationMsg] = useState<string | null>(null);

  const [showScorecardModal, setShowScorecardModal] = useState(false);

  // Load AI Data for current App
  const loadAIData = async (appId: string) => {
    try {
      const [fc, ano, sc] = await Promise.all([
        api.getAIForecast(appId).catch(() => null),
        api.getAIAnomalies(appId).catch(() => null),
        api.getGreenScorecard(appId).catch(() => null)
      ]);
      setForecast(fc);
      setAnomalies(ano);
      setScorecard(sc);
    } catch (err) {
      console.error('Failed to load AI data:', err);
    }
  };

  useEffect(() => {
    if (app) {
      loadAIData(app.id);
    }
  }, [app]);

  // Run Eco Calculation on mount & params change
  useEffect(() => {
    const runEco = async () => {
      try {
        const res = await api.evaluateEcoModel({
          model_name: ecoModelName,
          parameter_billions: ecoParamB,
          current_precision: ecoCurrentP,
          target_precision: ecoTargetP,
          daily_queries: ecoQueries,
          region: 'us-east-1'
        });
        setEcoResult(res);
      } catch (err) {
        console.error('Eco calculation error:', err);
      }
    };
    runEco();
  }, [ecoModelName, ecoParamB, ecoCurrentP, ecoTargetP, ecoQueries]);

  // Handle Copilot Send
  const handleSendChat = async (promptToSend?: string) => {
    const text = promptToSend || chatInput;
    if (!text.trim() || !app) return;

    setChatMessages(prev => [...prev, { sender: 'user', text }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await api.copilotChat(app.id, text);
      setChatMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: res.response,
          actionItems: res.action_items
        }
      ]);
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { sender: 'ai', text: `⚠️ Unable to process query: ${err.message}` }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Handle Policy Synthesize
  const handleSynthesizePolicy = async () => {
    if (!policyInput.trim() || !app) return;
    setIsSynthesizing(true);
    setDeployedPolicySuccess(false);
    try {
      const res = await api.synthesizePolicy(app.id, policyInput);
      setSynthesizedPolicy(res);
    } catch (err: any) {
      alert(`Synthesis failed: ${err.message}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Deploy Synthesized Policy
  const handleDeployPolicy = async () => {
    if (!synthesizedPolicy || !app) return;
    try {
      const action = synthesizedPolicy.synthesized_policy.enforcement_action;
      if (action === 'THROTTLE_20') {
        await api.remediateAnomaly(app.id, 'THROTTLE_20', 'Synthesized Green Policy Deployed');
      } else if (action === 'MIGRATE_REGION') {
        await api.executeReroute(app.id, 'eu-north-1', 'Synthesized Green Policy Deployed');
      } else {
        await api.pauseWorkload(app.id, 'Synthesized Green Policy Enforcement');
      }
      setDeployedPolicySuccess(true);
      onRefreshParent();
      loadAIData(app.id);
    } catch (err: any) {
      alert(`Failed to deploy policy: ${err.message}`);
    }
  };

  // Handle 1-Click Anomaly Remediation
  const handleRemediate = async (incident: AnomalyIncident) => {
    if (!app) return;
    setRemediatingId(incident.id);
    setRemediationMsg(null);
    try {
      const res = await api.remediateAnomaly(app.id, incident.remediation_command, incident.title);
      setRemediationMsg(res.message);
      onRefreshParent();
      await loadAIData(app.id);
    } catch (err: any) {
      alert(`Remediation failed: ${err.message}`);
    } finally {
      setRemediatingId(null);
    }
  };

  // Format chart data combining historical & forecast points
  const chartData = React.useMemo(() => {
    if (!forecast) return [];
    const points: any[] = [];
    forecast.historical_points.forEach(p => {
      points.push({
        timestamp: p.timestamp,
        historical_burn: p.burn_consumed_g,
        forecast_burn: null,
        upper_bound: null,
        lower_bound: null
      });
    });
    // Add bridge point
    if (forecast.historical_points.length > 0 && forecast.forecast_points.length > 0) {
      const lastHist = forecast.historical_points[forecast.historical_points.length - 1];
      points.push({
        timestamp: lastHist.timestamp,
        historical_burn: lastHist.burn_consumed_g,
        forecast_burn: lastHist.burn_consumed_g,
        upper_bound: lastHist.burn_consumed_g,
        lower_bound: lastHist.burn_consumed_g
      });
    }
    forecast.forecast_points.forEach(p => {
      points.push({
        timestamp: p.timestamp,
        historical_burn: null,
        forecast_burn: p.burn_consumed_g,
        upper_bound: p.upper_bound_g,
        lower_bound: p.lower_bound_g
      });
    });
    return points;
  }, [forecast]);

  const activeScenario = forecast?.scenarios.find(s => s.scenario_id === selectedScenarioId) || forecast?.scenarios[0];

  const getRiskColor = (risk?: string) => {
    switch (risk) {
      case 'CRITICAL_IMMINENT':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/40 glow-red animate-pulse';
      case 'HIGH':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/40 glow-amber';
      case 'MODERATE':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/40';
      default:
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/40 glow-green';
    }
  };

  return (
    <div className="glass-panel rounded-2xl border border-[#33435C]/60 overflow-hidden shadow-2xl relative">
      {/* Ambient Cyberpunk Header Glow */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#8B7CFF] via-[#38BDF8] to-[#34D399]" />

      {/* Top Banner & Tab Navigation */}
      <div className="p-5 md:p-6 border-b border-[#273449]/80 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[#111A2E]/80 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B7CFF]/30 to-[#38BDF8]/20 border border-[#8B7CFF]/40 flex items-center justify-center glow-purple">
            <Sparkles className="w-5 h-5 text-[#A78BFA] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                CarbonGuard AI Suite
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-[#8B7CFF]/20 text-[#C4B5FD] border border-[#8B7CFF]/40">
                  Gen-3 Neural
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Predictive burn forecasting, carbon leak sentry, GreenOps Copilot, and LLM eco-quantization.
            </p>
          </div>
        </div>

        {/* Right side: Scorecard pill & Tab Selector */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          {scorecard && (
            <button
              onClick={() => setShowScorecardModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition group glow-green"
              title="Click to view full Green Cloud Efficiency Scorecard"
            >
              <Leaf className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-12 transition" />
              <span>Scorecard: <strong className="text-white ml-0.5">{scorecard.overall_grade}</strong> ({scorecard.overall_score} pts)</span>
              <ChevronRight className="w-3 h-3 text-emerald-400/70" />
            </button>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center bg-[#0B1120] p-1 rounded-xl border border-[#273449]">
            <button
              onClick={() => setActiveTab('forecast')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'forecast'
                  ? 'bg-gradient-to-r from-[#8B7CFF] to-[#6366F1] text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Carbon Oracle</span>
            </button>

            <button
              onClick={() => setActiveTab('anomalies')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition relative ${
                activeTab === 'anomalies'
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Leak Sentry</span>
              {anomalies && anomalies.detected_count > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping absolute -top-0.5 -right-0.5" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('copilot')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'copilot'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>GreenOps Copilot</span>
            </button>

            <button
              onClick={() => setActiveTab('eco_model')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'eco_model'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Model EcoOptimizer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-5 md:p-6 bg-[#0E1729]/70">

        {/* ============================================================== */}
        {/* TAB 1: PREDICTIVE BURN FORECAST & TIME-TO-DEPLETION */}
        {/* ============================================================== */}
        {activeTab === 'forecast' && (
          <div className="space-y-6">
            {/* KPI Summary Banner */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#131F33] border border-[#273449] flex flex-col justify-between">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Burn Rate Extrapolation</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white tracking-tight">{forecast?.burn_rate_g_per_min ?? '--'}</span>
                  <span className="text-xs text-slate-400 font-mono">gCO₂e / min</span>
                </div>
                <div className="mt-2 text-[11px] text-emerald-400/90 flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  <span>R² Confidence: {(forecast?.r_squared_confidence ? forecast.r_squared_confidence * 100 : 94.0).toFixed(1)}%</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#131F33] border border-[#273449] flex flex-col justify-between">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Time To Depletion (TTD)</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-amber-300 font-mono tracking-tight">
                    {forecast?.estimated_time_to_depletion_minutes ? `${forecast.estimated_time_to_depletion_minutes}m` : 'Safe / >1d'}
                  </span>
                  <span className="text-xs text-slate-400">until 100% quota</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400 truncate">
                  Est. Exhaustion: {forecast?.depletion_timestamp ? forecast.depletion_timestamp.slice(11, 19) + ' UTC' : 'Indefinite'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#131F33] border border-[#273449] flex flex-col justify-between">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Depletion Risk Level</span>
                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getRiskColor(forecast?.depletion_risk)}`}>
                    <Flame className="w-3.5 h-3.5" />
                    {forecast?.depletion_risk?.replace('_', ' ') || 'LOW'}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  {forecast?.remaining_g.toFixed(1)} gCO₂e budget remaining
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-[#8B7CFF]/15 to-[#38BDF8]/10 border border-[#8B7CFF]/30 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-[#C4B5FD] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#8B7CFF]" />
                  AI Optimal Scenario
                </span>
                <div className="mt-2">
                  <div className="text-base font-bold text-white">Stockholm Hydro Shift</div>
                  <div className="text-xs text-emerald-400 font-semibold mt-0.5">+90.8% emissions reduction</div>
                </div>
                <button
                  onClick={() => app && api.executeReroute(app.id, 'eu-north-1', 'AI One-Click Optimal Scenario Applied').then(() => { onRefreshParent(); loadAIData(app.id); })}
                  className="mt-2 w-full py-1.5 px-2 text-[11px] font-semibold rounded-lg bg-[#8B7CFF]/30 hover:bg-[#8B7CFF]/50 text-white border border-[#8B7CFF]/50 transition flex items-center justify-center gap-1"
                >
                  Apply 1-Click Reroute
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Predictive Curve Chart with 95% Confidence Interval Band */}
            <div className="p-5 rounded-xl bg-[#131F33]/80 border border-[#273449]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    Neural Trajectory Projection
                    <span className="px-2 py-0.5 rounded text-[10px] bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30">
                      95% Confidence Cone
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Continuous blue line shows recorded ledger burn; dotted purple line projects future consumption trajectory.
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
                    <span>Recorded</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#A78BFA]" />
                    <span>Forecast</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-rose-500" />
                    <span>Budget Limit</span>
                  </div>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="histGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A78BFA" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#A78BFA" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="timestamp" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0B1120', borderColor: '#33435C', borderRadius: '12px', fontSize: '12px', color: '#F8FAFC' }}
                      formatter={(val: any, name: string) => [`${Number(val).toFixed(2)} gCO₂e`, name === 'historical_burn' ? 'Recorded' : name === 'forecast_burn' ? 'Projected' : name]}
                    />
                    {forecast && (
                      <ReferenceLine y={forecast.budget_limit_g} stroke="#F43F5E" strokeDasharray="4 4" label={{ value: `Limit (${forecast.budget_limit_g}g)`, fill: '#F43F5E', fontSize: 10, position: 'insideTopRight' }} />
                    )}
                    <Area type="monotone" dataKey="upper_bound" stroke="none" fill="#8B7CFF" fillOpacity={0.15} isAnimationActive={false} />
                    <Area type="monotone" dataKey="historical_burn" stroke="#38BDF8" strokeWidth={2.5} fillOpacity={1} fill="url(#histGradient)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="forecast_burn" stroke="#A78BFA" strokeWidth={2.5} strokeDasharray="5 5" fillOpacity={1} fill="url(#forecastGradient)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* What-If Scenario Matrix */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#8B7CFF]" />
                  What-If Scenario Simulation Engine
                </h3>
                <span className="text-xs text-slate-400">
                  Active Runway: <strong className="text-amber-300 font-mono">{activeScenario?.runway_minutes ?? '--'} min</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {forecast?.scenarios.map(sc => (
                  <div
                    key={sc.scenario_id}
                    onClick={() => setSelectedScenarioId(sc.scenario_id)}
                    className={`p-4 rounded-xl cursor-pointer transition border text-left ${
                      selectedScenarioId === sc.scenario_id
                        ? 'bg-[#1D2B44] border-[#8B7CFF] shadow-lg glow-purple'
                        : 'bg-[#131F33]/70 hover:bg-[#18263D] border-[#273449]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white truncate">{sc.title}</span>
                      {sc.savings_vs_baseline_percent > 0 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                          +{sc.savings_vs_baseline_percent}%
                        </span>
                      ) : sc.savings_vs_baseline_percent < 0 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">
                          {sc.savings_vs_baseline_percent}%
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-300">
                          Baseline
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mb-3">{sc.description}</p>
                    <div className="pt-2 border-t border-[#273449] flex items-center justify-between text-xs">
                      <span className="text-slate-400">Runway:</span>
                      <span className="font-mono font-bold text-amber-300">{sc.runway_minutes} min</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-slate-400">Burn Velocity:</span>
                      <span className="font-mono text-slate-200">{sc.burn_rate_g_per_min} g/min</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: AI ANOMALY & CARBON LEAK SENTRY */}
        {/* ============================================================== */}
        {activeTab === 'anomalies' && (
          <div className="space-y-6">
            {/* Sentry Scanner Radar Banner */}
            <div className="p-5 rounded-xl bg-gradient-to-r from-[#172238] to-[#111A2E] border border-[#273449] flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                    anomalies?.status === 'LEAK_DETECTED'
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 glow-red'
                      : anomalies?.status === 'ELEVATED_RISK'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 glow-amber'
                      : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 glow-green'
                  }`}>
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#111A2E] absolute -top-1 -right-1 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Carbon Sentry Telemetry Scanner</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      anomalies?.status === 'LEAK_DETECTED'
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    }`}>
                      {anomalies?.status || 'HEALTHY'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Continuous statistical Z-Score & Fourier derivative analysis monitoring power draw and grid carbon factor divergence.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Est. Wasted Carbon</span>
                  <span className="text-xl font-bold text-rose-400 font-mono">
                    {anomalies?.total_wasted_gco2e.toFixed(1) || '0.0'} <span className="text-xs text-slate-400">gCO₂e</span>
                  </span>
                </div>
                <button
                  onClick={() => app && loadAIData(app.id)}
                  className="p-2.5 rounded-xl bg-[#1F2F4A] hover:bg-[#283C5F] text-slate-300 hover:text-white border border-[#33435C] transition"
                  title="Rescan now"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Remediation Feedback Alert */}
            {remediationMsg && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between glow-green">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{remediationMsg}</span>
                </div>
                <button onClick={() => setRemediationMsg(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
            )}

            {/* Anomaly Incident List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Detected Telemetry Incidents ({anomalies?.incidents.length || 0})
              </h4>

              {(!anomalies || anomalies.incidents.length === 0) ? (
                <div className="p-8 text-center rounded-xl bg-[#131F33]/50 border border-[#273449]">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-white">All Workload Telemetry Clean</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    No runaway inferences, off-peak leaks, or microburst floods detected. Workload operates within nominal carbon efficiency bands.
                  </p>
                </div>
              ) : (
                anomalies.incidents.map(inc => (
                  <div
                    key={inc.id}
                    className="p-5 rounded-xl bg-[#131F33] border border-[#273449] hover:border-[#38BDF8]/40 transition space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          inc.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 glow-red'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}>
                          {inc.severity}
                        </span>
                        <h5 className="text-sm font-bold text-white">{inc.title}</h5>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-400 font-mono">{inc.timestamp}</span>
                        <span className="text-rose-400 font-bold font-mono">+{inc.wasted_carbon_g}g wasted</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{inc.description}</p>

                    <div className="p-3 rounded-lg bg-[#0B1120] border border-[#273449] text-xs space-y-1">
                      <div className="text-slate-400">
                        <strong className="text-slate-300">Root Cause:</strong> {inc.root_cause}
                      </div>
                      <div className="text-slate-400">
                        <strong className="text-slate-300">Remediation:</strong> {inc.suggested_action}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Confidence: {inc.confidence_score}%</span>
                      <button
                        onClick={() => handleRemediate(inc)}
                        disabled={remediatingId === inc.id}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {remediatingId === inc.id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Mitigating...
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            1-Click AI Auto-Remediate
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: GREENOPS COPILOT & POLICY SYNTHESIZER */}
        {/* ============================================================== */}
        {activeTab === 'copilot' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Copilot Interactive Chat */}
            <div className="lg:col-span-7 flex flex-col h-[520px] rounded-xl bg-[#131F33] border border-[#273449] overflow-hidden">
              <div className="p-3.5 bg-[#172238] border-b border-[#273449] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">GreenOps Intelligence Chat</span>
                </div>
                <span className="text-[10px] text-slate-400">Target: {app?.name || 'Workload'}</span>
              </div>

              {/* Chat Messages Log */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl p-3.5 text-xs leading-relaxed whitespace-pre-line ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-r from-[#8B7CFF] to-[#6366F1] text-white shadow-md'
                          : 'bg-[#1A2840] border border-[#2E3F5C] text-slate-200'
                      }`}
                    >
                      {msg.text}

                      {/* Optional Action Items */}
                      {msg.actionItems && msg.actionItems.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-600/50 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-emerald-300 tracking-wider">Suggested Actions:</span>
                          {msg.actionItems.map((act, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px] text-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                              <span>{act}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#8B7CFF] animate-spin" />
                    <span>Analyzing grid telemetry and policy rules...</span>
                  </div>
                )}
              </div>

              {/* Quick Prompt Chips */}
              <div className="p-2.5 bg-[#0F182A] border-t border-[#273449] flex items-center gap-2 overflow-x-auto">
                {[
                  "Why is burn rate high?",
                  "How to cut emissions by 50%?",
                  "Check Sweden reroute savings",
                  "Synthesize night policy"
                ].map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendChat(chip)}
                    className="flex-shrink-0 px-2.5 py-1 rounded-full bg-[#18263D] hover:bg-[#223554] border border-[#2E3F5C] text-[11px] text-slate-300 hover:text-white transition"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Chat Input */}
              <div className="p-3 bg-[#111A2E] border-t border-[#273449] flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Ask GreenOps Copilot about emissions, costs, or policies..."
                  className="flex-1 bg-[#1A2840] border border-[#2E3F5C] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#8B7CFF]"
                />
                <button
                  onClick={() => handleSendChat()}
                  disabled={!chatInput.trim() || isChatLoading}
                  className="p-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md disabled:opacity-40 transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right 5 Columns: Natural Language Policy Synthesizer */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-xl bg-[#131F33] border border-[#273449] p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-[#8B7CFF]" />
                  <h3 className="text-sm font-bold text-white">Natural Language Policy Synthesizer</h3>
                </div>
                <p className="text-xs text-slate-400">
                  Type an operational governance rule in plain human language. The AI parses constraints into a verifiable CarbonGuard engine policy.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Natural Language Rule</label>
                <textarea
                  rows={3}
                  value={policyInput}
                  onChange={(e) => setPolicyInput(e.target.value)}
                  className="w-full bg-[#0B1120] border border-[#2E3F5C] rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-[#8B7CFF] resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setPolicyInput("Throttle batch jobs to 20% if carbon intensity > 300 g/kWh and budget > 80%")}
                    className="text-[10px] text-slate-400 hover:text-slate-200 underline"
                  >
                    Preset: Intensity Throttle
                  </button>
                  <button
                    onClick={() => setPolicyInput("Migrate workload to Sweden if grid intensity exceeds 250 g/kWh")}
                    className="text-[10px] text-slate-400 hover:text-slate-200 underline"
                  >
                    Preset: Spatial Shift
                  </button>
                </div>
              </div>

              <button
                onClick={handleSynthesizePolicy}
                disabled={isSynthesizing}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#8B7CFF] to-[#6366F1] hover:from-[#7C6AE6] hover:to-[#4F46E5] text-white text-xs font-bold shadow-lg transition flex items-center justify-center gap-2"
              >
                {isSynthesizing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Synthesize Executable Policy
              </button>

              {/* Synthesized Policy Card Preview */}
              {synthesizedPolicy && (
                <div className="p-4 rounded-xl bg-[#0B1120] border border-[#8B7CFF]/40 text-xs space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#C4B5FD]">{synthesizedPolicy.synthesized_policy.rule_name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold">
                      +{synthesizedPolicy.synthesized_policy.projected_savings_percent}% Savings
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 bg-[#131F33] p-2.5 rounded-lg border border-[#273449] space-y-1">
                    <div><span className="text-slate-500">Action:</span> <strong className="text-amber-400">{synthesizedPolicy.synthesized_policy.enforcement_action}</strong></div>
                    <div><span className="text-slate-500">Trigger:</span> {synthesizedPolicy.synthesized_policy.trigger_metric} &gt;= {synthesizedPolicy.synthesized_policy.threshold_value}</div>
                    <div><span className="text-slate-500">Scope:</span> {synthesizedPolicy.synthesized_policy.target_scope}</div>
                  </div>
                  <p className="text-[11px] text-slate-400 italic">"{synthesizedPolicy.synthesized_policy.ai_rationale}"</p>

                  <button
                    onClick={handleDeployPolicy}
                    disabled={deployedPolicySuccess}
                    className="w-full mt-2 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-600/50 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                  >
                    {deployedPolicySuccess ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        Policy Successfully Deployed!
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        Deploy Synthesized Policy to Engine
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: AI MODEL QUANTIZATION & HARDWARE ECO-OPTIMIZER */}
        {/* ============================================================== */}
        {activeTab === 'eco_model' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  AI Workload Quantization & Accelerator Calculator
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Evaluate operational carbon footprints for LLMs, recommend precision levels (FP16 vs INT4 AWQ), and select green cloud silicon.
                </p>
              </div>
            </div>

            {/* Input Controls */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-xl bg-[#131F33] border border-[#273449]">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-2">Model Template</label>
                <select
                  value={ecoModelName}
                  onChange={(e) => {
                    setEcoModelName(e.target.value);
                    if (e.target.value.includes('70B')) setEcoParamB(70);
                    else if (e.target.value.includes('8B') || e.target.value.includes('7B')) setEcoParamB(8);
                    else if (e.target.value.includes('405B')) setEcoParamB(405);
                  }}
                  className="w-full bg-[#0B1120] border border-[#2E3F5C] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8B7CFF]"
                >
                  <option value="Llama-3-70B">Llama-3-70B (High Reasoning)</option>
                  <option value="Llama-3-8B">Llama-3-8B (Lightweight Agent)</option>
                  <option value="Mistral-7B">Mistral-7B (Fast Inference)</option>
                  <option value="Llama-3-405B">Llama-3-405B (Frontier Tier)</option>
                  <option value="Custom">Custom Neural Checkpoint</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Model Size: <span className="text-cyan-400 font-bold">{ecoParamB} Billion Params</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={120}
                  step={1}
                  value={ecoParamB}
                  onChange={(e) => setEcoParamB(Number(e.target.value))}
                  className="w-full accent-cyan-400 mt-2"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-2">Target Quantization</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['fp16', 'int8', 'int4'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setEcoTargetP(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                        ecoTargetP === p
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                          : 'bg-[#0B1120] text-slate-400 border-[#273449] hover:text-white'
                      }`}
                    >
                      {p.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Daily Queries: <span className="text-amber-300 font-bold font-mono">{ecoQueries.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min={5000}
                  max={200000}
                  step={5000}
                  value={ecoQueries}
                  onChange={(e) => setEcoQueries(Number(e.target.value))}
                  className="w-full accent-amber-400 mt-2"
                />
              </div>
            </div>

            {/* Calculated Output Matrix */}
            {ecoResult && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[#131F33] border border-[#273449]">
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider block">VRAM Footprint</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-white font-mono">{ecoResult.memory_footprint_gb_optimized} GB</span>
                    <span className="text-xs text-slate-500 line-through">{ecoResult.memory_footprint_gb_baseline} GB</span>
                  </div>
                  <div className="mt-2 text-xs text-emerald-400 font-semibold">
                    -{ecoResult.memory_saved_percent}% Memory Saved
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#131F33] border border-[#273449]">
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Daily Energy Saved</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-cyan-300 font-mono">{ecoResult.daily_energy_saved_kwh}</span>
                    <span className="text-xs text-slate-400">kWh / day</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    Cuts consumption from {ecoResult.baseline_daily_energy_kwh} kWh
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#131F33] border border-[#273449]">
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Monthly CO₂e Averted</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-emerald-400 font-mono">{ecoResult.monthly_carbon_saved_kg}</span>
                    <span className="text-xs text-slate-400">kg CO₂e</span>
                  </div>
                  <div className="mt-2 text-xs text-emerald-400 font-bold">
                    -{ecoResult.carbon_reduction_percent}% Footprint Cut
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border border-cyan-500/30">
                  <span className="text-[11px] text-cyan-300 uppercase tracking-wider block font-semibold">Recommended Cloud Silicon</span>
                  <div className="mt-2 text-sm font-bold text-white">
                    {ecoResult.recommended_hardware}
                  </div>
                  <div className="mt-1 text-xs text-cyan-400">
                    {ecoResult.hardware_efficiency_gain}
                  </div>
                </div>
              </div>
            )}

            {/* Rationale explanation banner */}
            {ecoResult && (
              <div className="p-4 rounded-xl bg-[#131F33] border border-[#273449] text-xs text-slate-300 leading-relaxed">
                <strong className="text-cyan-400">AI Green Silicon Architecture Insight:</strong> {ecoResult.rationale}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ============================================================== */}
      {/* MODAL: FULL GREEN CLOUD SCORECARD */}
      {/* ============================================================== */}
      {showScorecardModal && scorecard && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-[#111A2E] border border-[#33435C] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#273449] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center glow-green">
                  <span className="text-2xl font-black text-emerald-300">{scorecard.overall_grade}</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Green Cloud Efficiency Scorecard</h3>
                  <p className="text-xs text-slate-400">{scorecard.app_name} • Composite: {scorecard.overall_score} / 100 Points</p>
                </div>
              </div>
              <button
                onClick={() => setShowScorecardModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-[#0B1120] p-3.5 rounded-xl border border-[#273449]">
              {scorecard.summary}
            </p>

            {/* 4 Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scorecard.pillars.map((pillar, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-[#131F33] border border-[#273449] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{pillar.name}</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">{pillar.score} / {pillar.max_score}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#0B1120] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                      style={{ width: `${(pillar.score / pillar.max_score) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">{pillar.insight}</p>
                </div>
              ))}
            </div>

            {/* Top Recommendations */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Top Optimization Levers</h4>
              <ul className="space-y-1.5">
                {scorecard.top_recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowScorecardModal(false)}
                className="px-4 py-2 rounded-xl bg-[#273449] hover:bg-[#33435C] text-white text-xs font-bold transition"
              >
                Close Scorecard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
