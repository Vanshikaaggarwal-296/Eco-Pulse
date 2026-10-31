# Eco-Pulse

**AI-Powered Carbon-Aware Energy Optimization System**

Eco-Pulse is an AI-powered energy optimization platform for campuses and hospitals. It forecasts energy demand, optimizes electricity usage, and helps reduce energy costs and carbon emissions.

## Energy optimization API

The backend exposes Vanshika's recommendation-only optimization engine through
`POST /api/optimization/schedule` and `POST /api/optimization/outage`. The
schedule endpoint accepts aligned demand, solar, price, and carbon forecast
arrays, plus optional battery and protected-load settings. It returns the
schedule and estimated savings; it never switches physical equipment. The
outage endpoint reports simulated backup duration and any critical-load
shortfall.

Run the API from the repository root with:

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn app.main:app --app-dir backend --reload
```

Interactive request and response examples are available at `http://127.0.0.1:8000/docs`.

## Frontend workspace

The React + Vite dashboard lives in `frontend/`. It includes the red/off-white
split-panel menu, responsive navigation, charts, simulations and local CSV import.
The existing API and optimization implementation remain in their original folders.

| Folder | Responsibility |
| --- | --- |
| `frontend/` | Dashboard, navigation, browser CSV mapping and preview |
| `backend/` | FastAPI health, energy analytics and optimization HTTP routes |
| `optimization_engine/` | Recommendation and outage simulation logic |
| `tests/`, `backend/tests/` | Existing Python checks |
| `frontend/tests/` | CSV validation and aggregation checks |

Start the backend using the command above. In a **second terminal**, run:

```powershell
cd frontend
npm ci
npm run dev
```

Open the localhost URL Vite prints. Its `/api` development proxy forwards to
`http://127.0.0.1:8000`, including the existing `GET /api/health` route. The header
shows real connection status instead of assuming the API is online. To use another
backend port, copy `frontend/.env.example` to `frontend/.env`, edit
`ECOPULSE_API_TARGET`, and restart Vite.

### Data and integration status

The frontend health indicator checks the backend. Energy Optimization calls
`POST /api/optimization/schedule` with a labelled sample forecast and displays
the returned schedule and metrics. Outage Simulation calls
`POST /api/optimization/outage` and displays the simulated backup estimate and
shortfalls. Both endpoints are advisory/simulation only and never control
physical equipment. Forecasts, other dashboard metrics and CSV imports remain
sample or browser-local; no server CSV import or trained-model inference is
connected.

### Frontend validation and production

```powershell
cd frontend
npm test
npm run build
```

The generated `frontend/dist/` is ignored by Git. Host that build with a reverse
proxy forwarding `/api` to FastAPI, or set `VITE_API_BASE_URL` at build time to the
public backend origin and configure `CORS_ORIGINS` there. Vite's development proxy
does not run in a production static build. Do not commit `.env` files or credentials.
