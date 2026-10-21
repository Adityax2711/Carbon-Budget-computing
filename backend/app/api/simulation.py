from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timezone, timedelta
import uuid

from app.core.database import get_db
from app.models.schema import App, Budget, Usage, LedgerEntry, WorkloadState, AuditLog
from app.services.simulator_service import simulator
from app.services.ledger_service import LedgerService
from app.services.policy_engine import REGION_CARBON_INTENSITIES

router = APIRouter(prefix="/simulation", tags=["Live Demonstration & Simulation"])

@router.get("/status")
def get_simulation_status():
    return simulator.status()

@router.post("/start")
async def start_simulation(
    app_id: str = Body(..., embed=True),
    region: str = Body("us-east-1", embed=True),
    load_profile: str = Body("normal", embed=True)
):
    simulator.start(app_id=app_id, region=region, load_profile=load_profile)
    return {"message": "Simulation started", "status": simulator.status()}

@router.post("/stop")
def stop_simulation():
    simulator.stop()
    return {"message": "Simulation stopped", "status": simulator.status()}

@router.post("/set-load")
def set_load_profile(load: str = Body(..., embed=True)):
    if load not in ["idle", "normal", "stress"]:
        raise HTTPException(status_code=400, detail="Load profile must be 'idle', 'normal', or 'stress'")
    simulator.set_load(load)
    return {"message": f"Load profile set to {load}", "status": simulator.status()}

@router.post("/set-region")
def set_cloud_region(region: str = Body(..., embed=True)):
    if region not in REGION_CARBON_INTENSITIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid region. Choose from: {list(REGION_CARBON_INTENSITIES.keys())}"
        )
    simulator.set_region(region)
    return {"message": f"Region set to {region}", "status": simulator.status()}

@router.post("/spike")
async def inject_power_spike(
    app_id: str = Body(..., embed=True),
    energy_wh: float = Body(80.0, embed=True),
    db: AsyncSession = Depends(get_db)
):
    """Injects a sudden power spike to immediately push budget towards warning/depleted."""
    spike_key = f"spike-{uuid.uuid4().hex[:10]}"
    res = await LedgerService.record_telemetry_event(
        db=db,
        app_id=app_id,
        energy_wh=energy_wh,
        idempotency_key=spike_key,
        region=simulator.region,
        source="stress-burst"
    )
    return {"message": "Spike injected successfully", "result": res}

@router.post("/test-idempotency")
async def test_idempotency_replay(
    app_id: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db)
):
    """
    Simulates sending the exact same telemetry event twice.
    First call should record emissions.
    Second call should detect duplicate idempotency key and suppress double-counting.
    """
    fixed_key = f"idemp-test-{uuid.uuid4().hex[:8]}"
    
    # Call 1
    res1 = await LedgerService.record_telemetry_event(
        db=db,
        app_id=app_id,
        energy_wh=25.0,
        idempotency_key=fixed_key,
        region=simulator.region,
        source="test-retry"
    )

    # Call 2 (Replay)
    res2 = await LedgerService.record_telemetry_event(
        db=db,
        app_id=app_id,
        energy_wh=25.0,
        idempotency_key=fixed_key,
        region=simulator.region,
        source="test-retry"
    )

    return {
        "idempotency_key": fixed_key,
        "first_attempt": res1,
        "second_attempt_replay": res2,
        "double_counting_prevented": (res2["status"] == "duplicate_ignored" and res2["delta_gco2e"] == 0.0)
    }

@router.post("/reset-demo")
async def reset_demo_environment(db: AsyncSession = Depends(get_db)):
    """Wipes and seeds fresh demo data with 3 standard workloads to test policies."""
    simulator.stop()

    # Clear tables
    await db.execute(delete(AuditLog))
    await db.execute(delete(LedgerEntry))
    await db.execute(delete(Usage))
    await db.execute(delete(Budget))
    await db.execute(delete(WorkloadState))
    await db.execute(delete(App))
    await db.commit()

    now = datetime.now(timezone.utc)
    month_end = now + timedelta(days=30)

    # App 1: Payment Gateway (Critical - Should never pause on exhaustion)
    app1_id = "app-pay-gateway"
    app1 = App(id=app1_id, name="Payments-Core-API", owner="FinTech Platform", criticality="critical")
    b1 = Budget(id=str(uuid.uuid4()), app_id=app1_id, period_start=now, period_end=month_end, limit_gco2e=250.0, action="ALERT_ONLY")
    w1 = WorkloadState(id=str(uuid.uuid4()), app_id=app1_id, status="RUNNING", concurrency_cap=100)

    # App 2: Recommendation Model Inference (Standard - Should pause when depleted)
    app2_id = "app-recommender"
    app2 = App(id=app2_id, name="ML-Recommender-Engine", owner="AI Research", criticality="standard")
    b2 = Budget(id=str(uuid.uuid4()), app_id=app2_id, period_start=now, period_end=month_end, limit_gco2e=150.0, action="PAUSE")
    w2 = WorkloadState(id=str(uuid.uuid4()), app_id=app2_id, status="RUNNING", concurrency_cap=100)

    # App 3: Nightly Batch Analytics (Batch - Should throttle to 20% concurrency)
    app3_id = "app-nightly-etl"
    app3 = App(id=app3_id, name="Nightly-ETL-Pipeline", owner="Data Engineering", criticality="batch")
    b3 = Budget(id=str(uuid.uuid4()), app_id=app3_id, period_start=now, period_end=month_end, limit_gco2e=300.0, action="THROTTLE")
    w3 = WorkloadState(id=str(uuid.uuid4()), app_id=app3_id, status="RUNNING", concurrency_cap=100)

    for item in [app1, b1, w1, app2, b2, w2, app3, b3, w3]:
        db.add(item)

    # Seed initial audit logs
    init_audit = AuditLog(
        id=str(uuid.uuid4()),
        app_id=app2_id,
        action="ENVIRONMENT_SEEDED",
        details={"note": "Reset to deterministic test fixture"},
        reason="Demo reset",
        actor="system",
        timestamp=now
    )
    db.add(init_audit)

    await db.commit()

    return {
        "message": "Demo environment reset and seeded successfully",
        "apps": [
            {"id": app1_id, "name": app1.name, "criticality": app1.criticality, "budget": 250.0, "action": "ALERT_ONLY"},
            {"id": app2_id, "name": app2.name, "criticality": app2.criticality, "budget": 150.0, "action": "PAUSE"},
            {"id": app3_id, "name": app3.name, "criticality": app3.criticality, "budget": 300.0, "action": "THROTTLE"}
        ]
    }
