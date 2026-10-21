from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone
import uuid
from typing import Dict, Any, Optional

from app.models.schema import App, Budget, Usage, LedgerEntry, WorkloadState, AuditLog
from app.services.policy_engine import PolicyEngine, get_grid_carbon_intensity
from app.core.config import settings

class LedgerService:
    @staticmethod
    async def record_telemetry_event(
        db: AsyncSession,
        app_id: str,
        energy_wh: float,
        idempotency_key: str,
        carbon_intensity: Optional[float] = None,
        region: Optional[str] = "us-east-1",
        source: Optional[str] = "simulated",
        event_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Atomically ingests energy telemetry, checks idempotency, computes carbon emissions,
        updates the active budget, evaluates policy rules, and records audit logs.
        """
        now = event_time or datetime.now(timezone.utc)
        
        # 1. Fetch Application
        app_stmt = select(App).filter(App.id == app_id)
        app_result = await db.execute(app_stmt)
        app = app_result.scalar_one_or_none()
        if not app:
            raise ValueError(f"Application with ID '{app_id}' not found.")

        # 2. Check Idempotency Key
        idemp_stmt = select(LedgerEntry).filter(LedgerEntry.idempotency_key == idempotency_key)
        idemp_result = await db.execute(idemp_stmt)
        existing_entry = idemp_result.scalar_one_or_none()
        
        if existing_entry:
            # Idempotency hit: Retrieve current budget & workload state without double-counting
            budget_stmt = select(Budget).filter(Budget.app_id == app_id).order_by(Budget.created_at.desc())
            b_res = await db.execute(budget_stmt)
            budget = b_res.scalars().first()

            wl_stmt = select(WorkloadState).filter(WorkloadState.app_id == app_id)
            wl_res = await db.execute(wl_stmt)
            workload = wl_res.scalar_one_or_none()

            burn_pct = ((budget.consumed_gco2e / budget.limit_gco2e) * 100.0) if budget and budget.limit_gco2e > 0 else 0.0

            # Log duplicate suppression in audit
            audit = AuditLog(
                id=str(uuid.uuid4()),
                app_id=app_id,
                action="DUPLICATE_TELEMETRY_SUPPRESSED",
                details={
                    "idempotency_key": idempotency_key,
                    "suppressed_energy_wh": energy_wh
                },
                reason="Idempotency key already processed",
                actor="ledger-service",
                timestamp=now
            )
            db.add(audit)
            await db.commit()

            return {
                "status": "duplicate_ignored",
                "delta_gco2e": 0.0,
                "total_consumed_gco2e": budget.consumed_gco2e if budget else 0.0,
                "limit_gco2e": budget.limit_gco2e if budget else 0.0,
                "burn_percentage": round(burn_pct, 2),
                "budget_status": budget.status if budget else "UNKNOWN",
                "action_taken": "IDEMPOTENT_REPLAY_IGNORED",
                "worker_status": workload.status if workload else "RUNNING"
            }

        # 3. Calculate Carbon Emissions: (Wh / 1000) * (gCO2e / kWh)
        effective_intensity = carbon_intensity or get_grid_carbon_intensity(region)
        delta_gco2e = (energy_wh / 1000.0) * effective_intensity

        # 4. Fetch Active Budget
        budget_stmt = (
            select(Budget)
            .filter(
                Budget.app_id == app_id,
                Budget.period_start <= now,
                Budget.period_end >= now
            )
            .order_by(Budget.created_at.desc())
        )
        b_res = await db.execute(budget_stmt)
        budget = b_res.scalars().first()

        # If no active budget exists for current window, try latest budget
        if not budget:
            fallback_stmt = select(Budget).filter(Budget.app_id == app_id).order_by(Budget.created_at.desc())
            f_res = await db.execute(fallback_stmt)
            budget = f_res.scalars().first()

        if not budget:
            raise ValueError(f"No carbon budget configured for application '{app_id}'.")

        # 5. Fetch or initialize WorkloadState
        wl_stmt = select(WorkloadState).filter(WorkloadState.app_id == app_id)
        wl_res = await db.execute(wl_stmt)
        workload = wl_res.scalar_one_or_none()
        if not workload:
            workload = WorkloadState(
                id=str(uuid.uuid4()),
                app_id=app_id,
                status="RUNNING",
                concurrency_cap=100
            )
            db.add(workload)
            await db.flush()

        # 6. Evaluate Policy Engine
        eval_result = PolicyEngine.evaluate(
            app=app,
            budget=budget,
            workload=workload,
            additional_carbon_g=delta_gco2e
        )

        prev_workload_status = workload.status
        prev_budget_status = budget.status

        # Update budget
        budget.consumed_gco2e += delta_gco2e
        budget.status = eval_result["budget_status"]

        # Update workload
        workload.status = eval_result["workload_status"]
        workload.concurrency_cap = eval_result["concurrency_cap"]
        if eval_result.get("override_reason"):
            workload.override_reason = eval_result["override_reason"]

        # 7. Append-Only Ledger Entry
        ledger = LedgerEntry(
            id=str(uuid.uuid4()),
            app_id=app_id,
            budget_id=budget.id,
            delta_g=delta_gco2e,
            reason=f"Telemetry ingest ({source}, {energy_wh:.2f}Wh @ {effective_intensity:.1f}g/kWh)",
            idempotency_key=idempotency_key,
            timestamp=now
        )
        db.add(ledger)

        # 8. Record Usage Entry
        usage = Usage(
            id=str(uuid.uuid4()),
            app_id=app_id,
            timestamp=now,
            energy_wh=energy_wh,
            carbon_g=delta_gco2e,
            source=source or "simulated",
            region=region or "us-east-1",
            carbon_intensity=effective_intensity
        )
        db.add(usage)

        # 9. Audit Log on State Change or Policy Enforcement
        if eval_result["action_taken"] or (prev_workload_status != workload.status):
            audit = AuditLog(
                id=str(uuid.uuid4()),
                app_id=app_id,
                action=eval_result["action_taken"] or f"STATE_CHANGED_TO_{workload.status}",
                details={
                    "energy_wh": energy_wh,
                    "delta_gco2e": delta_gco2e,
                    "carbon_intensity": effective_intensity,
                    "region": region,
                    "consumed_total": budget.consumed_gco2e,
                    "limit": budget.limit_gco2e,
                    "burn_percent": eval_result["burn_percent"],
                    "prev_status": prev_workload_status,
                    "new_status": workload.status
                },
                reason=eval_result.get("override_reason") or f"Threshold reached: {eval_result['burn_percent']:.1f}%",
                actor="policy-engine",
                timestamp=now
            )
            db.add(audit)

        await db.commit()

        return {
            "status": "recorded",
            "delta_gco2e": round(delta_gco2e, 4),
            "total_consumed_gco2e": round(budget.consumed_gco2e, 4),
            "limit_gco2e": budget.limit_gco2e,
            "burn_percentage": round(eval_result["burn_percent"], 2),
            "budget_status": budget.status,
            "action_taken": eval_result["action_taken"],
            "worker_status": workload.status
        }
