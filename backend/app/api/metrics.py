from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.schema import App, Budget, LedgerEntry, WorkloadState, AuditLog
from app.schemas.domain import SystemMetricsResponse

router = APIRouter(prefix="/metrics", tags=["Operational Metrics"])

@router.get("", response_model=SystemMetricsResponse)
async def get_system_metrics(db: AsyncSession = Depends(get_db)):
    # Total apps
    total_apps = (await db.execute(select(func.count(App.id)))).scalar() or 0
    
    # Active budgets
    active_budgets = (await db.execute(select(func.count(Budget.id)))).scalar() or 0
    
    # Total carbon consumed
    total_carbon = (await db.execute(select(func.sum(Budget.consumed_gco2e)))).scalar() or 0.0
    
    # Total ledger entries
    total_ledger = (await db.execute(select(func.count(LedgerEntry.id)))).scalar() or 0

    # Workloads running / paused / throttled / overridden
    wl_running = (await db.execute(select(func.count(WorkloadState.id)).filter(WorkloadState.status == "RUNNING"))).scalar() or 0
    wl_paused = (await db.execute(select(func.count(WorkloadState.id)).filter(WorkloadState.status == "PAUSED"))).scalar() or 0
    wl_throttled = (await db.execute(select(func.count(WorkloadState.id)).filter(WorkloadState.status == "THROTTLED"))).scalar() or 0
    wl_overridden = (await db.execute(select(func.count(WorkloadState.id)).filter(WorkloadState.status == "OVERRIDDEN"))).scalar() or 0

    # Duplicate suppressions
    dup_count = (await db.execute(
        select(func.count(AuditLog.id)).filter(AuditLog.action == "DUPLICATE_TELEMETRY_SUPPRESSED")
    )).scalar() or 0

    return SystemMetricsResponse(
        total_apps=total_apps,
        active_budgets=active_budgets,
        total_carbon_consumed_g=round(total_carbon, 2),
        total_ledger_entries=total_ledger,
        workloads_running=wl_running,
        workloads_paused=wl_paused,
        workloads_throttled=wl_throttled,
        workloads_overridden=wl_overridden,
        duplicate_suppressions=dup_count
    )
