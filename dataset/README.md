# Demo dataset

`sample_energy_timeseries.csv` is synthetic data generated for the EcoPulse forecasting demo. It contains 15 days of hourly timestamps, demand, occupancy, and solar-generation values. It does not contain measurements from a real campus or hospital. The final holdout day includes a small one-off occupancy event, and the second week has modest demand and attendance changes so the example shows that forecast errors can occur.

From the repository root, regenerate it and score the final 24 hours as a holdout:

```powershell
python examples/generate_sample_data.py
python examples/evaluate_sample.py
```

Use real or team-approved representative data before reporting model accuracy as a campus result.
