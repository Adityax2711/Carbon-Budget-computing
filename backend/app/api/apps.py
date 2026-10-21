from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid

from app.core.database import get_db
from app.models.schema import App, WorkloadState, AuditLog
from app.schemas.domain import AppCreate, AppResponse

router = APIRouter(prefix="/apps", tags=["Applications"])

@router.post("", response_model=AppResponse, status_code=status.HTTP_201_CREATED)
async def create_app(payload: AppCreate, db: AsyncSession = Depends(get_db)):
    # Verify unique name
    stmt = select(App).filter(App.name == payload.name)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An application named '{payload.name}' already exists."
        )

    app_id = str(uuid.uuid4())
    app = App(
        id=app_id,
        name=payload.name,
        owner=payload.owner,
        criticality=payload.criticality
    )
    db.add(app)

    # Initialize default WorkloadState
    workload = WorkloadState(
        id=str(uuid.uuid4()),
        app_id=app_id,
        status="RUNNING",
        concurrency_cap=100
    )
    db.add(workload)

    # Audit log
    audit = AuditLog(
        id=str(uuid.uuid4()),
        app_id=app_id,
        action="APP_REGISTERED",
        details={"name": payload.name, "criticality": payload.criticality, "owner": payload.owner},
        reason="Initial application registration",
        actor="admin"
    )
    db.add(audit)

    await db.commit()
    await db.refresh(app)
    return app

@router.get("", response_model=List[AppResponse])
async def list_apps(db: AsyncSession = Depends(get_db)):
    stmt = select(App).order_by(App.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/{app_id}", response_model=AppResponse)
async def get_app(app_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(App).filter(App.id == app_id)
    res = await db.execute(stmt)
    app = res.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return app
