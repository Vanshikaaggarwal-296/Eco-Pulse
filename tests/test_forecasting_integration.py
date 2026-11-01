"""Synthetic test fixtures only; never loaded by the organization app."""
import numpy as np
import pandas as pd
import sys
from pathlib import Path

# Make the existing FastAPI app package importable when tests run from the repo root.
BACKEND_DIR = str(Path(__file__).resolve().parents[1] / "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

def synthetic_history(days=56, seed=42):
    """Not real hospital data; kW values are mean power over each hour."""
    rng = np.random.default_rng(seed)
    times = pd.date_range("2026-01-05", periods=days * 24, freq="h", tz="Asia/Kolkata")
    rows = []
    for building, hospital in [("campus_a", False), ("hospital_a", True)]:
        for time in times:
            daytime = 8 <= time.hour < 18
            occupied = daytime and (hospital or time.dayofweek < 5)
            occupancy = max(0, round((100 if hospital else 5) + (180 if occupied else 0) + rng.normal(0, 8)))
            sun = max(0, np.sin(np.pi * (time.hour - 6) / 12)) if 6 < time.hour < 18 else 0
            solar = max(0, 90 * sun * rng.uniform(0.65, 1.0))
            demand = max(0, (65 if hospital else 20) + occupancy * 0.28 + rng.normal(0, 4))
            rows.append({"timestamp": time.isoformat(), "building_id": building,
                         "demand_kw": round(demand, 3), "occupancy": occupancy,
                         "solar_kw": round(solar, 3), "battery_soc_pct": 60.0})
    return pd.DataFrame(rows)

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.database import db
from app.database.models import initialize_database
from app.forecasting import router

def test_ml_feeds_existing_optimizer(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DATABASE_PATH", tmp_path / "forecast.db")
    initialize_database()
    app=FastAPI();app.include_router(router)
    history=synthetic_history(days=35)
    history=history[history.building_id=='campus_a']
    with TestClient(app) as client:
        response=client.post('/analyze',json={'csv_text':history.to_csv(index=False),'building_id':'campus_a','horizon':24,'control_inputs':{'price_per_kwh':[8]*24,'carbon_kg_per_kwh':[0.7]*24}})
        assert response.status_code==200,response.text
        data=response.json()
        assert len(data['forecast'])==24
        assert data['recommendation'] is not None
        assert len(data['evaluation']['predictions'])==168
        assert data['equipment_control'] is False
        latest = client.get('/runs/latest')
        assert latest.status_code == 200
        assert latest.json()['run_id'] == data['run_id']
        assert client.post('/analyze',json={'csv_text':'bad','building_id':'campus_a'}).status_code==422
