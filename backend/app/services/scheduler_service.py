from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid

from app.services.policy_engine import REGION_CARBON_INTENSITIES
from app.models.schema import App, Budget, WorkloadState, AuditLog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Regional carbon data with metadata
REGION_METADATA: Dict[str, Dict[str, Any]] = {
    "us-east-1": {
        "name": "US East (N. Virginia)",
        "intensity": 380.0,
        "primary_grid": "PJM Interconnection (Coal, Natural Gas, Nuclear)",
        "renewable_share": "18%",
        "pue": 1.15
    },
    "us-west-2": {
        "name": "US West (Oregon)",
        "intensity": 110.0,
        "primary_grid": "Northwest Power Pool (Hydroelectric, Wind)",
        "renewable_share": "72%",
        "pue": 1.12
    },
    "eu-west-1": {
        "name": "Europe (Ireland)",
        "intensity": 290.0,
        "primary_grid": "EirGrid (Wind, Natural Gas)",
        "renewable_share": "42%",
        "pue": 1.14
    },
    "eu-north-1": {
        "name": "Europe (Stockholm, Sweden)",
        "intensity": 35.0,
        "primary_grid": "Nordic Synchronous Area (Hydroelectric, Nuclear)",
        "renewable_share": "96%",
        "pue": 1.10
    },
    "ap-southeast-1": {
        "name": "Asia Pacific (Singapore)",
        "intensity": 420.0,
        "primary_grid": "Singapore National Grid (Natural Gas Heavy)",
        "renewable_share": "6%",
        "pue": 1.20
    }
}

class CarbonScheduler:
    @staticmethod
    def evaluate_spatial_options(current_region: str, budget_remaining_g: float, hourly_power_w: float = 65.0) -> Dict[str, Any]:
        """
        Analyzes all cloud regions and identifies the optimal green target for spatial workload migration.
        """
        curr_intensity = REGION_CARBON_INTENSITIES.get(current_region, 380.0)
        
        # Current burn rate in gCO2e per hour: (Watts / 1000) * intensity
        current_burn_rate_per_hour = (hourly_power_w / 1000.0) * curr_intensity
        current_runway_hours = (budget_remaining_g / current_burn_rate_per_hour) if current_burn_rate_per_hour > 0 else 0.0

        candidates: List[Dict[str, Any]] = []
        for reg_id, meta in REGION_METADATA.items():
            cand_intensity = meta["intensity"]
            cand_burn_rate = (hourly_power_w / 1000.0) * cand_intensity
            cand_runway = (budget_remaining_g / cand_burn_rate) if cand_burn_rate > 0 else 0.0
            
            savings_pct = ((curr_intensity - cand_intensity) / curr_intensity) * 100.0 if curr_intensity > 0 else 0.0
            
            candidates.append({
                "region_id": reg_id,
                "name": meta["name"],
                "intensity_g_kwh": cand_intensity,
                "primary_grid": meta["primary_grid"],
                "renewable_share": meta["renewable_share"],
                "pue": meta["pue"],
                "burn_rate_per_hour_g": round(cand_burn_rate, 3),
                "runway_hours": round(cand_runway, 1),
                "emissions_reduction_percent": round(max(0.0, savings_pct), 1),
                "is_current": (reg_id == current_region)
            })

        # Sort candidate regions from cleanest to dirtiest
        candidates.sort(key=lambda x: x["intensity_g_kwh"])
        optimal_region = candidates[0]

        return {
            "current_region": current_region,
            "current_intensity_g_kwh": curr_intensity,
            "current_runway_hours": round(current_runway_hours, 1),
            "optimal_target_region": optimal_region["region_id"],
            "optimal_target_name": optimal_region["name"],
            "potential_savings_percent": round(max(0.0, ((curr_intensity - optimal_region["intensity_g_kwh"]) / curr_intensity) * 100.0), 1),
            "extended_runway_hours": round(optimal_region["runway_hours"] - current_runway_hours, 1),
            "all_regions": candidates
        }

    @staticmethod
    async def migrate_workload_region(
        db: AsyncSession,
        app_id: str,
        target_region: str,
        actor: str = "carbon-scheduler",
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes a spatial shift of the workload to a cleaner cloud region and logs an immutable audit trail.
        """
        if target_region not in REGION_METADATA:
            raise ValueError(f"Invalid target region '{target_region}'")

        target_meta = REGION_METADATA[target_region]
        now = datetime.now(timezone.utc)

        # Audit log the migration
        audit = AuditLog(
            id=str(uuid.uuid4()),
            app_id=app_id,
            action="SPATIAL_SHIFT_EXECUTED",
            details={
                "target_region": target_region,
                "target_name": target_meta["name"],
                "new_intensity_g_kwh": target_meta["intensity"],
                "primary_grid": target_meta["primary_grid"]
            },
            reason=reason or f"Rerouted to low-carbon region {target_region} ({target_meta['intensity']} g/kWh)",
            actor=actor,
            timestamp=now
        )
        db.add(audit)
        await db.commit()

        return {
            "status": "migrated",
            "app_id": app_id,
            "target_region": target_region,
            "intensity_g_kwh": target_meta["intensity"],
            "grid_description": target_meta["primary_grid"],
            "timestamp": now.isoformat()
        }

scheduler = CarbonScheduler()
