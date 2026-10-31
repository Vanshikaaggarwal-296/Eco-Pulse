"""Accuracy metrics for comparing forecasts with actual readings."""

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
