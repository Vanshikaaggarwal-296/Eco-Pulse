"""Score the forecasting baseline on the final day of the demo dataset."""

from __future__ import annotations

from pathlib import Path
import sys

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from forecasting_engine import (
    forecast_demand,
    forecast_metrics,
    forecast_occupancy,
    forecast_renewable,
    prediction_interval_metrics,
)


DATASET = ROOT / "dataset" / "sample_energy_timeseries.csv"
HORIZON = 24


def main() -> None:
    data = pd.read_csv(DATASET, parse_dates=["timestamp"])
    if len(data) <= HORIZON:
        raise ValueError(f"sample data must contain more than {HORIZON} rows")

    split = len(data) - HORIZON
    history = data.iloc[:split]
    holdout = data.iloc[split:]
    cases = (
        ("Demand", forecast_demand, "demand_kwh"),
        ("Occupancy", forecast_occupancy, "occupancy_count"),
        ("Solar generation", forecast_renewable, "solar_kwh"),
    )

    print(f"24-hour holdout; {split} training rows; {len(holdout)} actual rows")
    print("Synthetic data only: these scores are not campus performance claims.\n")
    for label, forecaster, value_col in cases:
        prediction = forecaster(history, horizon=HORIZON, value_col=value_col)
        actual = holdout[value_col].to_numpy(dtype=float)
        scores = forecast_metrics(actual, prediction["forecast"])
        interval_scores = prediction_interval_metrics(
            actual,
            prediction["lower"],
            prediction["upper"],
            confidence_level=float(prediction["confidence_level"].iloc[0]),
        )
        mape = "undefined" if scores["mape"] is None else f"{scores['mape']:.2f}%"
        print(
            f"{label}: MAE={scores['mae']:.2f}, RMSE={scores['rmse']:.2f}, "
            f"MAPE={mape}, interval coverage={interval_scores['coverage']:.1%}, "
            f"mean interval width={interval_scores['mean_width']:.2f}, "
            f"interval score={interval_scores['interval_score']:.2f}"
        )


if __name__ == "__main__":
    main()
