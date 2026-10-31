"""Shared forecasting helpers used by EcoPulse's first forecasting baseline."""

from __future__ import annotations

from collections.abc import Iterable

import numpy as np
import pandas as pd


def prepare_series(
    history: pd.DataFrame | Iterable[dict],
    timestamp_col: str,
    value_col: str,
    freq: str,
) -> pd.Series:
    """Validate, sort, and regularize a timestamp/value history."""
    data = pd.DataFrame(history).copy()
    missing = {timestamp_col, value_col} - set(data.columns)
    if missing:
        raise ValueError(f"history is missing required columns: {sorted(missing)}")

    # Preserve the dataset's timezone. Campuses should pass all timestamps in
    # one consistent timezone (either all local/naive or all timezone-aware).
    data[timestamp_col] = pd.to_datetime(data[timestamp_col], errors="coerce")
    data[value_col] = pd.to_numeric(data[value_col], errors="coerce")
    data = data.dropna(subset=[timestamp_col, value_col])
    if data.empty:
        raise ValueError("history must contain at least one valid timestamp and value")

    # Multiple meter readings in the same interval are combined into one average.
    series = data.groupby(timestamp_col)[value_col].mean().sort_index()
    series = series.asfreq(freq)
    # Fill gaps between known readings without inventing a new leading reading.
    series = series.interpolate(method="time").ffill()
    series.name = value_col
    return series.astype(float)


def choose_seasonal_period(series: pd.Series, freq: str) -> int:
    """Choose a small daily or weekly seasonal cycle when history supports it."""
    offset = pd.tseries.frequencies.to_offset(freq)
    hours_per_step = offset.nanos / 3_600_000_000_000

    if 0 < hours_per_step <= 1.5:
        if len(series) >= 2 * 168:
            return 168  # same hour and weekday last week
        if len(series) >= 2 * 24:
            return 24  # same hour yesterday
        return max(1, min(len(series), 24))

    if 20 <= hours_per_step <= 28:
        if len(series) >= 14:
            return 7  # same weekday last week
        return max(1, min(len(series), 7))

    # For other intervals, use a conservative one-step baseline.
    return 1


def seasonal_forecast(
    history: pd.DataFrame | Iterable[dict],
    horizon: int,
    timestamp_col: str,
    value_col: str,
    freq: str = "h",
    confidence_level: float = 0.90,
    non_negative: bool = True,
) -> pd.DataFrame:
    """Forecast by repeating the latest seasonal cycle with empirical ranges.

    The point forecast is intentionally a transparent baseline. Its prediction
    range comes from historical errors against the same seasonal cycle, so the
    range widens or narrows with the quality of the supplied history.
    """
    if horizon < 1:
        raise ValueError("horizon must be at least 1")
    if not 0 < confidence_level < 1:
        raise ValueError("confidence_level must be between 0 and 1")

    series = prepare_series(history, timestamp_col, value_col, freq)
    period = choose_seasonal_period(series, freq)
    values = series.to_numpy(dtype=float)
    offsets = np.arange(horizon) % period
    source_positions = len(values) - period + offsets
    predictions = values[source_positions]

    # Compare each historical value with the value from the previous matching
    # season. Those residuals provide an empirical prediction interval.
    if len(values) > period:
        residuals = pd.Series(values[period:] - values[:-period]).dropna()
    else:
        residuals = series.diff().dropna()

    tail = (1 - confidence_level) / 2
    if len(residuals) >= 5:
        low_error = float(residuals.quantile(tail))
        high_error = float(residuals.quantile(1 - tail))
    else:
        # A small-history fallback: use a conservative spread around the
        # recent level, while keeping the estimate usable from just a few rows.
        spread = max(float(series.median()) * 0.10, float(series.std(ddof=0)), 1.0)
        low_error, high_error = -spread, spread

    future_index = pd.date_range(
        start=series.index[-1] + pd.tseries.frequencies.to_offset(freq),
        periods=horizon,
        freq=freq,
    )
    lower = np.minimum(predictions, predictions + low_error)
    upper = np.maximum(predictions, predictions + high_error)
    if non_negative:
        predictions = np.maximum(predictions, 0)
        lower = np.maximum(lower, 0)
        upper = np.maximum(upper, lower)

    return pd.DataFrame(
        {
            "timestamp": future_index,
            "forecast": predictions,
            "lower": lower,
            "upper": upper,
            "model": "seasonal_naive_baseline",
            "confidence_level": confidence_level,
        }
    )
