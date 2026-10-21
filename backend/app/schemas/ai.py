from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class ForecastPoint(BaseModel):
    timestamp: str
    burn_consumed_g: float
    upper_bound_g: float
    lower_bound_g: float
    is_forecast: bool

class WhatIfScenario(BaseModel):
    scenario_id: str
    title: str
    description: str
    runway_minutes: float
    burn_rate_g_per_min: float
    budget_exhaustion_time: Optional[str]
    savings_vs_baseline_percent: float

class ForecastResponse(BaseModel):
    app_id: str
    budget_limit_g: float
    current_consumed_g: float
    remaining_g: float
    burn_rate_g_per_min: float
    estimated_time_to_depletion_minutes: Optional[float]
    depletion_timestamp: Optional[str]
    depletion_risk: str # LOW, MODERATE, HIGH, CRITICAL_IMMINENT
    r_squared_confidence: float
    historical_points: List[ForecastPoint]
    forecast_points: List[ForecastPoint]
    scenarios: List[WhatIfScenario]

class AnomalyIncident(BaseModel):
    id: str
    timestamp: str
    anomaly_type: str # RUNAWAY_INFERENCE, CARBON_LEAK_IDLE, DIRTY_GRID_SURGE, MICROBURST_SPIKE
    severity: str # LOW, MEDIUM, HIGH, CRITICAL
    confidence_score: float # 0 - 100
    wasted_carbon_g: float
    title: str
    description: str
    root_cause: str
    suggested_action: str
    remediation_command: str

class AnomalyReportResponse(BaseModel):
    app_id: str
    anomaly_score: float # 0 - 100
    status: str # HEALTHY, ELEVATED_RISK, LEAK_DETECTED
    detected_count: int
    total_wasted_gco2e: float
    incidents: List[AnomalyIncident]
    last_scan_timestamp: str

class RemediateAnomalyRequest(BaseModel):
    action: str # THROTTLE_20, MIGRATE_SWEDEN, EMERGENCY_PAUSE, REBALANCE_LOAD
    incident_id: Optional[str] = None
    reason: Optional[str] = "AI Autonomous Carbon Leak Remediation"

class RemediateAnomalyResponse(BaseModel):
    success: bool
    action_taken: str
    app_id: str
    new_workload_status: str
    estimated_emissions_mitigated_g: float
    message: str

class EcoModelRequest(BaseModel):
    model_name: Optional[str] = "LLaMA-3-70B"
    parameter_billions: float = Field(70.0, ge=0.5, le=1000.0)
    current_precision: str = Field("fp16", description="fp32, fp16, int8, int4")
    target_precision: str = Field("int4", description="fp32, fp16, int8, int4")
    daily_queries: int = Field(50000, ge=100)
    region: str = Field("us-east-1")

class EcoModelResponse(BaseModel):
    model_name: str
    parameter_billions: float
    baseline_precision: str
    optimized_precision: str
    memory_footprint_gb_baseline: float
    memory_footprint_gb_optimized: float
    memory_saved_percent: float
    baseline_daily_energy_kwh: float
    optimized_daily_energy_kwh: float
    daily_energy_saved_kwh: float
    baseline_daily_carbon_g: float
    optimized_daily_carbon_g: float
    daily_carbon_saved_g: float
    monthly_carbon_saved_kg: float
    carbon_reduction_percent: float
    recommended_hardware: str
    hardware_efficiency_gain: str
    rationale: str

class CopilotChatRequest(BaseModel):
    prompt: str
    context_filters: Optional[Dict[str, Any]] = None

class CopilotChatResponse(BaseModel):
    response: str
    suggestions: List[str]
    intent: str
    action_items: List[str]
    confidence: float

class PolicySynthesisRequest(BaseModel):
    natural_language_rule: str

class SynthesizedPolicy(BaseModel):
    policy_id: str
    rule_name: str
    description: str
    trigger_metric: str # CARBON_INTENSITY, BUDGET_RATIO, POWER_WATTS, RUNAWAY_ANOMALY
    trigger_condition: str # >, >=, <, <=
    threshold_value: float
    target_scope: str # ALL_APPS, NON_CRITICAL, BATCH_ONLY, SPECIFIC_APP
    enforcement_action: str # THROTTLE_20, MIGRATE_REGION, PAUSE, ALERT_ONLY
    target_region: Optional[str] = None
    ai_rationale: str
    projected_savings_percent: float

class PolicySynthesisResponse(BaseModel):
    original_prompt: str
    synthesized_policy: SynthesizedPolicy
    executable: bool

class PillarScore(BaseModel):
    name: str
    score: float # 0 - 25
    max_score: float = 25.0
    status: str # EXCELLENT, GOOD, FAIR, POOR
    insight: str

class GreenScorecardResponse(BaseModel):
    app_id: str
    app_name: str
    overall_grade: str # A+, A, B, C, D, F
    overall_score: float # 0 - 100
    pillars: List[PillarScore]
    summary: str
    top_recommendations: List[str]
