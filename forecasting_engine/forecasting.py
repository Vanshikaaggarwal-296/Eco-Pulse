"""Per-building quantile forecasts with only information known at issue time."""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor

from .data import TARGETS, validate_history

LAG_HOURS = 168
MIN_HOURS = 28 * 24


def features(times, lag, timezone):
    local = pd.DatetimeIndex(times).tz_convert(timezone)
    return np.column_stack([
        np.sin(2 * np.pi * local.hour / 24), np.cos(2 * np.pi * local.hour / 24),
        local.day_of_week, (local.day_of_week >= 5).astype(int), np.asarray(lag),
    ])


class ForecastEngine:
    """5th/50th/95th quantiles; nominal 90% intervals, not safety guarantees."""

    def __init__(self, timezone="Asia/Kolkata"):
        self.timezone = timezone
        self.models = {}
        self.cutoffs = {}
        self.solar_hours = {}

    def fit(self, history):
        data = validate_history(history, MIN_HOURS)
        models, cutoffs, solar_hours = {}, {}, {}
        for building, group in data.groupby("building_id"):
            group = group.reset_index(drop=True)
            for target in TARGETS:
                x = features(group.timestamp.iloc[LAG_HOURS:],
                             group[target].iloc[:-LAG_HOURS], self.timezone)
                y = group[target].iloc[LAG_HOURS:]
                if target == "solar_kw":
                    # Separate structural night-time zeros from daylight regression.
                    # Learn active hours from TRAINING data only; no fixed sunrise assumption.
                    local_hours = group.timestamp.dt.tz_convert(self.timezone).dt.hour
                    active_hours = sorted(group.loc[group.solar_kw > 0, "timestamp"].dt.tz_convert(self.timezone).dt.hour.unique().tolist())
                    solar_hours[building] = active_hours
                    mask = local_hours.iloc[LAG_HOURS:].isin(active_hours).to_numpy()
                    if mask.any():
                        x, y = x[mask], y.iloc[np.flatnonzero(mask)]
                models[building, target] = [
                    GradientBoostingRegressor(loss="quantile", alpha=q,
                                              n_estimators=60, max_depth=2,
                                              min_samples_leaf=10, random_state=42).fit(x, y)
                    for q in (0.05, 0.5, 0.95)
                ]
            cutoffs[building] = group.timestamp.max()
        self.models, self.cutoffs, self.solar_hours = models, cutoffs, solar_hours
        return self

    def predict(self, history, horizon=24):
        if not self.models:
            raise ValueError("Fit the forecasting engine before prediction")
        if isinstance(horizon, bool) or not isinstance(horizon, int) or not 1 <= horizon <= 48:
            raise ValueError("horizon must be an integer from 1 to 48 hours")
        data = validate_history(history, LAG_HOURS)
        results = []
        for building, group in data.groupby("building_id"):
            if building not in self.cutoffs:
                raise ValueError(f"No trained model for building {building}")
            end = group.timestamp.max()
            if end < self.cutoffs[building]:
                raise ValueError("History ends before model training cutoff; evaluation would leak future data")
            future = pd.date_range(end + pd.Timedelta(hours=1), periods=horizon, freq="h")
            record = pd.DataFrame({"timestamp": future, "building_id": building})
            indexed = group.set_index("timestamp")
            for target in TARGETS:
                lag = indexed.loc[future - pd.Timedelta(hours=LAG_HOURS), target]
                x = features(future, lag, self.timezone)
                quantiles = np.column_stack([m.predict(x) for m in self.models[building, target]])
                # Quantile models can cross; rearrangement preserves valid ordered bounds.
                quantiles = np.sort(np.maximum(0, quantiles), axis=1)
                if target == "solar_kw":
                    active = np.isin(future.tz_convert(self.timezone).hour, self.solar_hours[building])
                    quantiles[~active] = 0
                for col, values in zip(("p05", "p50", "p95"), quantiles.T):
                    record[f"{target}_{col}"] = values
            results.append(record)
        return pd.concat(results, ignore_index=True)


def daily_summary(hourly, timezone="Asia/Kolkata"):
    """Point estimates only: summed marginal quantiles are NOT daily quantiles."""
    data = hourly.copy()
    data["date"] = data.timestamp.dt.tz_convert(timezone).dt.date.astype(str)
    rows = []
    for (building, date), group in data.groupby(["building_id", "date"]):
        rows.append({"building_id": building, "date": date, "hours_covered": len(group),
                     "partial_day": len(group) != 24,
                     "demand_kwh": float(group.demand_kw_p50.sum()),
                     "solar_kwh": float(group.solar_kw_p50.sum()),
                     "mean_occupancy": float(group.occupancy_p50.mean()),
                     "peak_occupancy": float(group.occupancy_p50.max())})
    return rows
