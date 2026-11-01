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
                grid_import_kwh REAL CHECK (grid_import_kwh >= 0),
                cost_inr REAL CHECK (cost_inr >= 0),
                carbon_kg REAL CHECK (carbon_kg >= 0),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        columns = {
            column["name"]: column
            for column in connection.execute("PRAGMA table_info(energy_readings)")
        }
        required_columns = {"grid_import_kwh", "cost_inr", "carbon_kg"}
        if columns["occupancy"]["notnull"] or not required_columns.issubset(columns):
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
                    grid_import_kwh REAL CHECK (grid_import_kwh >= 0),
                    cost_inr REAL CHECK (cost_inr >= 0),
                    carbon_kg REAL CHECK (carbon_kg >= 0),
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            preserved_columns = (
                "id",
                "timestamp",
                "building_id",
                "consumption_kwh",
                "solar_generation_kwh",
                "occupancy",
                "grid_import_kwh",
                "cost_inr",
                "carbon_kg",
                "created_at",
            )
            select_values = [
                name if name in columns else "NULL AS " + name
                for name in preserved_columns
            ]
            connection.execute(
                "INSERT INTO energy_readings ("
                + ", ".join(preserved_columns)
                + ") SELECT "
                + ", ".join(select_values)
                + " FROM energy_readings_legacy"
            )
            connection.execute("DROP TABLE energy_readings_legacy")
