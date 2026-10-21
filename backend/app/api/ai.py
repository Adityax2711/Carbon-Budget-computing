from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.core.database import get_db
from app.models.schema import App, Budget, WorkloadState, Usage, AuditLog
from app.services.ai_engine import (
    CarbonForecaster,
    CarbonAnomalyDetector,
    EcoModelAdvisor,
    GreenOpsCopilot
)
from app.services.simulator_service import simulator
from app.schemas.ai import (
    ForecastResponse,
    AnomalyReportResponse,
    RemediateAnomalyRequest,
    RemediateAnomalyResponse,
    EcoModelRequest,
    EcoModelResponse,
    CopilotChatRequest,
    CopilotChatResponse,
    PolicySynthesisRequest,
    PolicySynthesisResponse,
    GreenScorecardResponse
)

router = APIRouter(prefix="/ai", tags=["AI Carbon Intelligence"])

async def _fetch_app_context(app_id: str, db: AsyncSession):
    app_res = await db.execute(select(App).filter(App.id == app_id))
    app = app_res.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail=f"Application '{app_id}' not found")

    budget_res = await db.execute(
        select(Budget).filter(Budget.app_id == app_id).order_by(Budget.created_at.desc())
    )
    budget = budget_res.scalars().first()

    wl_res = await db.execute(
        select(WorkloadState).filter(WorkloadState.app_id == app_id)
    )
    workload = wl_res.scalar_one_or_none()

    usages_res = await db.execute(
        select(Usage).filter(Usage.app_id == app_id).order_by(Usage.timestamp.desc()).limit(50)
    )
    usages = list(reversed(usages_res.scalars().all()))

    return app, budget, workload, usages


@router.get("/{app_id}/forecast", response_model=ForecastResponse)
async def get_carbon_forecast(app_id: str, db: AsyncSession = Depends(get_db)):
    """
    Returns predictive burn-rate extrapolation, estimated time to depletion (TTD),
    95% confidence bands, and What-If scenarios.
    """
    app, budget, workload, usages = await _fetch_app_context(app_id, db)
    current_region = simulator.region or "us-east-1"
    return CarbonForecaster.calculate_forecast(
        app=app,
        budget=budget,
        usages=usages,
        current_region=current_region
    )


@router.get("/{app_id}/anomalies", response_model=AnomalyReportResponse)
async def get_carbon_anomalies(app_id: str, db: AsyncSession = Depends(get_db)):
    """
    Scans real-time telemetry for runaway GPU/CPU inferences, off-peak carbon leaks,
    and regional grid surges.
    """
    app, budget, workload, usages = await _fetch_app_context(app_id, db)
    return CarbonAnomalyDetector.scan_for_anomalies(
        app=app,
        budget=budget,
        usages=usages,
        workload=workload
    )


@router.post("/{app_id}/anomalies/remediate", response_model=RemediateAnomalyResponse)
async def remediate_anomaly(
    app_id: str,
    req: RemediateAnomalyRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    1-Click AI Autonomous Anomaly Remediation.
    Instantly mitigates detected carbon leaks by throttling, migrating to green grid,
    or pausing workloads.
    """
    app, budget, workload, _ = await _fetch_app_context(app_id, db)

    action = req.action.upper()
    now = datetime.now(timezone.utc)
    mitigated_g = 18.5

    if action == "THROTTLE_20":
        if workload:
            workload.status = "THROTTLED"
            workload.concurrency_cap = 20
            workload.override_reason = "AI Automated Anomaly Remediation: Concurrency throttled to 20%"
        mitigated_g = 24.2
        message = "AI Concurrency Cap applied (20%). Burn rate cut by 75%."

    elif action == "MIGRATE_SWEDEN":
        simulator.set_region("eu-north-1")
        mitigated_g = 42.0
        message = "Spatial Reroute executed: Migrated compute to eu-north-1 (Stockholm, 35 g/kWh). 90.8% emissions reduction active."

    elif action == "EMERGENCY_PAUSE":
        if workload:
            workload.status = "PAUSED"
            workload.override_reason = "AI Circuit Breaker: Emergency Pause due to critical carbon leak."
        mitigated_g = 65.0
        message = "Workload paused by AI Circuit Breaker to prevent quota breach."

    else:
        if workload:
            workload.status = "RUNNING"
            workload.concurrency_cap = 50
        message = f"AI Rebalanced workload concurrency to 50%."

    # Audit log
    audit_entry = AuditLog(
        id=str(uuid.uuid4()),
        app_id=app_id,
        action="AI_ANOMALY_REMEDIATION",
        details={
            "remediation_action": action,
            "incident_id": req.incident_id,
            "estimated_mitigated_g": mitigated_g,
            "mitigation_notes": req.reason
        },
        reason=req.reason or "AI Automated Carbon Leak Remediation",
        actor="ai-carbon-sentry",
        timestamp=now
    )
    db.add(audit_entry)
    await db.commit()

    return RemediateAnomalyResponse(
        success=True,
        action_taken=action,
        app_id=app_id,
        new_workload_status=workload.status if workload else "RUNNING",
        estimated_emissions_mitigated_g=mitigated_g,
        message=message
    )


@router.post("/eco-optimizer", response_model=EcoModelResponse)
def evaluate_eco_model(req: EcoModelRequest):
    """
    AI/LLM Model Quantization & Hardware Footprint Advisor.
    Calculates precision savings (FP32 vs FP16 vs INT8 vs INT4 AWQ) and recommends green cloud accelerators.
    """
    return EcoModelAdvisor.evaluate_model_footprint(req)


@router.post("/{app_id}/copilot/chat", response_model=CopilotChatResponse)
async def copilot_chat(
    app_id: str,
    req: CopilotChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Context-aware GreenOps AI Copilot.
    Answers diagnostic, optimization, and strategy queries with live DB telemetry context.
    """
    app, budget, workload, usages = await _fetch_app_context(app_id, db)
    return GreenOpsCopilot.answer_query(
        prompt=req.prompt,
        app=app,
        budget=budget,
        workload=workload,
        usages=usages
    )


@router.post("/{app_id}/copilot/synthesize-policy", response_model=PolicySynthesisResponse)
def synthesize_policy(
    app_id: str,
    req: PolicySynthesisRequest
):
    """
    Natural Language Policy Synthesizer.
    Converts plain English operational rules into structured CarbonGuard policy specifications.
    """
    return GreenOpsCopilot.synthesize_policy_from_text(req.natural_language_rule)


@router.get("/{app_id}/scorecard", response_model=GreenScorecardResponse)
async def get_green_scorecard(
    app_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Comprehensive AI Green Efficiency Scorecard (Grade A+ to F, 4 Pillars, and optimization roadmap).
    """
    app, budget, workload, usages = await _fetch_app_context(app_id, db)
    return GreenOpsCopilot.generate_scorecard(
        app=app,
        budget=budget,
        workload=workload,
        usages=usages
    )
