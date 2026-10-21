import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db

@pytest.mark.asyncio
async def test_ai_suite_endpoints():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Fetch apps
        apps_res = await client.get("/api/v1/apps")
        assert apps_res.status_code == 200
        apps_data = apps_res.json()
        assert len(apps_data) > 0
        app_id = apps_data[0]["id"]

        # 2. Test Forecast endpoint
        fc_res = await client.get(f"/api/v1/ai/{app_id}/forecast")
        assert fc_res.status_code == 200
        fc_data = fc_res.json()
        assert "burn_rate_g_per_min" in fc_data
        assert "forecast_points" in fc_data
        assert len(fc_data["scenarios"]) >= 3

        # 3. Test Anomaly Scanner
        ano_res = await client.get(f"/api/v1/ai/{app_id}/anomalies")
        assert ano_res.status_code == 200
        ano_data = ano_res.json()
        assert "anomaly_score" in ano_data
        assert "status" in ano_data
        assert "incidents" in ano_data

        # 4. Test 1-Click Anomaly Remediation
        rem_res = await client.post(
            f"/api/v1/ai/{app_id}/anomalies/remediate",
            json={"action": "THROTTLE_20", "reason": "Test AI Anomaly Throttle"}
        )
        assert rem_res.status_code == 200
        rem_data = rem_res.json()
        assert rem_data["success"] is True
        assert rem_data["action_taken"] == "THROTTLE_20"
        assert rem_data["new_workload_status"] == "THROTTLED"

        # 5. Test AI Model Eco-Optimizer
        eco_res = await client.post(
            "/api/v1/ai/eco-optimizer",
            json={
                "model_name": "Llama-3-70B",
                "parameter_billions": 70.0,
                "current_precision": "fp16",
                "target_precision": "int4",
                "daily_queries": 50000,
                "region": "us-east-1"
            }
        )
        assert eco_res.status_code == 200
        eco_data = eco_res.json()
        assert eco_data["memory_saved_percent"] > 50.0
        assert eco_data["carbon_reduction_percent"] > 50.0
        assert "Inferentia" in eco_data["recommended_hardware"] or "L40S" in eco_data["recommended_hardware"]

        # 6. Test GreenOps Copilot Chat
        chat_res = await client.post(
            f"/api/v1/ai/{app_id}/copilot/chat",
            json={"prompt": "Why is our carbon burn rate so high?"}
        )
        assert chat_res.status_code == 200
        chat_data = chat_res.json()
        assert len(chat_data["response"]) > 20
        assert chat_data["intent"] == "DIAGNOSTIC_ANALYSIS"
        assert len(chat_data["suggestions"]) > 0

        # 7. Test Policy Synthesizer
        pol_res = await client.post(
            f"/api/v1/ai/{app_id}/copilot/synthesize-policy",
            json={"natural_language_rule": "Throttle batch jobs to 20% if carbon intensity > 350 g/kWh and budget > 80%"}
        )
        assert pol_res.status_code == 200
        pol_data = pol_res.json()
        assert pol_data["synthesized_policy"]["enforcement_action"] == "THROTTLE_20"
        assert pol_data["synthesized_policy"]["threshold_value"] == 350.0

        # 8. Test Green Scorecard
        card_res = await client.get(f"/api/v1/ai/{app_id}/scorecard")
        assert card_res.status_code == 200
        card_data = card_res.json()
        assert "overall_grade" in card_data
        assert len(card_data["pillars"]) == 4
