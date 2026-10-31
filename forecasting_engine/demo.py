"""Run with: python -m forecasting_engine.demo"""
import json
from pathlib import Path

from .data import synthetic_history
from .forecasting import ForecastEngine, daily_summary
from .evaluation import evaluate
from .anomaly_detection import AnomalyDetector


def main():
    output = Path('demo_output')
    output.mkdir(exist_ok=True)
    history = synthetic_history(days=56)
    if not (output / 'synthetic_history.csv').exists() or (output / 'synthetic_history.csv').read_text() != history.to_csv(index=False).replace('\r\n', '\n'):
        history.to_csv(output / 'synthetic_history.csv', index=False)
    print('Generated 56 days of SYNTHETIC hourly data for two buildings.', flush=True)
    engine = ForecastEngine().fit(history)
    forecast = engine.predict(history, horizon=24)
    forecast.to_csv(output / 'hourly_forecasts.csv', index=False)
    import pandas as pd
    pd.DataFrame(daily_summary(forecast)).to_csv(output / 'daily_forecasts.csv', index=False)
    print('Created next-24-hour forecasts with p05/p50/p95 estimates.', flush=True)
    report = evaluate(history)
    report['data_source'] = 'synthetic demo; not measured campus or hospital performance'
    (output / 'evaluation.json').write_text(json.dumps(report, indent=2, allow_nan=False), encoding='utf-8')
    # Keep anomaly evaluation readings separate from the profile training period.
    cutoff = pd.to_datetime(history.timestamp, utc=True).max() - pd.Timedelta(days=1)
    mask = pd.to_datetime(history.timestamp, utc=True) <= cutoff
    detector = AnomalyDetector().fit(history[mask])
    readings = history[~mask].copy()
    index = readings.index[0]
    readings.loc[index, 'demand_kw'] = 1000
    readings.loc[index, 'battery_soc_pct'] = 120
    alerts = detector.detect(readings)
    readings.to_csv(output / 'anomaly_demo_readings.csv', index=False)
    (output / 'alerts.json').write_text(json.dumps(alerts, indent=2, allow_nan=False), encoding='utf-8')
    assert len(forecast) == 48
    for target in ('demand_kw', 'occupancy', 'solar_kw'):
        assert (forecast[f'{target}_p05'] >= 0).all()
        assert (forecast[f'{target}_p05'] <= forecast[f'{target}_p50']).all()
        assert (forecast[f'{target}_p50'] <= forecast[f'{target}_p95']).all()
    assert any(a['reason'] == 'battery_soc_out_of_range' for a in alerts)
    assert any(a['signal'] == 'demand_kw' for a in alerts)
    print('Demo checks passed. Files saved to:', output.resolve(), flush=True)
    print(forecast.head(3).to_string(index=False))


if __name__ == '__main__':
    main()
