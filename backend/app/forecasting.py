"""CSV-driven forecasts and anomaly analysis for the Eco-Pulse API."""

import json
import os
import sys
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# The forecast engine is shared at the repository root.
REPOSITORY_ROOT = str(Path(__file__).resolve().parents[2])
if REPOSITORY_ROOT not in sys.path:
    sys.path.insert(0, REPOSITORY_ROOT)

from app.optimization import ScheduleRequest, create_schedule
from app.database.db import get_connection
from app.ml_datasets import parse_csv
from forecasting_engine import ForecastEngine, AnomalyDetector
from forecasting_engine.evaluation import evaluate


router = APIRouter()


class AnalyzeRequest(BaseModel):
    csv_text: str = Field(min_length=1, max_length=8 * 1024 * 1024)
    timezone: str = "Asia/Kolkata"
    building_id: str = Field(min_length=1, max_length=100)
    horizon: int = Field(default=24, ge=1, le=48)
    control_inputs: dict | None = None
    source_file: str | None = Field(default=None, max_length=255)


@router.post("/analyze")
def analyze(request: AnalyzeRequest):
    try:
        history = parse_csv(request.csv_text, request.timezone)
        history = history[history.building_id == request.building_id]
        if history.empty:
            raise ValueError("Building not found in uploaded CSV")

        engine = ForecastEngine(request.timezone).fit(history)
        forecast = engine.predict(history, request.horizon)
        report = evaluate(
            history, timezone=request.timezone, include_predictions=True
        )
        alerts = AnomalyDetector(request.timezone).fit(history.iloc[:-24]).detect(
            history.tail(24)
        )
        result = {
            "forecast": json.loads(
                forecast.to_json(orient="records", date_format="iso")
            ),
            "evaluation": report,
            "alerts": alerts,
            "source": "user_upload",
            "equipment_control": False,
        }
        if request.control_inputs is not None:
            values = dict(request.control_inputs)
            values.update(
                demand_kwh=forecast.demand_kw_p95.tolist(),
                solar_kwh=forecast.solar_kw_p05.tolist(),
                step_hours=1,
            )
            result["recommendation"] = create_schedule(
                ScheduleRequest.model_validate(values)
            )
            result["decision_basis"] = (
                "Demand p95 and solar p05 with user-supplied tariff, carbon and "
                "equipment constraints. Hourly mean kW equals energy kWh for "
                "the one-hour intervals."
            )
            battery = values.get("battery") or {}
            result["settings"] = {
                "tariff_per_kwh": (values.get("price_per_kwh") or [None])[0],
                "carbon_kg_per_kwh": (values.get("carbon_kg_per_kwh") or [None])[0],
                "battery_capacity_kwh": battery.get("capacity_kwh"),
                "battery_initial_soc_kwh": battery.get("initial_soc_kwh"),
            }
        else:
            result["recommendation"] = None
            result["decision_basis"] = (
                "Provide control_inputs with price_per_kwh and "
                "carbon_kg_per_kwh arrays plus site equipment constraints to "
                "enable an optimization recommendation."
            )
        # Store only the analysis output and filename; the raw source CSV is not retained.
        encoded_result = json.dumps(result, default=lambda value: value.item() if hasattr(value, "item") else str(value))
        with get_connection() as connection:
            cursor = connection.execute(
                "INSERT INTO forecast_runs (building_id, source_file, result_json) VALUES (?, ?, ?)",
                (request.building_id, os.path.basename(request.source_file or "") or None, encoded_result),
            )
            result["run_id"] = cursor.lastrowid
            result["source_file"] = os.path.basename(request.source_file or "") or None
        return result
    except (ValueError, TypeError) as error:
        raise HTTPException(422, str(error)) from error


@router.get("/runs/latest")
def get_latest_run():
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, building_id, source_file, created_at, result_json FROM forecast_runs ORDER BY id DESC LIMIT 1"
        ).fetchone()
    if row is None:
        return {"run": None}
    return {
        "run_id": row["id"],
        "building_id": row["building_id"],
        "source_file": row["source_file"],
        "created_at": row["created_at"],
        **json.loads(row["result_json"]),
    }
