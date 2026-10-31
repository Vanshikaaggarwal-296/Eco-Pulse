"""Explainable seasonal robust outlier checks plus battery telemetry rules."""

import numpy as np
import pandas as pd

from .data import TARGETS, validate_history


class AnomalyDetector:
    def __init__(self, timezone="Asia/Kolkata", threshold=6.0, max_soc_change_per_hour=30):
        self.timezone = timezone
        self.threshold = threshold
        self.max_soc_change = max_soc_change_per_hour
        self.profiles = {}
        self.cutoffs = {}

    def fit(self, history):
        data = validate_history(history, 28 * 24)
        profiles, cutoffs = {}, {}
        for building, group in data.groupby("building_id"):
            local = group.timestamp.dt.tz_convert(self.timezone)
            for (weekday, hour), subset in group.groupby([local.dt.dayofweek, local.dt.hour]):
                for target in TARGETS:
                    center = float(subset[target].median())
                    # Minimum scales stop constant/nighttime readings creating division by zero.
                    floor = 5.0 if target == "occupancy" else 2.0
                    scale = max(floor, float(np.median(np.abs(subset[target] - center))) * 1.4826)
                    profiles[building, weekday, hour, target] = (center, scale)
            cutoffs[building] = group.timestamp.max()
        self.profiles, self.cutoffs = profiles, cutoffs
        return self

    def detect(self, readings):
        if not self.profiles:
            raise ValueError("Fit anomaly detector on clean historical data first")
        data = validate_history(readings)
        alerts = []
        for building, group in data.groupby("building_id"):
            if building not in self.cutoffs:
                raise ValueError(f"No anomaly profile for {building}")
            if group.timestamp.min() <= self.cutoffs[building]:
                raise ValueError("Anomaly readings must be after the profile training period")
            previous = None
            for row in group.to_dict("records"):
                timestamp = row["timestamp"]
                local = timestamp.tz_convert(self.timezone)
                for target in TARGETS:
                    center, scale = self.profiles[building, local.dayofweek, local.hour, target]
                    score = abs(row[target] - center) / scale
                    if score > self.threshold:
                        alerts.append({"building_id": building, "timestamp": timestamp.isoformat(),
                                       "signal": target, "reason": "seasonal_outlier", "severity": "warning",
                                       "value": float(row[target]), "expected": center, "score": float(score)})
                soc = row.get("battery_soc_pct")
                if soc is not None:
                    soc = float(soc)
                    if not np.isfinite(soc):
                        raise ValueError("battery_soc_pct must be finite when provided")
                    reason = "battery_soc_out_of_range" if not 0 <= soc <= 100 else None
                    if reason is None and previous is not None and abs(soc - previous) > self.max_soc_change:
                        reason = "battery_soc_jump"
                    if reason:
                        alerts.append({"building_id": building, "timestamp": timestamp.isoformat(),
                                       "signal": "battery_soc_pct", "reason": reason,
                                       "severity": "warning", "value": soc})
                    previous = soc
                else:
                    previous = None
        return alerts
