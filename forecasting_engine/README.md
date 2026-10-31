# EcoPulse forecasting engine

This folder is Vanshika's Member 1 AI/ML and forecasting module. It provides an explainable seasonal baseline for electricity demand, occupancy, and solar generation, plus anomaly detection and forecast accuracy metrics.

## Install

Install Python 3.10 or newer, then from the repository root install the dependencies:

```powershell
python -m pip install -r forecasting_engine/requirements.txt
```

## Try a demand forecast

Input data needs a timestamp column and one numeric measurement column. The defaults are `timestamp` and `demand_kwh`; values are assumed to be hourly kWh readings.

```python
import pandas as pd
from forecasting_engine import forecast_demand

# Replace this path with the team's meter CSV when it is available.
history = pd.read_csv("dataset/demand.csv")
next_24_hours = forecast_demand(history, horizon=24)
print(next_24_hours)
```

For daily data, set `freq="D"`, for example `forecast_demand(daily_history, horizon=7, freq="D")`. Occupancy defaults to `occupancy_count`; renewable generation defaults to `solar_kwh`. Forecasts return `timestamp`, `forecast`, `lower`, `upper`, `model`, and `confidence_level`. The lower and upper columns form an empirical prediction range, 90% confidence by default.

## Detect unusual readings and measure accuracy

```python
from forecasting_engine import detect_anomalies, forecast_metrics

alerts = detect_anomalies(history, value_col="demand_kwh")
unusual_readings = alerts[alerts["is_anomaly"]]
scores = forecast_metrics(actual_values, predicted_values)
print(unusual_readings)
print(scores)  # MAE and RMSE use the input units; MAPE is a percentage.
```

For solar or battery anomaly checks, pass that meter's column as `value_col`. FastAPI responses can serialize returned DataFrames with `result.to_dict(orient="records")`.

## Run the included checks

From the repository root, run:

```powershell
python -m unittest discover -s tests -v
```

## Try the synthetic holdout demo

From the repository root, generate the clearly labeled sample data and score the final 24 hours against the previous 14 days:

```powershell
python examples/generate_sample_data.py
python examples/evaluate_sample.py
```

The output includes MAE, RMSE, MAPE, and prediction-range coverage for demand, occupancy, and solar generation. These synthetic scores demonstrate the evaluation flow; they are not campus performance claims.

## Baseline behavior

The baseline repeats the latest matching daily or weekly pattern and estimates prediction ranges from historical seasonal errors. With short histories it falls back to a recent-value baseline and a conservative range. Once representative campus data is available, compare this baseline with stronger models using the included metrics.
