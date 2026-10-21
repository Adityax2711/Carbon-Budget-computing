export interface AppItem {
  id: string;
  name: string;
  owner: string;
  criticality: 'critical' | 'standard' | 'batch';
  created_at: string;
}

export interface BudgetItem {
  id: string;
  app_id: string;
  limit_gco2e: number;
  consumed_gco2e: number;
  action: 'PAUSE' | 'THROTTLE' | 'ALERT_ONLY';
  status: 'ACTIVE' | 'WARNING' | 'DEPLETED' | 'OVERRIDDEN';
  period_start: string;
  period_end: string;
  created_at: string;
}

export interface WorkloadStateItem {
  app_id: string;
  status: 'RUNNING' | 'PAUSED' | 'THROTTLED' | 'OVERRIDDEN';
  concurrency_cap: number;
  override_reason?: string | null;
  updated_at: string;
}

export interface TelemetryRecord {
  id: string;
  timestamp: string;
  energy_wh: number;
  carbon_g: number;
  source: string;
  region: string;
  carbon_intensity: number;
}

export interface AuditLogItem {
  id: string;
  app_id?: string;
  action: string;
  details: any;
  reason?: string;
  actor: string;
  timestamp: string;
}

export interface SystemMetrics {
  total_apps: number;
  active_budgets: number;
  total_carbon_consumed_g: number;
  total_ledger_entries: number;
  workloads_running: number;
  workloads_paused: number;
  workloads_throttled: number;
  workloads_overridden: number;
  duplicate_suppressions: number;
}

export interface SimulationStatus {
  is_running: boolean;
  app_id: string | null;
  region: string;
  carbon_intensity_g_kwh: number;
  load_profile: 'idle' | 'normal' | 'stress';
  interval_seconds: number;
}

export interface RegionCandidate {
  region_id: string;
  name: string;
  intensity_g_kwh: number;
  primary_grid: string;
  renewable_share: string;
  pue: number;
  burn_rate_per_hour_g: number;
  runway_hours: number;
  emissions_reduction_percent: number;
  is_current: boolean;
}

export interface SchedulerRecommendation {
  current_region: string;
  current_intensity_g_kwh: number;
  current_runway_hours: number;
  optimal_target_region: string;
  optimal_target_name: string;
  potential_savings_percent: number;
  extended_runway_hours: number;
  all_regions: RegionCandidate[];
}

// AI Carbon Intelligence Types
export interface ForecastPoint {
  timestamp: string;
  burn_consumed_g: number;
  upper_bound_g: number;
  lower_bound_g: number;
  is_forecast: boolean;
}

export interface WhatIfScenario {
  scenario_id: string;
  title: string;
  description: string;
  runway_minutes: number;
  burn_rate_g_per_min: number;
  budget_exhaustion_time?: string;
  savings_vs_baseline_percent: number;
}

export interface AIForecastResponse {
  app_id: string;
  budget_limit_g: number;
  current_consumed_g: number;
  remaining_g: number;
  burn_rate_g_per_min: number;
  estimated_time_to_depletion_minutes?: number | null;
  depletion_timestamp?: string | null;
  depletion_risk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL_IMMINENT';
  r_squared_confidence: number;
  historical_points: ForecastPoint[];
  forecast_points: ForecastPoint[];
  scenarios: WhatIfScenario[];
}

export interface AnomalyIncident {
  id: string;
  timestamp: string;
  anomaly_type: 'RUNAWAY_INFERENCE' | 'CARBON_LEAK_IDLE' | 'DIRTY_GRID_SURGE' | 'MICROBURST_SPIKE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence_score: number;
  wasted_carbon_g: number;
  title: string;
  description: string;
  root_cause: string;
  suggested_action: string;
  remediation_command: string;
}

export interface AIAnomalyReport {
  app_id: string;
  anomaly_score: number;
  status: 'HEALTHY' | 'ELEVATED_RISK' | 'LEAK_DETECTED';
  detected_count: number;
  total_wasted_gco2e: number;
  incidents: AnomalyIncident[];
  last_scan_timestamp: string;
}

export interface RemediateAnomalyResult {
  success: boolean;
  action_taken: string;
  app_id: string;
  new_workload_status: string;
  estimated_emissions_mitigated_g: number;
  message: string;
}

export interface EcoModelInput {
  model_name?: string;
  parameter_billions: number;
  current_precision: 'fp32' | 'fp16' | 'int8' | 'int4';
  target_precision: 'fp32' | 'fp16' | 'int8' | 'int4';
  daily_queries: number;
  region: string;
}

export interface EcoModelResponse {
  model_name: string;
  parameter_billions: number;
  baseline_precision: string;
  optimized_precision: string;
  memory_footprint_gb_baseline: number;
  memory_footprint_gb_optimized: number;
  memory_saved_percent: number;
  baseline_daily_energy_kwh: number;
  optimized_daily_energy_kwh: number;
  daily_energy_saved_kwh: number;
  baseline_daily_carbon_g: number;
  optimized_daily_carbon_g: number;
  daily_carbon_saved_g: number;
  monthly_carbon_saved_kg: number;
  carbon_reduction_percent: number;
  recommended_hardware: string;
  hardware_efficiency_gain: string;
  rationale: string;
}

export interface CopilotChatResponse {
  response: string;
  suggestions: string[];
  intent: string;
  action_items: string[];
  confidence: number;
}

export interface SynthesizedPolicy {
  policy_id: string;
  rule_name: string;
  description: string;
  trigger_metric: string;
  trigger_condition: string;
  threshold_value: number;
  target_scope: string;
  enforcement_action: string;
  target_region?: string | null;
  ai_rationale: string;
  projected_savings_percent: number;
}

export interface PolicySynthesisResponse {
  original_prompt: string;
  synthesized_policy: SynthesizedPolicy;
  executable: boolean;
}

export interface PillarScore {
  name: string;
  score: number;
  max_score: number;
  status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  insight: string;
}

export interface GreenScorecardResponse {
  app_id: string;
  app_name: string;
  overall_grade: string;
  overall_score: number;
  pillars: PillarScore[];
  summary: string;
  top_recommendations: string[];
}


