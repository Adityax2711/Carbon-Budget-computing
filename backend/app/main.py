from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.core.config import settings
from app.core.database import init_db, AsyncSessionLocal
from app.api import apps, budgets, telemetry, workloads, audit, simulation, metrics, scheduler, ai
from app.models.schema import App, Budget, WorkloadState
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
import uuid

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    await init_db()

    # Seed initial test app if table is empty
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(App))
        if not res.scalars().first():
            now = datetime.now(timezone.utc)
            app1 = App(
                id="app-recommender",
                name="ML-Recommender-Engine",
                owner="AI Research Lab",
                criticality="standard"
            )
            b1 = Budget(
                id=str(uuid.uuid4()),
                app_id="app-recommender",
                period_start=now,
                period_end=now + timedelta(days=30),
                limit_gco2e=150.0,
                consumed_gco2e=0.0,
                action="PAUSE",
                status="ACTIVE"
            )
            w1 = WorkloadState(
                id=str(uuid.uuid4()),
                app_id="app-recommender",
                status="RUNNING",
                concurrency_cap=100
            )
            db.add_all([app1, b1, w1])
            await db.commit()
            print("Seeded initial ML-Recommender-Engine application.")

    yield
    # Shutdown
    simulation.simulator.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Carbon Budget Governance and Policy Enforcement Engine for Cloud Workloads",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 Routers
app.include_router(apps.router, prefix=settings.API_V1_PREFIX)
app.include_router(budgets.router, prefix=settings.API_V1_PREFIX)
app.include_router(telemetry.router, prefix=settings.API_V1_PREFIX)
app.include_router(workloads.router, prefix=settings.API_V1_PREFIX)
app.include_router(audit.router, prefix=settings.API_V1_PREFIX)
app.include_router(simulation.router, prefix=settings.API_V1_PREFIX)
app.include_router(metrics.router, prefix=settings.API_V1_PREFIX)
app.include_router(scheduler.router, prefix=settings.API_V1_PREFIX)
app.include_router(ai.router, prefix=settings.API_V1_PREFIX)

@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "docs_url": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
