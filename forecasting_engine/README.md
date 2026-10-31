# EcoPulse forecasting engine

This folder is Member 1's first independent module. It contains a simple,
explainable seasonal baseline for electricity demand, building occupancy, and
solar generation, plus robust anomaly flags and forecast accuracy metrics.

## Install

Install Python 3.10 or newer, then from the repository root install the two
dependencies:

```powershell
python -m pip install -r forecasting_engine/requirements.txt
```

On Windows, `py -m pip install ...` also works when the Python launcher is
installed.

## Try a demand forecast

Input data is a table with a timestamp column and one numeric measurement
column. The defaults are `timestamp` and `demand_kwh`; values are assumed to be
hourly kWh readings.

```python
import pandas as pd
from forecasting_engine import forecast_demand

# Replace this path with the team's meter CSV when it is available.
history = pd.read_csv("dataset/demand.csv")
next_24_hours = forecast_demand(history, horizon=24)
print(next_24_hours)
```

The same function accepts daily data by setting `freq="D"`, for example
`forecast_demand(daily_history, horizon=7, freq="D")`. Occupancy defaults to
`occupancy_count`; renewable generation defaults to `solar_kwh`. Each forecast
returns `timestamp`, `forecast`, `lower`, `upper`, `model`, and
`confidence_level`. The lower and upper columns form an empirical prediction
range, currently at 90% confidence by default.

## Detect unusual readings and measure accuracy

```python
from forecasting_engine import detect_anomalies, forecast_metrics

alerts = detect_anomalies(history, value_col="demand_kwh")
unusual_readings = alerts[alerts["is_anomaly"]]
scores = forecast_metrics(actual_values, predicted_values)
print(unusual_readings)
print(scores)  # MAE and RMSE use the input units; MAPE is a percentage.
```

For solar or battery anomaly checks, pass that meter's column as `value_col`.
The backend can convert returned DataFrames to JSON records with
`result.to_dict(orient="records")` when exposing REST endpoints.

## What this baseline does

It repeats the latest matching daily or weekly pattern and estimates prediction
ranges from historical seasonal errors. With short histories it falls back to
a recent-value baseline and a conservative range. This is a transparent demo
baseline; after the team collects representative campus data, compare it with
stronger models using the included metrics before selecting a production model.
