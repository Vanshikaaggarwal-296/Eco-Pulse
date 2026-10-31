"""Accuracy metrics for point forecasts and prediction intervals."""

import numpy as np


def forecast_metrics(actual, predicted) -> dict[str, float | None]:
    """Calculate MAE, RMSE, and MAPE (percentage) for matching values."""
    actual_values = np.asarray(actual, dtype=float).reshape(-1)
    predicted_values = np.asarray(predicted, dtype=float).reshape(-1)
    if actual_values.size != predicted_values.size:
        raise ValueError("actual and predicted must have the same number of values")
    if actual_values.size == 0:
        raise ValueError("at least one actual/predicted pair is required")

    valid = np.isfinite(actual_values) & np.isfinite(predicted_values)
    actual_values = actual_values[valid]
    predicted_values = predicted_values[valid]
    if actual_values.size == 0:
        raise ValueError("at least one finite actual/predicted pair is required")

    error = predicted_values - actual_values
    nonzero_actual = np.abs(actual_values) > 1e-12
    mape = (
        float(np.mean(np.abs(error[nonzero_actual] / actual_values[nonzero_actual])) * 100)
        if np.any(nonzero_actual)
        else None
    )
    return {
        "mae": float(np.mean(np.abs(error))),
        "rmse": float(np.sqrt(np.mean(error**2))),
        "mape": mape,
    }


def prediction_interval_metrics(
    actual,
    lower,
    upper,
    confidence_level: float = 0.90,
) -> dict[str, float]:
    """Measure interval coverage, width, and Winkler score.

    Coverage is the fraction of actual values inside their prediction intervals.
    Mean width rewards tighter ranges, while the Winkler score also penalizes
    misses according to the requested confidence level (lower is better).
    """
    actual_values = np.asarray(actual, dtype=float).reshape(-1)
    lower_values = np.asarray(lower, dtype=float).reshape(-1)
    upper_values = np.asarray(upper, dtype=float).reshape(-1)

    if not (actual_values.size == lower_values.size == upper_values.size):
        raise ValueError("actual, lower, and upper must have the same number of values")
    if actual_values.size == 0:
        raise ValueError("at least one actual value and interval is required")
    if not 0 < confidence_level < 1:
        raise ValueError("confidence_level must be between 0 and 1")

    valid = (
        np.isfinite(actual_values)
        & np.isfinite(lower_values)
        & np.isfinite(upper_values)
    )
    actual_values = actual_values[valid]
    lower_values = lower_values[valid]
    upper_values = upper_values[valid]
    if actual_values.size == 0:
        raise ValueError("at least one finite actual value and interval is required")
    if np.any(lower_values > upper_values):
        raise ValueError("each lower bound must be less than or equal to its upper bound")

    covered = (actual_values >= lower_values) & (actual_values <= upper_values)
    widths = upper_values - lower_values
    alpha = 1 - confidence_level
    interval_scores = widths.copy()
    below = actual_values < lower_values
    above = actual_values > upper_values
    interval_scores[below] += (2 / alpha) * (lower_values[below] - actual_values[below])
    interval_scores[above] += (2 / alpha) * (actual_values[above] - upper_values[above])

    return {
        "coverage": float(np.mean(covered)),
        "mean_width": float(np.mean(widths)),
        "interval_score": float(np.mean(interval_scores)),
    }
