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


class EnergyReadingBatch(BaseModel):
    readings: list[EnergyReadingCreate] = Field(min_length=1, max_length=10000)


# --------------------------------------------------
# Create an energy reading
# POST /api/energy/readings
# --------------------------------------------------

@router.post("/readings", status_code=201)
def create_reading(reading: EnergyReadingCreate):
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO energy_readings (
                timestamp,
                building_id,
                consumption_kwh,
                solar_generation_kwh,
                occupancy
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                reading.timestamp.isoformat(),
                reading.building_id.strip(),
                reading.consumption_kwh,
                reading.solar_generation_kwh,
                reading.occupancy,
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
                solar_generation_kwh, occupancy
            ) VALUES (?, ?, ?, ?, ?)
            """,
            [
                (
                    timestamp,
                    building_id,
                    reading.consumption_kwh,
                    reading.solar_generation_kwh,
                    reading.occupancy,
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
):
    with get_connection() as connection:
        if building_id is None:
            rows = connection.execute(
                """
                SELECT * FROM energy_readings
                ORDER BY timestamp DESC, id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT * FROM energy_readings
                WHERE building_id = ?
                ORDER BY timestamp DESC, id DESC
                LIMIT ?
                """,
                (building_id.strip(), limit),
            ).fetchall()

    return {
        "count": len(rows),
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
                    COALESCE(AVG(occupancy), 0)
                        AS average_occupancy
                FROM energy_readings
                """
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
                    COALESCE(AVG(occupancy), 0)
                        AS average_occupancy
                FROM energy_readings
                WHERE building_id = ?
                """,
                (building_id.strip(),),
            ).fetchone()

    reading_count = row["reading_count"]
    building_count = row["building_count"]

    consumption = float(row["total_consumption_kwh"])
    solar_generation = float(row["total_solar_generation_kwh"])
    average_occupancy = float(row["average_occupancy"])

    # Solar energy can offset consumption, but cannot offset
    # more than the total consumption in this simplified model.
    solar_used = min(solar_generation, consumption)

    # Estimated grid electricity needed after solar offset.
    grid_energy = max(consumption - solar_generation, 0.0)

    # Solar contribution is capped at 100%.
    solar_percentage = (
        (solar_used / consumption) * 100
        if consumption > 0
        else 0.0
    )

    # Illustrative estimate, not a live grid measurement.
    estimated_co2_kg = grid_energy * emission_factor

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
        "emission_factor_kg_co2_per_kwh": emission_factor,
        "estimated_co2_emissions_kg": round(estimated_co2_kg, 2),
        "emissions_method": "Estimated using configured grid emission factor",
        "data_mode": "historical_readings_demo",
    }
