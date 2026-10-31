"""Chronological holdout with daily origins and a same-hour-last-week baseline."""

import numpy as np
import pandas as pd

from .data import TARGETS, validate_history
from .forecasting import ForecastEngine, MIN_HOURS


def metrics(actual, point, lower=None, upper=None):
    actual, point = np.asarray(actual), np.asarray(point)
    errors = actual - point
    nonzero = actual > 1e-6
    result = {"mae": float(np.abs(errors).mean()),
              "rmse": float(np.sqrt(np.square(errors).mean())),
              "mape_nonzero_pct": float((np.abs(errors[nonzero]) / actual[nonzero]).mean() * 100) if nonzero.any() else None,
              "mape_excluded_zero_count": int((~nonzero).sum())}
    if lower is not None:
        result["interval_coverage_pct"] = float(((actual >= lower) & (actual <= upper)).mean() * 100)
        result["mean_interval_width"] = float(np.mean(np.asarray(upper) - lower))
    return result


def evaluate(history, test_days=7, timezone="Asia/Kolkata"):
    if isinstance(test_days, bool) or not isinstance(test_days, int) or test_days < 1:
        raise ValueError("test_days must be a positive integer")
    data = validate_history(history, MIN_HOURS + test_days * 24)
    if data.groupby("building_id").timestamp.max().nunique() != 1:
        raise ValueError("Evaluation requires the same ending timestamp for each building")
    cutoff = data.timestamp.max() - pd.Timedelta(days=test_days)
    engine = ForecastEngine(timezone).fit(data[data.timestamp <= cutoff])
    collected = []
    for day in range(test_days):
        origin = cutoff + pd.Timedelta(days=day)
        forecast = engine.predict(data[data.timestamp <= origin], 24)
        joined = forecast.merge(data, on=["building_id", "timestamp"], validate="one_to_one")
        baseline = data[["building_id", "timestamp", *TARGETS]].copy()
        baseline.timestamp += pd.Timedelta(days=7)
        baseline = baseline.rename(columns={t: f"{t}_baseline" for t in TARGETS})
        collected.append(joined.merge(baseline, on=["building_id", "timestamp"], validate="one_to_one"))
    test = pd.concat(collected, ignore_index=True)
    scores = {}
    for building, group in test.groupby("building_id"):
        scores[building] = {
            target: {"model": metrics(group[target], group[f"{target}_p50"],
                                       group[f"{target}_p05"], group[f"{target}_p95"]),
                     "weekly_baseline": metrics(group[target], group[f"{target}_baseline"])}
            for target in TARGETS
        }
    return {"method": "chronological holdout, 24-hour rolling origins, fixed trained model",
            "training_end": cutoff.isoformat(), "test_days": test_days,
            "nominal_interval_coverage_pct": 90, "scores": scores}
