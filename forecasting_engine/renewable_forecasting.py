"""Renewable generation forecasting, initially for solar meter readings."""

from collections.abc import Iterable

import pandas as pd

from .common import seasonal_forecast


def forecast_renewable(
    history: pd.DataFrame | Iterable[dict],
    horizon: int = 24,
    timestamp_col: str = "timestamp",
    value_col: str = "solar_kwh",
    freq: str = "h",
    confidence_level: float = 0.90,
) -> pd.DataFrame:
    """Predict renewable output with non-negative uncertainty ranges."""
    return seasonal_forecast(
        history=history,
        horizon=horizon,
        timestamp_col=timestamp_col,
        value_col=value_col,
        freq=freq,
        confidence_level=confidence_level,
        non_negative=True,
    )
