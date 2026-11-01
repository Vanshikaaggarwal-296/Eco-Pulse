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
                occupancy INTEGER CHECK (occupancy >= 0),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        occupancy = next(
            column
            for column in connection.execute("PRAGMA table_info(energy_readings)")
            if column["name"] == "occupancy"
        )
        if occupancy["notnull"]:
            connection.execute(
                "ALTER TABLE energy_readings RENAME TO energy_readings_legacy"
            )
            connection.execute(
                """
                CREATE TABLE energy_readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    building_id TEXT NOT NULL,
                    consumption_kwh REAL NOT NULL CHECK (consumption_kwh >= 0),
                    solar_generation_kwh REAL NOT NULL
                        CHECK (solar_generation_kwh >= 0),
                    occupancy INTEGER CHECK (occupancy >= 0),
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                """
                INSERT INTO energy_readings (
                    id, timestamp, building_id, consumption_kwh,
                    solar_generation_kwh, occupancy, created_at
                )
                SELECT id, timestamp, building_id, consumption_kwh,
                       solar_generation_kwh, occupancy, created_at
                FROM energy_readings_legacy
                """
            )
            connection.execute("DROP TABLE energy_readings_legacy")
