import asyncio
import random
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from app.core.database import AsyncSessionLocal
from app.services.ledger_service import LedgerService
from app.services.policy_engine import REGION_CARBON_INTENSITIES

class WorkloadSimulator:
    def __init__(self):
        self.is_running: bool = False
        self.app_id: Optional[str] = None
        self.region: str = "us-east-1"
        self.load_profile: str = "normal" # idle (15W), normal (65W), stress (280W)
        self.interval_seconds: float = 2.0
        self._task: Optional[asyncio.Task] = None
        self.duplicate_test_key: Optional[str] = None

    def get_power_watts(self) -> float:
        if self.load_profile == "idle":
            return random.uniform(10.0, 20.0)
        elif self.load_profile == "stress":
            return random.uniform(220.0, 310.0)
        else: # normal
            return random.uniform(50.0, 80.0)

    async def _simulation_loop(self):
        while self.is_running:
            try:
                if self.app_id:
                    # Calculate energy for this interval:
                    # Power (Watts) * (interval_seconds / 3600) = Watt-hours
                    power_w = self.get_power_watts()
                    energy_wh = power_w * (self.interval_seconds / 3600.0)
                    
                    idempotency_key = f"sim-{self.app_id}-{uuid.uuid4().hex[:12]}"
                    
                    async with AsyncSessionLocal() as db:
                        res = await LedgerService.record_telemetry_event(
                            db=db,
                            app_id=self.app_id,
                            energy_wh=energy_wh,
                            idempotency_key=idempotency_key,
                            region=self.region,
                            source="synthetic-meter"
                        )
                        # If paused due to depletion, don't keep firing high power
                        if res.get("worker_status") == "PAUSED":
                            # Workload is paused!
                            pass
            except Exception as e:
                print(f"Simulation error: {e}")

            await asyncio.sleep(self.interval_seconds)

    def start(self, app_id: str, region: str = "us-east-1", load_profile: str = "normal"):
        if self.is_running:
            self.stop()
        self.app_id = app_id
        self.region = region
        self.load_profile = load_profile
        self.is_running = True
        self._task = asyncio.create_task(self._simulation_loop())

    def stop(self):
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None

    def set_load(self, load_profile: str):
        self.load_profile = load_profile

    def set_region(self, region: str):
        if region in REGION_CARBON_INTENSITIES:
            self.region = region

    def status(self) -> Dict[str, Any]:
        return {
            "is_running": self.is_running,
            "app_id": self.app_id,
            "region": self.region,
            "carbon_intensity_g_kwh": REGION_CARBON_INTENSITIES.get(self.region, 380.0),
            "load_profile": self.load_profile,
            "interval_seconds": self.interval_seconds
        }

simulator = WorkloadSimulator()
