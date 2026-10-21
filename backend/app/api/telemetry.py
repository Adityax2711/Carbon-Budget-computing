from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional

from app.core.database import get_db
from app.models.schema import Usage
from app.schemas.domain import TelemetryIngest, TelemetryResponse
from app.services.ledger_service import LedgerService

router = APIRouter(prefix="/telemetry", tags=["Telemetry & Metering"])

@router.post("/ingest", response_model=TelemetryResponse, status_code=status.HTTP_200_OK)
async def ingest_telemetry(payload: TelemetryIngest, db: AsyncSession = Depends(get_db)):
    try:
        result = await LedgerService.record_telemetry_event(
            db=db,
            app_id=payload.app_id,
            energy_wh=payload.energy_wh,
            idempotency_key=payload.idempotency_key,
            carbon_intensity=payload.carbon_intensity,
            region=payload.region,
            source=payload.source,
            event_time=payload.timestamp
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Telemetry processing failed: {str(e)}"
        )

@router.get("/history/{app_id}")
async def get_telemetry_history(app_id: str, limit: int = 50, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Usage)
        .filter(Usage.app_id == app_id)
        .order_by(Usage.timestamp.desc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    records = res.scalars().all()
    return [
        {
            "id": r.id,
            "timestamp": r.timestamp,
            "energy_wh": round(r.energy_wh, 4),
            "carbon_g": round(r.carbon_g, 4),
            "source": r.source,
            "region": r.region,
            "carbon_intensity": r.carbon_intensity
        }
        for r in records
    ]
