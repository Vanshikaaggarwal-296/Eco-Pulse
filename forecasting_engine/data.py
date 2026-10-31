"""Hourly data contract and reproducible, explicitly synthetic demo data."""

import numpy as np
import pandas as pd

TARGETS = {"demand_kw": "kW", "occupancy": "people", "solar_kw": "kW"}
REQUIRED = ["timestamp", "building_id", *TARGETS]


def validate_history(frame, min_hours=1):
    missing = set(REQUIRED) - set(frame.columns)
    if missing:
        raise ValueError(f"Missing columns: {sorted(missing)}")
    data = frame.copy()
    if data.empty or data[REQUIRED].isna().any().any():
        raise ValueError("History must be nonempty and contain no missing required values")
    if not data.building_id.map(lambda x: isinstance(x, str) and bool(x.strip())).all():
        raise ValueError("building_id must be a nonempty string")
    # Require an explicit timezone; silently guessing UTC changes occupancy patterns.
    stamps = data.timestamp.map(pd.Timestamp)
    if any(t.tzinfo is None for t in stamps):
        raise ValueError("Timestamps must include a timezone, for example +05:30")
    data["timestamp"] = pd.to_datetime(data.timestamp, utc=True)
    if data.timestamp.isna().any():
        raise ValueError("Invalid timestamp")
    for col in TARGETS:
        data[col] = pd.to_numeric(data[col], errors="raise")
        if not np.isfinite(data[col]).all() or (data[col] < 0).any():
            raise ValueError(f"{col} must contain finite nonnegative numbers")
    if data.duplicated(["building_id", "timestamp"]).any():
        raise ValueError("Duplicate building/timestamp")
    data = data.sort_values(["building_id", "timestamp"]).reset_index(drop=True)
    for name, group in data.groupby("building_id"):
        if len(group) < min_hours:
            raise ValueError(f"{name}: need at least {min_hours} hourly readings")
        if not group.timestamp.diff().dropna().eq(pd.Timedelta(hours=1)).all():
            raise ValueError(f"{name}: history must be continuous hourly readings")
    return data


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
