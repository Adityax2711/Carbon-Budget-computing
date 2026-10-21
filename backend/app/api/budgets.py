from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid

from app.core.database import get_db
from app.models.schema import App, Budget, AuditLog
from app.schemas.domain import BudgetCreate, BudgetResponse

router = APIRouter(tags=["Budgets"])

@router.post("/budgets", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(payload: BudgetCreate, db: AsyncSession = Depends(get_db)):
    # 1. Verify app exists
    app_stmt = select(App).filter(App.id == payload.app_id)
    app_res = await db.execute(app_stmt)
    app = app_res.scalar_one_or_none()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application '{payload.app_id}' does not exist."
        )

    now = datetime.now(timezone.utc)
    p_start = payload.period_start or now
    p_end = payload.period_end or (p_start + timedelta(days=30))

    if p_end <= p_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="period_end must be strictly greater than period_start."
        )

    budget_id = str(uuid.uuid4())
    budget = Budget(
        id=budget_id,
        app_id=payload.app_id,
        period_start=p_start,
        period_end=p_end,
        limit_gco2e=payload.limit_gco2e,
        consumed_gco2e=0.0,
        action=payload.action.upper(),
        status="ACTIVE"
    )
    db.add(budget)

    # Record Audit Log
    audit = AuditLog(
        id=str(uuid.uuid4()),
        app_id=payload.app_id,
        action="BUDGET_CREATED",
        details={
            "limit_gco2e": payload.limit_gco2e,
            "action": payload.action.upper(),
            "period_start": p_start.isoformat(),
            "period_end": p_end.isoformat()
        },
        reason="Allocated new carbon budget allowance",
        actor="admin"
    )
    db.add(audit)

    await db.commit()
    await db.refresh(budget)
    return budget

@router.get("/apps/{app_id}/budget", response_model=BudgetResponse)
async def get_app_budget(app_id: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Budget)
        .filter(Budget.app_id == app_id)
        .order_by(Budget.created_at.desc())
    )
    res = await db.execute(stmt)
    budget = res.scalars().first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No carbon budget found for app '{app_id}'."
        )
    return budget
