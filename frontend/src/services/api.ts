import { 
  AppItem, 
  BudgetItem, 
  WorkloadStateItem, 
  TelemetryRecord, 
  AuditLogItem, 
  SystemMetrics, 
  SimulationStatus,
  SchedulerRecommendation
} from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Apps
  getApps: () => request<AppItem[]>('/apps'),
  createApp: (data: { name: string; owner: string; criticality: string }) =>
    request<AppItem>('/apps', { method: 'POST', body: JSON.stringify(data) }),

  // Budgets
  getBudget: (appId: string) => request<BudgetItem>(`/apps/${appId}/budget`),
  createBudget: (data: { app_id: string; limit_gco2e: number; action: string }) =>
    request<BudgetItem>('/budgets', { method: 'POST', body: JSON.stringify(data) }),

  // Workload Control
  getWorkloadStatus: (appId: string) => request<WorkloadStateItem>(`/workloads/${appId}/status`),
  pauseWorkload: (appId: string, reason: string) =>
    request<WorkloadStateItem>(`/workloads/${appId}/pause`, {
      method: 'POST',
      body: JSON.stringify({ reason, actor: 'dashboard-operator' }),
    }),
  resumeWorkload: (appId: string, reason: string) =>
    request<WorkloadStateItem>(`/workloads/${appId}/resume`, {
      method: 'POST',
      body: JSON.stringify({ reason, actor: 'dashboard-operator' }),
    }),
  overrideWorkload: (appId: string, reason: string, temporary_boost_gco2e = 0) =>
    request<WorkloadStateItem>(`/workloads/${appId}/override`, {
      method: 'POST',
      body: JSON.stringify({ reason, temporary_boost_gco2e, actor: 'platform-admin' }),
    }),

  // Telemetry
  getTelemetryHistory: (appId: string) => request<TelemetryRecord[]>(`/telemetry/history/${appId}`),

  // Audit
  getAuditLogs: (appId?: string) => request<AuditLogItem[]>(appId ? `/audit?app_id=${appId}` : '/audit'),

  // Metrics
  getMetrics: () => request<SystemMetrics>('/metrics'),

  // Simulation & Demo
  getSimulationStatus: () => request<SimulationStatus>('/simulation/status'),
  startSimulation: (appId: string, region: string, loadProfile: string) =>
    request<{ message: string; status: SimulationStatus }>('/simulation/start', {
      method: 'POST',
      body: JSON.stringify({ app_id: appId, region, load_profile: loadProfile }),
    }),
  stopSimulation: () =>
    request<{ message: string; status: SimulationStatus }>('/simulation/stop', { method: 'POST' }),
  setLoadProfile: (load: string) =>
    request<{ message: string; status: SimulationStatus }>('/simulation/set-load', {
      method: 'POST',
      body: JSON.stringify({ load }),
    }),
  setRegion: (region: string) =>
    request<{ message: string; status: SimulationStatus }>('/simulation/set-region', {
      method: 'POST',
      body: JSON.stringify({ region }),
    }),
  injectSpike: (appId: string, energy_wh = 80.0) =>
    request<any>('/simulation/spike', {
      method: 'POST',
      body: JSON.stringify({ app_id: appId, energy_wh }),
    }),
  testIdempotency: (appId: string) =>
    request<any>('/simulation/test-idempotency', {
      method: 'POST',
      body: JSON.stringify({ app_id: appId }),
    }),
  resetDemo: () => request<any>('/simulation/reset-demo', { method: 'POST' }),

  // Carbon-Aware Spatial Scheduler
  getSchedulerOptions: (appId: string) => request<SchedulerRecommendation>(`/scheduler/${appId}/options`),
  executeReroute: (appId: string, targetRegion: string, reason?: string) =>
    request<any>(`/scheduler/${appId}/reroute`, {
      method: 'POST',
      body: JSON.stringify({ target_region: targetRegion, reason }),
    }),

  // AI Carbon Intelligence Suite
  getAIForecast: (appId: string) =>
    request<import('../types').AIForecastResponse>(`/ai/${appId}/forecast`),
  getAIAnomalies: (appId: string) =>
    request<import('../types').AIAnomalyReport>(`/ai/${appId}/anomalies`),
  remediateAnomaly: (appId: string, action: string, reason?: string) =>
    request<import('../types').RemediateAnomalyResult>(`/ai/${appId}/anomalies/remediate`, {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    }),
  evaluateEcoModel: (data: import('../types').EcoModelInput) =>
    request<import('../types').EcoModelResponse>('/ai/eco-optimizer', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  copilotChat: (appId: string, prompt: string) =>
    request<import('../types').CopilotChatResponse>(`/ai/${appId}/copilot/chat`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
  synthesizePolicy: (appId: string, naturalLanguageRule: string) =>
    request<import('../types').PolicySynthesisResponse>(`/ai/${appId}/copilot/synthesize-policy`, {
      method: 'POST',
      body: JSON.stringify({ natural_language_rule: naturalLanguageRule }),
    }),
  getGreenScorecard: (appId: string) =>
    request<import('../types').GreenScorecardResponse>(`/ai/${appId}/scorecard`),
};

