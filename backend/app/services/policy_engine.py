from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.models.schema import App, Budget, WorkloadState, AuditLog
from app.core.config import settings
import uuid

REGION_CARBON_INTENSITIES: Dict[str, float] = {
    "us-east-1": 380.0,    # PJM grid (coal/natural gas heavy)
    "us-west-2": 110.0,    # Pacific Northwest (hydro / wind)
    "eu-west-1": 290.0,    # Ireland (gas / wind mix)
    "eu-north-1": 35.0,    # Sweden (hydro / nuclear - ultra low carbon)
    "ap-southeast-1": 420.0 # Singapore (gas heavy)
}

def get_grid_carbon_intensity(region: Optional[str]) -> float:
    if not region:
        return settings.DEFAULT_CARBON_INTENSITY
    return REGION_CARBON_INTENSITIES.get(region.lower(), settings.DEFAULT_CARBON_INTENSITY)

class PolicyEngine:
    @staticmethod
    def evaluate(
        app: App,
        budget: Budget,
        workload: WorkloadState,
        additional_carbon_g: float
    ) -> Dict[str, Any]:
        """
        Evaluates budget state after an emissions delta is added.
        Applies policy rules depending on thresholds and criticality.
        """
        new_consumed = budget.consumed_gco2e + additional_carbon_g
        burn_ratio = (new_consumed / budget.limit_gco2e) if budget.limit_gco2e > 0 else 1.0
        burn_percent = burn_ratio * 100.0

        action_taken = None
        target_workload_status = workload.status
        target_concurrency = workload.concurrency_cap
        target_budget_status = budget.status

        # 1. Criticality Check: If workload is 'critical', never hard pause.
        # Allow audited overrun with warning.
        if app.criticality == "critical" and burn_percent >= settings.DEPLETION_THRESHOLD_PERCENT:
            target_budget_status = "OVERRIDDEN"
            target_workload_status = "OVERRIDDEN"
            action_taken = "CRITICAL_OVERRUN_PERMITTED"
            override_reason = f"Criticality '{app.criticality}' exempted from pause. Overrun: {burn_percent:.1f}%"
            return {
                "budget_status": target_budget_status,
                "workload_status": target_workload_status,
                "concurrency_cap": target_concurrency,
                "action_taken": action_taken,
                "override_reason": override_reason,
                "burn_percent": burn_percent,
                "new_consumed": new_consumed
            }

        # 2. Manual override active?
        if workload.status == "OVERRIDDEN" and workload.override_reason:
            target_budget_status = "OVERRIDDEN"
            return {
                "budget_status": target_budget_status,
                "workload_status": "OVERRIDDEN",
                "concurrency_cap": target_concurrency,
                "action_taken": "MANUAL_OVERRIDE_MAINTAINED",
                "override_reason": workload.override_reason,
                "burn_percent": burn_percent,
                "new_consumed": new_consumed
            }

        # 3. Standard Policy Thresholds
        if burn_percent >= settings.DEPLETION_THRESHOLD_PERCENT:
            target_budget_status = "DEPLETED"
            if budget.action == "PAUSE":
                target_workload_status = "PAUSED"
                target_concurrency = 0
                action_taken = "PAUSE_ENFORCED"
            elif budget.action == "THROTTLE":
                target_workload_status = "THROTTLED"
                target_concurrency = 20 # Throttle to 20%
                action_taken = "THROTTLE_ENFORCED"
            else: # ALERT_ONLY
                target_workload_status = "RUNNING"
                action_taken = "ALERT_LOGGED"
        elif burn_percent >= settings.WARNING_THRESHOLD_PERCENT:
            target_budget_status = "WARNING"
            # Maintain running, log warning
            if workload.status == "PAUSED":
                target_workload_status = "RUNNING"
                target_concurrency = 100
            action_taken = "WARNING_THRESHOLD_REACHED"
        else:
            target_budget_status = "ACTIVE"
            if workload.status == "PAUSED":
                target_workload_status = "RUNNING"
                target_concurrency = 100
            action_taken = None

        return {
            "budget_status": target_budget_status,
            "workload_status": target_workload_status,
            "concurrency_cap": target_concurrency,
            "action_taken": action_taken,
            "override_reason": None,
            "burn_percent": burn_percent,
            "new_consumed": new_consumed
        }
