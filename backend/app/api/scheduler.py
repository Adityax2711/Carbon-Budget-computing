from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.schema import App, Budget
from app.services.scheduler_service import scheduler
from app.services.simulator_service import simulator

router = APIRouter(prefix="/scheduler", tags=["Carbon-Aware Scheduler"])

@router.get("/{app_id}/options")
async def get_scheduling_recommendations(app_id: str, db: AsyncSession = Depends(get_db)):
    # 1. Fetch App & Budget
    app_stmt = select(App).filter(App.id == app_id)
    app_res = await db.execute(app_stmt)
    app = app_res.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    b_stmt = select(Budget).filter(Budget.app_id == app_id).order_by(Budget.created_at.desc())
    b_res = await db.execute(b_stmt)
    budget = b_res.scalars().first()
    
    remaining_g = max(0.0, (budget.limit_gco2e - budget.consumed_gco2e)) if budget else 100.0

    current_region = simulator.region or "us-east-1"
    
    return scheduler.evaluate_spatial_options(
        current_region=current_region,
        budget_remaining_g=remaining_g,
        hourly_power_w=65.0 # Average normal server load
    )

@router.post("/{app_id}/reroute")
async def execute_spatial_reroute(
    app_id: str,
    target_region: str = Body(..., embed=True),
    reason: str = Body("Autonomous carbon mitigation reroute", embed=True),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Update simulator's active region
        simulator.set_region(target_region)
        
        # Log to immutable audit ledger
        res = await scheduler.migrate_workload_region(
            db=db,
            app_id=app_id,
            target_region=target_region,
            actor="carbon-scheduler-deck",
            reason=reason
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reroute failed: {str(e)}")
