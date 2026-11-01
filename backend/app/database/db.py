import sqlite3
import os
from contextlib import contextmanager
from pathlib import Path

DATABASE_PATH = Path(os.environ.get("ECOPULSE_DB_PATH", Path(__file__).resolve().parents[2] / "ecopulse.db"))


@contextmanager
def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
