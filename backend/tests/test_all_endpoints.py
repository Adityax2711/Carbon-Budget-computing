import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db

@pytest.mark.asyncio
async def test_all_system_endpoints():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Root & Health
        r_root = await client.get("/")
        assert r_root.status_code == 200
        assert r_root.json()["status"] == "operational"

        r_health = await client.get("/health")
        assert r_health.status_code == 200
        assert r_health.json()["status"] == "healthy"

        # 2. Reset Demo
        r_reset = await client.post("/api/v1/simulation/reset-demo")
        assert r_reset.status_code == 200
        data_reset = r_reset.json()
        assert len(data_reset["apps"]) == 3
        app_id = data_reset["apps"][0]["id"]

        # 3. Apps API
        r_apps = await client.get("/api/v1/apps")
        assert r_apps.status_code == 200
        assert len(r_apps.json()) >= 3

        r_app_detail = await client.get(f"/api/v1/apps/{app_id}")
        assert r_app_detail.status_code == 200

        # 4. Budgets API
        r_budget = await client.get(f"/api/v1/apps/{app_id}/budget")
        assert r_budget.status_code == 200
        assert r_budget.json()["app_id"] == app_id

        # 5. Workload Control
        r_wl = await client.get(f"/api/v1/workloads/{app_id}/status")
        assert r_wl.status_code == 200
        
        r_pause = await client.post(f"/api/v1/workloads/{app_id}/pause", json={"reason": "Audit verification"})
        assert r_pause.status_code == 200
        assert r_pause.json()["status"] == "PAUSED"

        r_resume = await client.post(f"/api/v1/workloads/{app_id}/resume", json={"reason": "Audit resume"})
        assert r_resume.status_code == 200
        assert r_resume.json()["status"] == "RUNNING"

        r_override = await client.post(f"/api/v1/workloads/{app_id}/override", json={"reason": "Manual emergency override", "temporary_boost_gco2e": 50})
        assert r_override.status_code == 200
        assert r_override.json()["status"] == "OVERRIDDEN"

        # 6. Telemetry History & Ingest
        r_telem = await client.post("/api/v1/telemetry/ingest", json={
            "app_id": app_id,
            "energy_wh": 10.0,
            "carbon_intensity": 380.0,
            "region": "us-east-1",
            "idempotency_key": "test-key-comprehensive-1"
        })
        assert r_telem.status_code == 200
        assert r_telem.json()["status"] == "recorded"

        r_hist = await client.get(f"/api/v1/telemetry/history/{app_id}")
        assert r_hist.status_code == 200
        assert len(r_hist.json()) > 0

        # 7. Audit & Ledger
        r_audit = await client.get("/api/v1/audit")
        assert r_audit.status_code == 200
        assert len(r_audit.json()) > 0

        r_ledger = await client.get(f"/api/v1/ledger/{app_id}")
        assert r_ledger.status_code == 200
        assert len(r_ledger.json()) > 0

        # 8. Operational Metrics
        r_metrics = await client.get("/api/v1/metrics")
        assert r_metrics.status_code == 200
        metrics = r_metrics.json()
        assert metrics["total_apps"] >= 3
        assert metrics["active_budgets"] >= 3

        # 9. Simulation endpoints
        r_sim_status = await client.get("/api/v1/simulation/status")
        assert r_sim_status.status_code == 200

        r_sim_start = await client.post("/api/v1/simulation/start", json={"app_id": app_id, "region": "eu-north-1", "load_profile": "normal"})
        assert r_sim_start.status_code == 200

        r_sim_setload = await client.post("/api/v1/simulation/set-load", json={"load": "stress"})
        assert r_sim_setload.status_code == 200

        r_sim_setreg = await client.post("/api/v1/simulation/set-region", json={"region": "us-west-2"})
        assert r_sim_setreg.status_code == 200

        r_sim_spike = await client.post("/api/v1/simulation/spike", json={"app_id": app_id, "energy_wh": 15.0})
        assert r_sim_spike.status_code == 200

        r_sim_idemp = await client.post("/api/v1/simulation/test-idempotency", json={"app_id": app_id})
        assert r_sim_idemp.status_code == 200
        assert r_sim_idemp.json()["double_counting_prevented"] is True

        r_sim_stop = await client.post("/api/v1/simulation/stop")
        assert r_sim_stop.status_code == 200

        # 10. Spatial Scheduler
        r_sched_opts = await client.get(f"/api/v1/scheduler/{app_id}/options")
        assert r_sched_opts.status_code == 200
        assert "all_regions" in r_sched_opts.json()

        r_sched_reroute = await client.post(f"/api/v1/scheduler/{app_id}/reroute", json={"target_region": "eu-north-1", "reason": "Test reroute"})
        assert r_sched_reroute.status_code == 200

        # 11. AI Carbon Intelligence Suite
        r_fc = await client.get(f"/api/v1/ai/{app_id}/forecast")
        assert r_fc.status_code == 200

        r_anom = await client.get(f"/api/v1/ai/{app_id}/anomalies")
        assert r_anom.status_code == 200

        r_rem = await client.post(f"/api/v1/ai/{app_id}/anomalies/remediate", json={"action": "THROTTLE_20", "reason": "Test remediation"})
        assert r_rem.status_code == 200

        r_eco = await client.post("/api/v1/ai/eco-optimizer", json={
            "model_name": "Llama-3-8B",
            "parameter_billions": 8.0,
            "current_precision": "fp16",
            "target_precision": "int4",
            "daily_queries": 10000,
            "region": "eu-north-1"
        })
        assert r_eco.status_code == 200

        r_chat = await client.post(f"/api/v1/ai/{app_id}/copilot/chat", json={"prompt": "Suggest ways to reduce emissions"})
        assert r_chat.status_code == 200

        r_synth = await client.post(f"/api/v1/ai/{app_id}/copilot/synthesize-policy", json={"natural_language_rule": "Pause if budget > 95%"})
        assert r_synth.status_code == 200

        r_score = await client.get(f"/api/v1/ai/{app_id}/scorecard")
        assert r_score.status_code == 200
