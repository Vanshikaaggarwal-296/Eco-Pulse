"""Building occupancy forecasting."""

from collections.abc import Iterable

import pandas as pd

from .common import seasonal_forecast


def forecast_occupancy(
    history: pd.DataFrame | Iterable[dict],
    horizon: int = 24,
    timestamp_col: str = "timestamp",
    value_col: str = "occupancy_count",
    freq: str = "h",
    confidence_level: float = 0.90,
) -> pd.DataFrame:
    """Estimate future people counts with non-negative prediction ranges."""
    result = seasonal_forecast(
        history=history,
        horizon=horizon,
        timestamp_col=timestamp_col,
        value_col=value_col,
        freq=freq,
        confidence_level=confidence_level,
        non_negative=True,
    )
    # Occupancy represents people, so expose whole-person estimates.
    for column in ("forecast", "lower", "upper"):
        result[column] = result[column].round().astype(int)
    return result
