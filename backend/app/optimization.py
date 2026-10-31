"""HTTP API that exposes the Eco-Pulse recommendation-only optimizer."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat

# The optimizer is a first-party package at the repository root. Add that
# stable project path so the backend works both from the repository root and
# when launched with ``backend`` as the working directory.
REPOSITORY_ROOT = str(Path(__file__).resolve().parents[2])
if REPOSITORY_ROOT not in sys.path:
    sys.path.insert(0, REPOSITORY_ROOT)

from optimization_engine import BatteryConfig, optimize_schedule, simulate_islanding


router = APIRouter()


class BatterySettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    capacity_kwh: FiniteFloat = Field(gt=0)
    initial_soc_kwh: FiniteFloat = Field(ge=0)
    min_soc_kwh: FiniteFloat = Field(default=0, ge=0)
    reserve_soc_kwh: FiniteFloat = Field(default=0, ge=0)
    max_charge_kw: FiniteFloat = Field(default=0, ge=0)
    max_discharge_kw: FiniteFloat = Field(default=0, ge=0)
    charge_efficiency: FiniteFloat = Field(default=0.95, gt=0, le=1)
    discharge_efficiency: FiniteFloat = Field(default=0.95, gt=0, le=1)
    degradation_cost_per_kwh: FiniteFloat = Field(default=0, ge=0)


class ScheduleRequest(BaseModel):
    """Forecast horizon and operating limits for one schedule recommendation."""

    model_config = ConfigDict(extra="forbid")

    demand_kwh: list[FiniteFloat] = Field(min_length=1, max_length=96)
    solar_kwh: list[FiniteFloat] = Field(min_length=1, max_length=96)
    price_per_kwh: list[FiniteFloat] = Field(min_length=1, max_length=96)
    carbon_kg_per_kwh: list[FiniteFloat] = Field(min_length=1, max_length=96)
    battery: BatterySettings | None = None
    critical_load_kwh: list[FiniteFloat] | None = Field(default=None, max_length=96)
    hvac_load_kwh: list[FiniteFloat] | None = Field(default=None, max_length=96)
    hvac_min_kwh: list[FiniteFloat] | None = Field(default=None, max_length=96)
    flexible_load_kwh: list[FiniteFloat] | None = Field(default=None, max_length=96)
    carbon_weight: FiniteFloat = Field(default=0, ge=0)
    flexible_shed_penalty_per_kwh: FiniteFloat = Field(default=1, ge=0)
    hvac_reduction_penalty_per_kwh: FiniteFloat = Field(default=5, ge=0)
    max_grid_import_kw: FiniteFloat | None = Field(default=None, ge=0)
    step_hours: FiniteFloat = Field(default=1, gt=0, le=24)
    soc_steps: int = Field(default=20, ge=2, le=200)


class OutageRequest(BaseModel):
    """Critical-load and renewable profile for a simulated grid outage."""

    model_config = ConfigDict(extra="forbid")

    critical_load_kwh: list[FiniteFloat] = Field(min_length=1, max_length=96)
    renewable_kwh: list[FiniteFloat] | None = Field(default=None, max_length=96)
    battery: BatterySettings
    step_hours: FiniteFloat = Field(default=1, gt=0, le=24)


def _battery_config(settings: BatterySettings | None) -> BatteryConfig | None:
    if settings is None:
        return None
    return BatteryConfig(**settings.model_dump())


@router.post("/schedule")
def create_schedule(request: ScheduleRequest):
    """Return cost/carbon-aware schedule advice for forecast energy data.

    The result is advisory and explicitly does not control equipment. All
    forecast arrays must use matching intervals and lengths.
    """
    try:
        return optimize_schedule(
            demand_kwh=request.demand_kwh,
            solar_kwh=request.solar_kwh,
            price_per_kwh=request.price_per_kwh,
            carbon_kg_per_kwh=request.carbon_kg_per_kwh,
            battery=_battery_config(request.battery),
            critical_load_kwh=request.critical_load_kwh,
            hvac_load_kwh=request.hvac_load_kwh,
            hvac_min_kwh=request.hvac_min_kwh,
            flexible_load_kwh=request.flexible_load_kwh,
            carbon_weight=request.carbon_weight,
            flexible_shed_penalty_per_kwh=request.flexible_shed_penalty_per_kwh,
            hvac_reduction_penalty_per_kwh=request.hvac_reduction_penalty_per_kwh,
            max_grid_import_kw=request.max_grid_import_kw,
            step_hours=request.step_hours,
            soc_steps=request.soc_steps,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/outage")
def simulate_outage(request: OutageRequest):
    """Estimate backup duration and critical-load shortfall during an outage."""
    try:
        return simulate_islanding(
            critical_load_kwh=request.critical_load_kwh,
            renewable_kwh=request.renewable_kwh,
            battery=_battery_config(request.battery),
            step_hours=request.step_hours,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
