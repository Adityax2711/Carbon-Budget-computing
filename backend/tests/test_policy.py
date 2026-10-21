import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone, timedelta
import uuid

from app.main import app
from app.core.database import init_db

@pytest.mark.asyncio
async def test_full_carbon_budget_workflow():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Reset demo environment
        reset_res = await client.post("/api/v1/simulation/reset-demo")
        assert reset_res.status_code == 200

        # 2. Ingest telemetry into ML-Recommender-Engine (limit: 150 gCO2e)
        app_id = "app-recommender"
        key_1 = f"test-key-1-{uuid.uuid4().hex[:6]}"

        # 50 Wh @ 380 g/kWh = 19 gCO2e (~12.6% of 150g)
        res1 = await client.post("/api/v1/telemetry/ingest", json={
            "app_id": app_id,
            "energy_wh": 50.0,
            "carbon_intensity": 380.0,
            "region": "us-east-1",
            "idempotency_key": key_1
        })
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["status"] == "recorded"
        assert data1["delta_gco2e"] == 19.0
        assert data1["budget_status"] == "ACTIVE"
        assert data1["worker_status"] == "RUNNING"

        # 3. Test Idempotency: Replaying exact same key_1 MUST be ignored (no double counting)
        res_replay = await client.post("/api/v1/telemetry/ingest", json={
            "app_id": app_id,
            "energy_wh": 50.0,
            "carbon_intensity": 380.0,
            "region": "us-east-1",
            "idempotency_key": key_1
        })
        assert res_replay.status_code == 200
        data_replay = res_replay.json()
        assert data_replay["status"] == "duplicate_ignored"
        assert data_replay["delta_gco2e"] == 0.0
        assert data_replay["total_consumed_gco2e"] == 19.0 # not incremented!

        # 4. Push budget to Warning (>80% = >120 gCO2e)
        # Need ~105g more -> 277 Wh @ 380 g/kWh ~ 105.26g
        key_warn = f"test-warn-{uuid.uuid4().hex[:6]}"
        res_warn = await client.post("/api/v1/telemetry/ingest", json={
            "app_id": app_id,
            "energy_wh": 280.0,
            "carbon_intensity": 380.0,
            "region": "us-east-1",
            "idempotency_key": key_warn
        })
        assert res_warn.status_code == 200
        data_warn = res_warn.json()
        assert data_warn["burn_percentage"] >= 80.0
        assert data_warn["budget_status"] == "WARNING"
        assert data_warn["worker_status"] == "RUNNING"

        # 5. Push budget to Depletion (>=100% = >=150 gCO2e)
        # Standard app has action="PAUSE", worker must pause!
        key_deplete = f"test-deplete-{uuid.uuid4().hex[:6]}"
        res_deplete = await client.post("/api/v1/telemetry/ingest", json={
            "app_id": app_id,
            "energy_wh": 100.0,
            "carbon_intensity": 380.0,
            "region": "us-east-1",
            "idempotency_key": key_deplete
        })
        assert res_deplete.status_code == 200
        data_deplete = res_deplete.json()
        assert data_deplete["burn_percentage"] >= 100.0
        assert data_deplete["budget_status"] == "DEPLETED"
        assert data_deplete["worker_status"] == "PAUSED"
        assert data_deplete["action_taken"] == "PAUSE_ENFORCED"

        # 6. Test Critical App Policy: "app-pay-gateway" (criticality: critical)
        # Should NOT pause when depleted, but allow audited overrun
        crit_key = f"test-crit-{uuid.uuid4().hex[:6]}"
        res_crit = await client.post("/api/v1/telemetry/ingest", json={
            "app_id": "app-pay-gateway",
            "energy_wh": 800.0, # 800 * 0.380 = 304g (exceeds 250g budget)
            "carbon_intensity": 380.0,
            "region": "us-east-1",
            "idempotency_key": crit_key
        })
        assert res_crit.status_code == 200
        data_crit = res_crit.json()
        assert data_crit["burn_percentage"] > 100.0
        assert data_crit["worker_status"] == "OVERRIDDEN"
        assert data_crit["action_taken"] == "CRITICAL_OVERRUN_PERMITTED"

        # 7. Verify Audit Log Trail
        audit_res = await client.get("/api/v1/audit")
        assert audit_res.status_code == 200
        audit_logs = audit_res.json()
        actions = [a["action"] for a in audit_logs]
        assert "PAUSE_ENFORCED" in actions
        assert "CRITICAL_OVERRUN_PERMITTED" in actions
        assert "DUPLICATE_TELEMETRY_SUPPRESSED" in actions
