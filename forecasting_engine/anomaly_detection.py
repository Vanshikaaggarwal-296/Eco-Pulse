"""Robust detection of unusual meter, solar, or battery readings."""

from collections.abc import Iterable

import numpy as np
import pandas as pd

from .common import prepare_series


def detect_anomalies(
    history: pd.DataFrame | Iterable[dict],
    timestamp_col: str = "timestamp",
    value_col: str = "value",
    freq: str = "h",
    window: int = 24,
    threshold: float = 3.5,
) -> pd.DataFrame:
    """Flag readings far from the recent rolling median using robust z-scores."""
    if window < 3:
        raise ValueError("window must be at least 3")
    if threshold <= 0:
        raise ValueError("threshold must be positive")

    series = prepare_series(history, timestamp_col, value_col, freq)
    minimum = min(window, max(3, window // 3))
    baseline = series.shift(1).rolling(window=window, min_periods=minimum).median()
    residual = series - baseline
    prior_residual = residual.shift(1)
    rolling_mad = prior_residual.abs().rolling(window=window, min_periods=minimum).median()
    scale = 1.4826 * rolling_mad

    # A tiny nonzero floor lets a clear jump stand out in otherwise steady data.
    floor = np.maximum(np.abs(baseline.to_numpy(dtype=float)) * 0.01, 1e-6)
    scale_values = np.maximum(scale.to_numpy(dtype=float), floor)
    robust_z = residual.to_numpy(dtype=float) / scale_values
    ready = baseline.notna().to_numpy()
    flags = ready & (np.abs(robust_z) >= threshold)

    direction = np.where(residual.to_numpy(dtype=float) >= 0, "spike", "drop")
    return pd.DataFrame(
        {
            "timestamp": series.index,
            "value": series.to_numpy(dtype=float),
            "baseline": baseline.to_numpy(dtype=float),
            "deviation": residual.to_numpy(dtype=float),
            "robust_z": np.where(ready, robust_z, np.nan),
            "direction": direction,
            "is_anomaly": flags,
        }
    )
