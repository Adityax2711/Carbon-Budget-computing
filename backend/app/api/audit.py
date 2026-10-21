from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional

from app.core.database import get_db
from app.models.schema import AuditLog, LedgerEntry
from app.schemas.domain import AuditLogResponse

router = APIRouter(tags=["Audit & Compliance"])

@router.get("/audit", response_model=List[AuditLogResponse])
async def list_audit_logs(
    app_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
    if app_id:
        stmt = stmt.filter(AuditLog.app_id == app_id)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/ledger/{app_id}")
async def get_ledger_entries(
    app_id: str,
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(LedgerEntry)
        .filter(LedgerEntry.app_id == app_id)
        .order_by(LedgerEntry.timestamp.desc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    entries = res.scalars().all()
    return [
        {
            "id": e.id,
            "budget_id": e.budget_id,
            "delta_g": round(e.delta_g, 4),
            "reason": e.reason,
            "idempotency_key": e.idempotency_key,
            "timestamp": e.timestamp
        }
        for e in entries
    ]
