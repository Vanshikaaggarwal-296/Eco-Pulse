# EcoPulse: connected GUI + AI/ML demo

Harjeet's midnight-blue React GUI is connected to the Python forecasting engine through FastAPI. This is a local synthetic-data demo, not a live meter connection or deployed control system.

## Open on this computer

Double-click `START_ECOPULSE.cmd`, or open http://127.0.0.1:8000 while the server is running. The launcher starts a hidden local server and opens your browser. Initial training normally takes several seconds. The server binds only to your computer.

For a visible terminal server (Ctrl+C stops it):

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Do not start a second copy while port 8000 is in use. The background server's process ID is in `work/server.pid`. To stop it in Task Manager, match that PID to the project's Python process.

## What to show your team

1. Overview: computed demand/solar totals, historical readings and future demand chart.
2. AI Forecasting: switch Demand / Occupancy / Solar; inspect p05, p50 and p95 estimates.
3. Change Campus A to Hospital A and switch between 24 and 48 hours.
4. Anomaly Detection: inspect detected events from a separate test day. Campus A contains intentionally injected demand and battery faults.
5. Reports: measured MAE/RMSE, interval coverage and same-hour-last-week baseline; download CSV/JSON files.

Refresh recomputes predictions from fixed synthetic history; it does not fetch live meter readings. Original demo exports cover both buildings and 24 hours. The on-screen horizon selector controls on-screen forecasts only.

## Integration scope

Connected screens: Overview, AI Forecasting, Anomaly Detection, Reports.

The provided energy optimization, battery, HVAC, smart loads, carbon, outage and digital twin screens remain illustrative UI previews. A prominent banner identifies them. Their sample controls are not connected to a backend controller. Cost/carbon savings and safety-constraint validation remain the optimization teammate's responsibility.

`frontend/src/Connected.jsx` contains the API-backed pages and request state. `backend/main.py` serves the API and built frontend together. `forecasting_engine/` holds the ML code. `tests/test_integration.py` checks API outputs, validation, exports, injected anomalies and solar day/night behavior.

## Reproduce on another computer

Install Python 3.11+ (tested here with 3.14), then in this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-ml.txt
.\.venv\Scripts\python.exe -m forecasting_engine.demo
.\.venv\Scripts\python.exe run_ecopulse.py
```

The delivery ZIP includes the built GUI, so Node is only required if editing the frontend. For frontend changes, install Node.js with npm, then:

```powershell
cd frontend
npm install
npm run build
cd ..
```

For this machine, where npm is not on PATH, the installed Vite can also be run directly:

```powershell
cd frontend
node node_modules/vite/bin/vite.js build --configLoader runner
cd ..
```

Reload the browser after rebuilding. For live frontend development use `npm run dev` alongside the Python server; Vite proxies `/api` to port 8000.

API documentation: http://127.0.0.1:8000/docs

- GET `/api/v1/health`
- GET `/api/v1/dashboard?building_id=campus_a&horizon=24`
- GET `/api/v1/download/history` (also hourly, daily, evaluation, alerts, anomaly-readings)

Run verification:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_integration.py -q
```

## Model limits

Forecasts use calendar features and previous-week readings. Solar models learn which local hours have generation in the training data and regress within those hours, avoiding a zero-only median caused by nighttime readings. This simple hourly activity mask is not a location-aware sunrise model and needs reevaluation across seasons. There is no weather feed yet. Prediction intervals are nominal 90% estimates; actual measured coverage is displayed. Evaluation uses 24-hour forecasts, not 48-hour validation. All results are based on synthetic data.

Nothing has been pushed to GitHub. Source is saved in the local `harjeet/ai-ml-forecasting` branch workspace; changes are uncommitted.
