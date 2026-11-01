# EcoPulse demo data

These files are **synthetic examples generated for demonstrations**. They are not real campus measurements and must not be described as such.

## Files

- `synthetic_campus_energy_import.csv` — 48 hourly readings across two demo buildings. Its columns match the Data & Imports CSV mapper. Upload it there only when you want to demonstrate the import flow. Do not apply the same rows twice; duplicate timestamp/building pairs are rejected.
- `synthetic_forecasting_history_35d.csv` — 840 consecutive hourly rows for one demo building. It includes the required forecasting columns (`timestamp`, `building_id`, `demand_kw`, `occupancy`, and `solar_kw`) plus optional battery state. The backend requires at least 35 days of continuous hourly history for forecasting.

The forecasting file is **input history**, not a forecast result. In the AI Forecasting screen, upload it, choose `SYNTHETIC_DEMO_ACADEMIC_BLOCK`, and run the analysis. The API produces the forecast, evaluation metrics, anomaly alerts, and (when available) an advisory optimization recommendation.

To regenerate both examples with the same deterministic values, run:

```sh
node demo-data/generate_examples.mjs
```

The energy import example uses a separate synthetic date and building names from the public Kitakyushu dataset. Still, use a development/demo environment for repeated imports; the shared production database rejects duplicate readings.
