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

## Frontend

The React/Vite dashboard prototype and local run instructions are in [frontend/README.md](frontend/README.md). The UI uses sample data in most views; the optimization screens are not yet wired to the backend endpoints.

