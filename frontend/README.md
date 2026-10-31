# EcoPulse Frontend

A responsive React + Vite prototype for the EcoPulse carbon-aware energy optimization project.

## Requirements
- Node.js 18.18+ (Node.js 20 LTS recommended)
- npm

## Run locally
```bash
cd EcoPulse
npm install
npm run dev
```
Open the local URL printed by Vite (usually http://localhost:5173).

## Production build
```bash
npm run build
npm run preview
```

## Included screens
- Overview dashboard
- AI demand, occupancy and solar forecasting
- MPC optimization recommendations and safety constraints
- Battery and storage management
- HVAC comfort management
- Smart load prioritization
- Carbon intelligence and cleaner-energy windows
- Digital Twin campus scenario comparison
- Grid outage / islanding simulation
- Anomaly detection
- Reports and success metrics

## Current data status
All displayed readings, forecasts, savings, model scores and alerts are **illustrative sample data**. They are for UI review and demonstration only, not operational control or validated performance claims.

## Backend integration plan
The frontend is currently self-contained so the team leader can review it without a backend. Later, replace sample values with FastAPI responses. Suggested API contracts:

- `GET /api/v1/overview`
- `GET /api/v1/forecasts?type=demand&horizon=24h`
- `GET /api/v1/optimization/recommendations`
- `POST /api/v1/optimization/simulate`
- `GET /api/v1/battery/status`
- `GET /api/v1/buildings`
- `POST /api/v1/simulation/outage`
- `GET /api/v1/anomalies`
- `GET /api/v1/reports/summary`

Keep critical-load protection, comfort bounds, battery SOC limits and human approval as backend-enforced constraints. The browser UI must never be the only safety layer.

## Suggested team workflow
Create a feature branch for frontend work, commit changes regularly, and merge through pull requests. Coordinate API field names with the backend and forecasting members before integration.

## Visual direction
The interface uses a restrained campus-energy visual language: deep forest navigation, a warm off-white workspace, subtle grid-inspired background texture, and muted renewable-energy greens. Motion is limited to small live-status feedback and hover states to keep the interface professional and presentation-ready.
