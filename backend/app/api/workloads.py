from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import uuid

from app.core.database import get_db
from app.models.schema import WorkloadState, AuditLog, Budget, App
from app.schemas.domain import WorkloadControlRequest, WorkloadOverrideRequest, WorkloadStateResponse

router = APIRouter(prefix="/workloads", tags=["Workload Control"])

@router.get("/{app_id}/status", response_model=WorkloadStateResponse)
async def get_workload_status(app_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(WorkloadState).filter(WorkloadState.app_id == app_id)
    res = await db.execute(stmt)
    workload = res.scalar_one_or_none()
    if not workload:
        # Check if app exists
        app_stmt = select(App).filter(App.id == app_id)
        app_res = await db.execute(app_stmt)
        if not app_res.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
        workload = WorkloadState(
            id=str(uuid.uuid4()),
            app_id=app_id,
            status="RUNNING",
            concurrency_cap=100
        )
        db.add(workload)
        await db.commit()
        await db.refresh(workload)
    return workload

@router.post("/{app_id}/pause", response_model=WorkloadStateResponse)
async def pause_workload(app_id: str, payload: WorkloadControlRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(WorkloadState).filter(WorkloadState.app_id == app_id)
    res = await db.execute(stmt)
    workload = res.scalar_one_or_none()
    if not workload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workload not found")

    workload.status = "PAUSED"
    workload.concurrency_cap = 0
    workload.override_reason = payload.reason

    audit = AuditLog(
        id=str(uuid.uuid4()),
        app_id=app_id,
        action="MANUAL_PAUSE_TRIGGERED",
        details={"reason": payload.reason},
        reason=payload.reason,
        actor=payload.actor or "admin",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)

    await db.commit()
    await db.refresh(workload)
    return workload

@router.post("/{app_id}/resume", response_model=WorkloadStateResponse)
async def resume_workload(app_id: str, payload: WorkloadControlRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(WorkloadState).filter(WorkloadState.app_id == app_id)
    res = await db.execute(stmt)
    workload = res.scalar_one_or_none()
    if not workload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workload not found")

    workload.status = "RUNNING"
    workload.concurrency_cap = 100
    workload.override_reason = None

    audit = AuditLog(
        id=str(uuid.uuid4()),
        app_id=app_id,
        action="MANUAL_RESUME_TRIGGERED",
        details={"reason": payload.reason},
        reason=payload.reason,
        actor=payload.actor or "admin",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)

    await db.commit()
    await db.refresh(workload)
    return workload

@router.post("/{app_id}/override", response_model=WorkloadStateResponse)
async def override_workload(app_id: str, payload: WorkloadOverrideRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(WorkloadState).filter(WorkloadState.app_id == app_id)
    res = await db.execute(stmt)
    workload = res.scalar_one_or_none()
    if not workload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workload not found")

    # Update active budget if temporary boost is provided
    if payload.temporary_boost_gco2e and payload.temporary_boost_gco2e > 0:
        b_stmt = select(Budget).filter(Budget.app_id == app_id).order_by(Budget.created_at.desc())
        b_res = await db.execute(b_stmt)
        budget = b_res.scalars().first()
        if budget:
            budget.limit_gco2e += payload.temporary_boost_gco2e
            budget.status = "OVERRIDDEN"

    workload.status = "OVERRIDDEN"
    workload.concurrency_cap = 100
    workload.override_reason = payload.reason

    audit = AuditLog(
        id=str(uuid.uuid4()),
        app_id=app_id,
        action="POLICY_OVERRIDE_GRANTED",
        details={
            "reason": payload.reason,
            "temporary_boost_gco2e": payload.temporary_boost_gco2e,
            "authorized_actor": payload.actor
        },
        reason=payload.reason,
        actor=payload.actor or "platform-admin",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)

    await db.commit()
    await db.refresh(workload)
    return workload
