from app.database.db import get_connection


def initialize_database():
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS energy_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                building_id TEXT NOT NULL,
                consumption_kwh REAL NOT NULL CHECK (consumption_kwh >= 0),
                solar_generation_kwh REAL NOT NULL
                    CHECK (solar_generation_kwh >= 0),
                occupancy INTEGER NOT NULL CHECK (occupancy >= 0),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )