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
- Data & Imports: CSV mapping, validation, preview, backend batch import and browser storage

## Current data status
Without an import, most dashboard pages use **illustrative sample data**. After a CSV is applied,
Overview switches to recorded totals, a consumption chart and building totals calculated from those imported records. Applying a CSV sends normalized energy readings to the backend energy API/database and keeps the complete imported dataset in this browser for Overview. AI Forecasting separately uploads hourly forecasting data to its backend endpoint. Battery, digital-twin and other dashboard metrics remain sample demonstrations; optimization and outage screens call the backend using labelled demo inputs.

## Backend integration status

The UI checks `GET /api/health`. The Energy Optimization screen calls
`POST /api/optimization/schedule`; the Outage Simulation screen calls
`POST /api/optimization/outage`. Both use labelled sample profiles and display
values returned by the FastAPI backend. They are advisory/simulation endpoints:
the browser never sends equipment control commands, and human review remains
required. The AI Forecasting screen calls `POST /api/forecasting/analyze` with a
dedicated CSV upload and displays backend forecast quantiles, chronological
holdout scores and explainable anomaly flags. The upload is sent only after the
user presses **Run backend forecast**. Forecasts and most other dashboard values
remain illustrative until real site history is supplied.

For local development, the Vite proxy forwards `/api` to
`http://127.0.0.1:8000`. Set `ECOPULSE_API_TARGET` in `.env` to use another
backend address. Data & Imports posts readings to `POST /api/energy/readings/batch`.
The API stores timestamp, building, consumption, solar used (as the simplified
backend's solar-generation field), and optional occupancy. Cost, grid-import and
carbon values remain in the browser dataset because the energy-readings table does
not store them. Duplicate timestamp/building readings are rejected; imports append
to the backend and do not replace or delete existing server records.

### Run AI Forecasting

Open **Menu → AI Forecasting**, then either click **Load synthetic demo data** or
choose a CSV file. Select a building, forecast horizon and timezone, then click
**Run backend forecast**. The CSV needs `timestamp`, `building_id`, `demand_kw`,
`occupancy` and `solar_kw` columns, timezone-aware timestamps, and at least 35 days
of continuous hourly data per building. `frontend/public/ai_ml_sample.csv` is
artificial demo data only, not campus telemetry. The API response is advisory and
does not control equipment. Invalid or insufficient history is reported from the
backend in the screen.
## Suggested team workflow
Create a feature branch for frontend work, commit changes regularly, and merge through pull requests. Coordinate API field names with the backend and forecasting members before integration.

## Visual direction — Apple Red / Porcelain

The frontend uses apple red (`#c9283e`), off-white (`#f8f5f0`), porcelain panels
and warm ink. Chart colors and legends follow the same palette; success,
warning and severity indicators retain distinct semantic colors.

## Motion

- Continuous background: drifting red/rose gradients, moving dot grid and slow orbit lines.
- All 12 navigation screens: 150 ms zoom-out/fade, then 440 ms zoom-in/fade.
- Forecast type, chart range, load filters, anomaly filters, twin scenarios and report period use the same transition controller.
- Fast repeated clicks cancel the previous pending swap and open the latest selection.
- A compact two-line menu icon in the header replaces the always-visible tab row.
- Reference-inspired split panel menu: the red brand panel slides down while the off-white navigation panel slides up; closing reverses both movements. The thin menu lines morph into an X.
- All 12 destinations are organized in three expandable groups with animated plus/minus controls. Search filters the destination labels and expands matching groups. Hover uses restrained red text, sliding labels and an underline reveal.
- Selecting a destination closes the menu and opens its screen; the current destination is red.
- Native modal focus containment, Escape-to-close, focus restoration and background scroll locking are included.
- On phones the menu has its own scroll area and a persistent close header.
- Tabs, cards, panels and information rows grow on hover on devices with a mouse.
- IntersectionObserver reveals text and rows from above as they enter the viewport, with short top-to-bottom staggering.
- Offscreen content stays unrevealed until reached; each item reveals once per screen visit.
- Newly inserted filter/chart content is registered automatically; reduced-motion changes are handled live.
- System reduced-motion settings disable decorative movement and make view changes immediate.
- Background layers are decorative, ignore pointer events and stay behind dashboard content.

The page motion controller (`useAnimatedValue`) is in `src/App.jsx`. Menu and scroll-reveal controllers are in `src/Motion.jsx`. Palette tokens,
background effects and keyframes are in `src/styles.css`. No animation dependency is required.

## Validation

Run `npm run build` to generate the production bundle in `dist/`.
The Vite configuration also accepts the managed preview hostname `terminal.local`.

Browser checks include all 12 menu destinations, expandable groups, search results/empty state, Escape closing, CSV mapping/preview/apply,
actual imported Overview totals, reload persistence, removing browser data, and the import
screen at 390 px phone width. `npm test` runs ten data-parsing and API mapping checks.

## Use your CSV now

1. Start the app with `npm install` and `npm run dev` inside the EcoPulse folder.
2. Click **Import CSV**, or open **Menu → Data & Imports**.
3. Download the template for an example, then choose your own comma-separated UTF-8 CSV.
4. Map your headers to the expected fields (common names are detected automatically).
5. Click **Validate & preview**, inspect the rows, then **Apply to Overview** to send
   normalized readings to the API and switch Overview to the imported browser dataset.

Limits: 5 MB / 10,000 rows per import. Each import replaces the active browser dataset,
while backend readings are appended. The original CSV is unchanged and is not sent as a
file. The normalized readings are stored in the backend database; the full row set used by
Overview is stored in this browser's localStorage. Clearing browser data removes that copy,
but does not delete backend readings. If storage is full, a visible notice reports
session-only browser use. A duplicate server timestamp/building pair is rejected.

| Field | Required | Meaning |
| --- | --- | --- |
| timestamp | Yes | ISO 8601 date/time with timezone, e.g. 2026-10-31T08:00:00+05:30 |
| building | Yes | Building/asset name; one record per timestamp and building |
| consumption_kwh | Yes | Energy consumed in that interval, not instantaneous kW or cumulative meter counters |
| solar_used_kwh | No | Solar energy actually used in that interval; not total PV generation/export |
| grid_import_kwh | No | Grid energy consumed in that interval |
| cost_inr | No | Recorded cost in INR for the interval |
| carbon_kg | No | Recorded grid emissions in kg CO2e for the interval |

Use non-negative decimal numbers without currency signs or thousands separators. Solar used
plus grid import cannot exceed consumption. Missing/incomplete optional columns display as
unavailable rather than misleading partial totals. Duplicate timestamp/building pairs, invalid
dates and malformed numeric values block applying the file. Ensure intervals do not overlap.
The sample template is illustrative: 4 records, 430 kWh consumed, INR 2,580 recorded cost.

## Backend import notes

The batch endpoint validates the normalized energy-reading schema server-side, rejects
duplicate timestamp/building pairs, and inserts the batch in a transaction. It does not
store the original CSV, cost, grid-import or carbon columns, or a dataset identifier.
Live meter/API feeds can write readings through the same energy API. Keep changing records
out of application source code. The forecasting API currently trains per request and does
not persist models; a production pipeline needs suitable historical data, model lifecycle,
monitoring and authenticated data access.

To run the UI locally you need Node.js and npm. A backend, suitable historical data,
persistent storage and hosting are additional components for a shared online system.

## Eco-Pulse repository integration

This directory is the frontend workspace of the Eco-Pulse repository. Start the
existing FastAPI backend from the repository root (see the root README), then
run this workspace in another terminal. The header checks `GET /api/health` through the Vite development proxy. Optimization, outage, and normalized CSV energy imports call the backend API. Copy `.env.example` to `.env` to change the backend target. Other dashboard screens retain the data-mode limits described above.
