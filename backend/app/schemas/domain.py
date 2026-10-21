from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, Any, List

class AppBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Application display name")
    owner: str = Field(..., min_length=1, max_length=255, description="Team or service owner")
    criticality: str = Field("standard", description="critical, standard, or batch")

class AppCreate(AppBase):
    pass

class AppResponse(AppBase):
    id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class BudgetBase(BaseModel):
    limit_gco2e: float = Field(..., gt=0, description="Carbon allowance in grams of CO2e")
    action: str = Field("PAUSE", description="Action upon exhaustion: PAUSE, THROTTLE, or ALERT_ONLY")
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None

class BudgetCreate(BudgetBase):
    app_id: str

class BudgetResponse(BudgetBase):
    id: str
    app_id: str
    consumed_gco2e: float
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TelemetryIngest(BaseModel):
    app_id: str
    energy_wh: float = Field(..., ge=0, description="Energy consumed in Watt-hours")
    carbon_intensity: Optional[float] = Field(None, gt=0, description="Carbon intensity in gCO2e/kWh")
    region: Optional[str] = Field("us-east-1", description="Cloud region for grid intensity lookup")
    source: Optional[str] = Field("simulated", description="Telemetry sensor source")
    idempotency_key: str = Field(..., min_length=8, max_length=128, description="Unique event idempotency key")
    timestamp: Optional[datetime] = None

class TelemetryResponse(BaseModel):
    status: str # "recorded" or "duplicate_ignored"
    delta_gco2e: float
    total_consumed_gco2e: float
    limit_gco2e: float
    burn_percentage: float
    budget_status: str
    action_taken: Optional[str] = None
    worker_status: str

class WorkloadControlRequest(BaseModel):
    reason: str = Field(..., min_length=3, description="Justification for the action")
    actor: Optional[str] = Field("admin", description="Who triggered this action")

class WorkloadOverrideRequest(BaseModel):
    reason: str = Field(..., min_length=5, description="Emergency override justification")
    temporary_boost_gco2e: Optional[float] = Field(0.0, ge=0, description="Optional extra allowance")
    actor: Optional[str] = Field("platform-admin", description="Authorized admin actor")

class WorkloadStateResponse(BaseModel):
    app_id: str
    status: str # RUNNING, PAUSED, THROTTLED, OVERRIDDEN
    concurrency_cap: int
    override_reason: Optional[str] = None
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AuditLogResponse(BaseModel):
    id: str
    app_id: Optional[str]
    action: str
    details: Any
    reason: Optional[str]
    actor: str
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class SystemMetricsResponse(BaseModel):
    total_apps: int
    active_budgets: int
    total_carbon_consumed_g: float
    total_ledger_entries: int
    workloads_running: int
    workloads_paused: int
    workloads_throttled: int
    workloads_overridden: int
    duplicate_suppressions: int
