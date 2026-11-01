from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.database.db import get_connection

router = APIRouter()


# --------------------------------------------------
# Request model
# --------------------------------------------------

class EnergyReadingCreate(BaseModel):
    timestamp: datetime
    building_id: str = Field(min_length=1, max_length=100)
    consumption_kwh: float = Field(ge=0)
    solar_generation_kwh: float = Field(ge=0)
    occupancy: int | None = Field(default=None, ge=0)
    grid_import_kwh: float | None = Field(default=None, ge=0)
    cost_inr: float | None = Field(default=None, ge=0)
    carbon_kg: float | None = Field(default=None, ge=0)


class EnergyReadingBatch(BaseModel):
    readings: list[EnergyReadingCreate] = Field(min_length=1, max_length=10000)


class AssetTelemetryCreate(BaseModel):
    timestamp: datetime
    building_id: str = Field(min_length=1, max_length=100)
    asset_id: str = Field(min_length=1, max_length=100)
    asset_type: str = Field(min_length=1, max_length=50)
    metric: str = Field(min_length=1, max_length=80)
    value: float = Field(allow_inf_nan=False)
    unit: str = Field(min_length=1, max_length=24)
    source_id: str | None = Field(default=None, max_length=100)


class AssetTelemetryBatch(BaseModel):
    readings: list[AssetTelemetryCreate] = Field(min_length=1, max_length=10000)


def _validate_reading(reading: EnergyReadingCreate) -> None:
    solar_and_grid = reading.solar_generation_kwh + (reading.grid_import_kwh or 0)
    if solar_and_grid > reading.consumption_kwh + 1e-6:
        raise HTTPException(
            status_code=422,
            detail="Solar used plus grid import cannot exceed consumption.",
        )


@router.post("/telemetry/batch", status_code=201)
def create_asset_telemetry_batch(batch: AssetTelemetryBatch):
    """Store normalized, timestamped device readings; no physical controls are issued."""
    records = []
    seen = set()
    for reading in batch.readings:
        if reading.timestamp.tzinfo is None or reading.timestamp.utcoffset() is None:
            raise HTTPException(status_code=422, detail="Every telemetry timestamp must include a timezone.")
        timestamp = reading.timestamp.astimezone(timezone.utc).isoformat()
        asset_id = reading.asset_id.strip()
        metric = reading.metric.strip().lower()
        key = (timestamp, asset_id.casefold(), metric)
        if key in seen:
            raise HTTPException(status_code=422, detail="The batch contains duplicate timestamp/asset/metric readings.")
        seen.add(key)
        records.append((timestamp, reading.building_id.strip(), asset_id, reading.asset_type.strip().lower(), metric, reading.value, reading.unit.strip(), reading.source_id))
    with get_connection() as connection:
        try:
            connection.executemany(
                "INSERT INTO asset_telemetry (timestamp, building_id, asset_id, asset_type, metric, value, unit, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                records,
            )
        except Exception as error:
            if "UNIQUE constraint failed" in str(error):
                raise HTTPException(status_code=409, detail="A telemetry reading already exists for that timestamp, asset and metric.") from error
            raise
    return {"created_count": len(records), "data_mode": "device_telemetry"}


@router.get("/telemetry")
def get_asset_telemetry(
    building_id: Annotated[str | None, Query(max_length=100)] = None,
    asset_type: Annotated[str | None, Query(max_length=50)] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 500,
):
    clauses = []
    values = []
    if building_id:
        clauses.append("building_id = ?")
        values.append(building_id.strip())
    if asset_type:
        clauses.append("asset_type = ?")
        values.append(asset_type.strip().lower())
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM asset_telemetry" + where + " ORDER BY timestamp DESC, id DESC LIMIT ?",
            (*values, limit),
        ).fetchall()
    return {"count": len(rows), "readings": [dict(row) for row in rows]}


# --------------------------------------------------
# Create an energy reading
# POST /api/energy/readings
# --------------------------------------------------

@router.post("/readings", status_code=201)
def create_reading(reading: EnergyReadingCreate):
    _validate_reading(reading)
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO energy_readings (
                timestamp,
                building_id,
                consumption_kwh,
                solar_generation_kwh,
                occupancy,
                grid_import_kwh,
                cost_inr,
                carbon_kg
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                reading.timestamp.isoformat(),
                reading.building_id.strip(),
                reading.consumption_kwh,
                reading.solar_generation_kwh,
                reading.occupancy,
                reading.grid_import_kwh,
                reading.cost_inr,
                reading.carbon_kg,
            ),
        )

        row = connection.execute(
            "SELECT * FROM energy_readings WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

        return dict(row)


@router.post("/readings/batch", status_code=201)
def create_readings_batch(batch: EnergyReadingBatch):
    """Persist a validated CSV import in one database transaction."""
    records = []
    seen = set()
    for reading in batch.readings:
        _validate_reading(reading)
        if reading.timestamp.tzinfo is None or reading.timestamp.utcoffset() is None:
            raise HTTPException(
                status_code=422,
                detail="Every reading timestamp must include a timezone.",
            )
        timestamp = reading.timestamp.astimezone(timezone.utc).isoformat()
        building_id = reading.building_id.strip()
        key = (timestamp, building_id.casefold())
        if key in seen:
            raise HTTPException(
                status_code=422,
                detail="The batch contains duplicate timestamp/building readings.",
            )
        seen.add(key)
        records.append((timestamp, building_id, reading))

    with get_connection() as connection:
        for timestamp, building_id, _ in records:
            existing = connection.execute(
                "SELECT 1 FROM energy_readings WHERE timestamp = ? AND lower(building_id) = lower(?) LIMIT 1",
                (timestamp, building_id),
            ).fetchone()
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail=f"A reading already exists for {building_id} at {timestamp}.",
                )

        connection.executemany(
            """
            INSERT INTO energy_readings (
                timestamp, building_id, consumption_kwh,
                solar_generation_kwh, occupancy, grid_import_kwh,
                cost_inr, carbon_kg
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    timestamp,
                    building_id,
                    reading.consumption_kwh,
                    reading.solar_generation_kwh,
                    reading.occupancy,
                    reading.grid_import_kwh,
                    reading.cost_inr,
                    reading.carbon_kg,
                )
                for timestamp, building_id, reading in records
            ],
        )

    return {"created_count": len(records), "data_mode": "historical_readings_demo"}


# --------------------------------------------------
# Get energy readings
# GET /api/energy/readings
# --------------------------------------------------

@router.get("/readings")
def get_readings(
    building_id: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    with get_connection() as connection:
        if building_id is None:
            total_count = connection.execute(
                "SELECT COUNT(*) FROM energy_readings"
            ).fetchone()[0]
            rows = connection.execute(
                """
                SELECT * FROM energy_readings
                ORDER BY timestamp DESC, id DESC
                LIMIT ? OFFSET ?
                """,
                (limit, offset),
            ).fetchall()
        else:
            normalized_building = building_id.strip()
            total_count = connection.execute(
                "SELECT COUNT(*) FROM energy_readings WHERE building_id = ?",
                (normalized_building,),
            ).fetchone()[0]
            rows = connection.execute(
                """
                SELECT * FROM energy_readings
                WHERE building_id = ?
                ORDER BY timestamp DESC, id DESC
                LIMIT ? OFFSET ?
                """,
                (normalized_building, limit, offset),
            ).fetchall()

    return {
        "count": len(rows),
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "readings": [dict(row) for row in rows],
    }


# --------------------------------------------------
# Get one reading
# GET /api/energy/readings/{reading_id}
# --------------------------------------------------

@router.get("/readings/{reading_id}")
def get_reading(reading_id: int):
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM energy_readings WHERE id = ?",
            (reading_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Energy reading not found",
        )

    return dict(row)


# --------------------------------------------------
# Carbon and energy analytics
# GET /api/energy/analytics
# --------------------------------------------------

@router.get("/analytics")
def get_energy_analytics(
    building_id: Annotated[
        str | None,
        Query(min_length=1, max_length=100),
    ] = None,
    emission_factor: Annotated[
        float,
        Query(gt=0, le=2),
    ] = 0.7,
):
    """
    Calculate energy statistics and estimated CO2 emissions.

    emission_factor:
        Assumed kg CO2 per kWh of grid electricity.
        Default 0.7 is an illustrative demo assumption.
    """

    with get_connection() as connection:
        if building_id is None:
            row = connection.execute(
                """
                SELECT
                    COUNT(*) AS reading_count,
                    COUNT(DISTINCT building_id) AS building_count,
                    COALESCE(SUM(consumption_kwh), 0)
                        AS total_consumption_kwh,
                    COALESCE(SUM(solar_generation_kwh), 0)
                        AS total_solar_generation_kwh,
                    COALESCE(SUM(COALESCE(
                        grid_import_kwh,
                        MAX(consumption_kwh - solar_generation_kwh, 0)
                    )), 0) AS total_grid_import_kwh,
                    COALESCE(SUM(cost_inr), 0) AS total_cost_inr,
                    COUNT(cost_inr) AS cost_reading_count,
                    COUNT(carbon_kg) AS recorded_carbon_count,
                    COALESCE(SUM(COALESCE(
                        carbon_kg,
                        COALESCE(
                            grid_import_kwh,
                            MAX(consumption_kwh - solar_generation_kwh, 0)
                        ) * ?
                    )), 0) AS co2_emissions_kg,
                    COALESCE(AVG(occupancy), 0)
                        AS average_occupancy
                FROM energy_readings
                """,
                (emission_factor,),
            ).fetchone()
        else:
            row = connection.execute(
                """
                SELECT
                    COUNT(*) AS reading_count,
                    COUNT(DISTINCT building_id) AS building_count,
                    COALESCE(SUM(consumption_kwh), 0)
                        AS total_consumption_kwh,
                    COALESCE(SUM(solar_generation_kwh), 0)
                        AS total_solar_generation_kwh,
                    COALESCE(SUM(COALESCE(
                        grid_import_kwh,
                        MAX(consumption_kwh - solar_generation_kwh, 0)
                    )), 0) AS total_grid_import_kwh,
                    COALESCE(SUM(cost_inr), 0) AS total_cost_inr,
                    COUNT(cost_inr) AS cost_reading_count,
                    COUNT(carbon_kg) AS recorded_carbon_count,
                    COALESCE(SUM(COALESCE(
                        carbon_kg,
                        COALESCE(
                            grid_import_kwh,
                            MAX(consumption_kwh - solar_generation_kwh, 0)
                        ) * ?
                    )), 0) AS co2_emissions_kg,
                    COALESCE(AVG(occupancy), 0)
                        AS average_occupancy
                FROM energy_readings
                WHERE building_id = ?
                """,
                (emission_factor, building_id.strip()),
            ).fetchone()

    reading_count = row["reading_count"]
    building_count = row["building_count"]

    consumption = float(row["total_consumption_kwh"])
    solar_generation = float(row["total_solar_generation_kwh"])
    grid_energy = float(row["total_grid_import_kwh"])
    average_occupancy = float(row["average_occupancy"])

    # Solar energy can offset consumption, but cannot offset
    # more than the total consumption in this simplified model.
    solar_used = min(solar_generation, consumption)

    # Solar contribution is capped at 100%.
    solar_percentage = (
        (solar_used / consumption) * 100
        if consumption > 0
        else 0.0
    )

    estimated_co2_kg = float(row["co2_emissions_kg"])
    carbon_count = row["recorded_carbon_count"]
    if reading_count and carbon_count == reading_count:
        emissions_method = "Recorded carbon values from imported readings"
    elif carbon_count:
        emissions_method = "Recorded carbon where supplied; estimated from available grid energy otherwise"
    else:
        emissions_method = "Estimated using configured grid emission factor"

    return {
        "building_id": building_id,
        "reading_count": reading_count,
        "building_count": building_count,
        "total_consumption_kwh": round(consumption, 2),
        "total_solar_generation_kwh": round(solar_generation, 2),
        "solar_energy_used_for_offset_kwh": round(solar_used, 2),
        "estimated_grid_energy_kwh": round(grid_energy, 2),
        "solar_contribution_percent": round(solar_percentage, 2),
        "average_occupancy": round(average_occupancy, 2),
        "total_recorded_cost_inr": (
            round(float(row["total_cost_inr"]), 2)
            if row["cost_reading_count"] == reading_count and reading_count
            else None
        ),
        "emission_factor_kg_co2_per_kwh": emission_factor,
        "estimated_co2_emissions_kg": round(estimated_co2_kg, 2),
        "emissions_method": emissions_method,
        "data_mode": "historical_readings_demo",
    }
