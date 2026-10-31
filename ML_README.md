# Harjeet's AI/ML prototype

Status: local prototype, not yet pushed to GitHub. The GUI and FastAPI demo are now integrated; see RUN_PROJECT.md.

## Run on this computer

Open PowerShell in this Eco-Pulse folder and run:

```powershell
.\.venv\Scripts\python.exe -m forecasting_engine.demo
```

If you copied this project to another computer, first run:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-ml.txt
```

The demo generates these files inside `demo_output/`:

- `synthetic_history.csv`: raw, simulated input readings for 56 days and two buildings.
- `hourly_forecasts.csv`: next 24 hours of demand, occupancy and solar predictions.
- `daily_forecasts.csv`: daily energy and occupancy summaries; partial days are labelled.
- `evaluation.json`: chronological test results, MAE, RMSE, nonzero-only MAPE, interval coverage and weekly baseline.
- `anomaly_demo_readings.csv`: a separate day's readings with deliberately injected faults.
- `alerts.json`: detected unusual readings, including the injected demand spike and invalid battery charge.

Open CSV files in Excel or a text editor. All demo readings are synthetic. The output is not a measurement of real-world performance.

## Understand the columns

Each input row is one hour for one building. `timestamp` includes a timezone; `building_id` identifies the building. `demand_kw` and `solar_kw` are average power during that hour. `occupancy` is the number of people. Optional `battery_soc_pct` is battery state of charge in percent.

Forecast suffixes `p05`, `p50`, `p95` mean lower, central and upper estimates. The outer estimates target a nominal 90% interval; check measured coverage in `evaluation.json`. Coverage is not guaranteed. Daily totals aggregate central estimates only, because summing hourly quantiles does not produce calibrated daily quantiles.

## Files and responsibilities

- `forecasting_engine/data.py`: validate hourly history and generate demo data.
- `forecasting_engine/forecasting.py`: train separate models per building and signal; predict 1-48 hours ahead.
- `forecasting_engine/evaluation.py`: test on later data without training on the test period.
- `forecasting_engine/anomaly_detection.py`: compare new readings with historical seasonal patterns and check battery telemetry.
- `forecasting_engine/demo.py`: runnable end-to-end example.

Python runs the module; Pandas handles tables and timestamps; NumPy handles numerical calculations; scikit-learn trains quantile gradient boosting models. Git keeps your work on the `harjeet/ai-ml-forecasting` branch.

## Integration handoff

The backend teammate can load hourly history from their database into a Pandas DataFrame and call:

```python
from forecasting_engine import ForecastEngine
engine = ForecastEngine().fit(history)
forecast = engine.predict(history, horizon=24)
```

Training requires at least 28 continuous days per building. Prediction requires at least the last 168 continuous hours. Timestamps must include an explicit timezone. Features use local calendar patterns and the same hour of the previous week, so future target readings are never required. Train once, then reuse the engine with fresh history; schedule retraining separately.

The optimizer consumes demand/solar/occupancy forecasts and uncertainty estimates. Its owner must apply critical-load, comfort and battery constraints. This module does not switch equipment. The frontend teammate can plot p50 lines and shade p05-p95 bands after the backend serializes timestamps to ISO strings.

## Next development steps

1. Integration adapter and 19 API tests are now included; expand testing with real data.
2. Agree on building identifiers, timezone and meter units with the backend teammate.
3. Replace synthetic data with real hourly readings and repeat chronological evaluation.
4. Add forecast weather inputs for better solar and demand predictions; evaluate interval calibration.
5. Push the branch and review with the team before integration.

Current limitations: calendar/weekly-lag baseline features, no weather feed, no model persistence, demo API only. Battery jump thresholds are demo settings and need site-specific configuration. Target a working data integration before adding more model complexity.
