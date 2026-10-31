"""Hourly data contract validation."""

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
