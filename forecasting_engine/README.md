# EcoPulse forecasting engine

This is Vanshika's Member 1 AI/ML and forecasting module. It provides a simple, explainable seasonal baseline for electricity demand, occupancy, and solar generation, plus anomaly detection and forecast accuracy metrics.

## Install

Install Python 3.10 or newer, then from the repository root run:

```powershell
python -m pip install -r forecasting_engine/requirements.txt
```

## Forecast demand

Input data needs a timestamp column and a numeric measurement column. Defaults are `timestamp` and `demand_kwh`; values are assumed to be hourly kWh readings.

```python
import pandas as pd
from forecasting_engine import forecast_demand

history = pd.read_csv("dataset/demand.csv")
next_24_hours = forecast_demand(history, horizon=24)
print(next_24_hours)
```

Occupancy defaults to `occupancy_count`; renewable generation defaults to `solar_kwh`. Forecasts return `timestamp`, `forecast`, `lower`, `upper`, `model`, and `confidence_level`. The range is estimated from historical seasonal errors.

## Anomalies and accuracy

Use `detect_anomalies(data, value_col="demand_kwh")` to flag unusual readings. Use `forecast_metrics(actual, predicted)` to calculate MAE, RMSE, and MAPE. Pass the relevant meter column for solar or other measurements.

The returned DataFrames can be converted to JSON records with `result.to_dict(orient="records")` for the backend API.

## Baseline behavior

The model repeats the latest matching daily or weekly pattern. With short histories, it falls back to recent values and a conservative prediction range. Compare it with stronger models once representative campus data is available.
