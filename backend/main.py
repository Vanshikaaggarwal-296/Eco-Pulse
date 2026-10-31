"""Local demo API. Synthetic data only; no equipment control endpoints."""
from contextlib import asynccontextmanager
from pathlib import Path
import json
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from forecasting_engine import ForecastEngine
from forecasting_engine.forecasting import daily_summary
from forecasting_engine.demo import main as generate_demo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'demo_output'


def records(frame):
    return json.loads(frame.to_json(orient='records', date_format='iso'))


@asynccontextmanager
async def lifespan(app):
    expected = ['synthetic_history.csv', 'evaluation.json', 'alerts.json', 'anomaly_demo_readings.csv']
    if not all((DATA / name).exists() for name in expected):
        # The launcher sets the project directory, which is also the CLI demo output root.
        import os
        original = Path.cwd()
        try:
            os.chdir(ROOT)
            generate_demo()
        finally:
            os.chdir(original)
    app.state.history = pd.read_csv(DATA / 'synthetic_history.csv')
    app.state.history.timestamp = pd.to_datetime(app.state.history.timestamp, utc=True)
    app.state.engine = ForecastEngine().fit(app.state.history)
    app.state.evaluation = json.loads((DATA / 'evaluation.json').read_text(encoding='utf-8'))
    app.state.alerts = json.loads((DATA / 'alerts.json').read_text(encoding='utf-8'))
    yield


app = FastAPI(title='EcoPulse AI/ML Demo', version='0.1.0', lifespan=lifespan)


@app.get('/api/v1/health')
def health():
    return {'status': 'ready', 'source': 'synthetic', 'equipment_control': False}


@app.get('/api/v1/dashboard')
def dashboard(building_id: str = 'campus_a', horizon: int = Query(24, ge=1, le=48)):
    history = app.state.history
    buildings = sorted(history.building_id.unique().tolist())
    if building_id not in buildings:
        raise HTTPException(404, 'Unknown building')
    history = history[history.building_id == building_id].copy()
    forecast = app.state.engine.predict(history, horizon)
    recent = history.tail(24)
    return {
        'source': 'synthetic', 'timezone': 'Asia/Kolkata', 'building_id': building_id,
        'buildings': buildings, 'horizon_hours': horizon,
        'issued_at': history.timestamp.max().isoformat(),
        'forecast_start': forecast.timestamp.min().isoformat(),
        'model': 'Quantile gradient boosting · calendar + previous-week readings',
        'nominal_interval_pct': 90,
        'history': records(recent), 'forecast': records(forecast),
        'daily': daily_summary(forecast),
        'metrics': app.state.evaluation['scores'][building_id],
        'evaluation': {k: v for k, v in app.state.evaluation.items() if k != 'scores'},
        'alerts': [a for a in app.state.alerts if a['building_id'] == building_id],
        'summary': {
            'historical_demand_kwh': float(recent.demand_kw.sum()),
            'historical_solar_kwh': float(recent.solar_kw.sum()),
            'forecast_demand_kwh': float(forecast.demand_kw_p50.sum()),
            'forecast_solar_kwh': float(forecast.solar_kw_p50.sum()),
            'forecast_peak_kw': float(forecast.demand_kw_p50.max()),
            'latest_demand_kw': float(recent.demand_kw.iloc[-1]),
        },
    }


DOWNLOADS = {'history': 'synthetic_history.csv', 'hourly': 'hourly_forecasts.csv',
             'daily': 'daily_forecasts.csv', 'evaluation': 'evaluation.json',
             'alerts': 'alerts.json', 'anomaly-readings': 'anomaly_demo_readings.csv'}


@app.get('/api/v1/download/{name}')
def download(name: str):
    if name not in DOWNLOADS or not (DATA / DOWNLOADS[name]).is_file():
        raise HTTPException(404, 'Unknown demo export')
    path = DATA / DOWNLOADS[name]
    return FileResponse(path, filename=path.name)


# Serve the built React GUI and API together; no CORS configuration is needed.
if (ROOT / 'frontend/dist').is_dir():
    app.mount('/', StaticFiles(directory=ROOT / 'frontend/dist', html=True), name='frontend')
