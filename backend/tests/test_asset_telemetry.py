from uuid import uuid4

from fastapi.testclient import TestClient

from app.database import db
from app.database.models import initialize_database
from app.main import app


client = TestClient(app)


def test_asset_telemetry_batch_is_queryable(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DATABASE_PATH", tmp_path / "telemetry.db")
    initialize_database()
    asset = f"bms-{uuid4()}"
    response = client.post(
        "/api/energy/telemetry/batch",
        json={
            "readings": [
                {
                    "timestamp": "2026-11-01T09:00:00+05:30",
                    "building_id": "Block A",
                    "asset_id": asset,
                    "asset_type": "battery",
                    "metric": "state_of_charge_pct",
                    "value": 76.5,
                    "unit": "%",
                    "source_id": "gateway-1",
                }
            ]
        },
    )

    assert response.status_code == 201
    assert response.json()["created_count"] == 1
    readings = client.get(
        "/api/energy/telemetry", params={"asset_type": "battery"}
    ).json()["readings"]
    saved = next(row for row in readings if row["asset_id"] == asset)
    assert saved["value"] == 76.5
    assert saved["unit"] == "%"
    assert saved["source_id"] == "gateway-1"


def test_asset_telemetry_rejects_timezone_free_timestamps(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DATABASE_PATH", tmp_path / "naive.db")
    initialize_database()
    response = client.post(
        "/api/energy/telemetry/batch",
        json={
            "readings": [
                {
                    "timestamp": "2026-11-01T09:00:00",
                    "building_id": "Block A",
                    "asset_id": "battery-1",
                    "asset_type": "battery",
                    "metric": "state_of_charge_pct",
                    "value": 76.5,
                    "unit": "%",
                }
            ]
        },
    )

    assert response.status_code == 422
