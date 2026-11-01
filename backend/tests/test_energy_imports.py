import sqlite3
from uuid import uuid4

from fastapi.testclient import TestClient

from app.database import db
from app.database.models import initialize_database
from app.main import app


client = TestClient(app)


def test_batch_import_stores_optional_occupancy(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DATABASE_PATH", tmp_path / "batch.db")
    initialize_database()
    building = f"csv-import-{uuid4()}"
    response = client.post(
        "/api/energy/readings/batch",
        json={
            "readings": [
                {
                    "timestamp": "2026-10-30T08:00:00+05:30",
                    "building_id": building,
                    "consumption_kwh": 12.5,
                    "solar_generation_kwh": 3,
                },
                {
                    "timestamp": "2026-10-30T09:00:00+05:30",
                    "building_id": building,
                    "consumption_kwh": 14,
                    "solar_generation_kwh": 2,
                    "occupancy": 28,
                },
            ]
        },
    )

    assert response.status_code == 201
    assert response.json()["created_count"] == 2
    readings = client.get(
        "/api/energy/readings", params={"building_id": building, "limit": 10}
    ).json()["readings"]
    assert len(readings) == 2
    assert {row["occupancy"] for row in readings} == {None, 28}


def test_batch_import_rejects_duplicate_instants_atomically(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DATABASE_PATH", tmp_path / "duplicates.db")
    initialize_database()
    building = f"csv-duplicate-{uuid4()}"
    row = {
        "timestamp": "2026-10-30T08:00:00+05:30",
        "building_id": building,
        "consumption_kwh": 12.5,
        "solar_generation_kwh": 3,
    }
    response = client.post(
        "/api/energy/readings/batch", json={"readings": [row, row]}
    )

    assert response.status_code == 422
    assert client.get(
        "/api/energy/readings", params={"building_id": building, "limit": 10}
    ).json()["count"] == 0


def test_database_migration_makes_occupancy_optional_without_losing_rows(
    tmp_path, monkeypatch
):
    database_path = tmp_path / "legacy.db"
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            CREATE TABLE energy_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                building_id TEXT NOT NULL,
                consumption_kwh REAL NOT NULL CHECK (consumption_kwh >= 0),
                solar_generation_kwh REAL NOT NULL CHECK (solar_generation_kwh >= 0),
                occupancy INTEGER NOT NULL CHECK (occupancy >= 0),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """INSERT INTO energy_readings
               (timestamp, building_id, consumption_kwh, solar_generation_kwh, occupancy)
               VALUES ('2026-10-30T08:00:00+00:00', 'legacy-building', 4, 1, 5)"""
        )

    monkeypatch.setattr(db, "DATABASE_PATH", database_path)
    initialize_database()

    with sqlite3.connect(database_path) as connection:
        columns = connection.execute("PRAGMA table_info(energy_readings)").fetchall()
        occupancy = next(column for column in columns if column[1] == "occupancy")
        row = connection.execute(
            "SELECT building_id, consumption_kwh, occupancy FROM energy_readings"
        ).fetchone()

    assert occupancy[3] == 0
    assert row == ("legacy-building", 4.0, 5)
