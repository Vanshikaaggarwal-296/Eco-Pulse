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
- Data & Imports: CSV mapping, validation, preview and browser storage

## Current data status
Without an import, the interface uses **illustrative sample data**. After a CSV is applied,
Overview switches to recorded totals, a consumption chart and building totals calculated from those imported records. Forecasting, battery, digital-twin and other dashboard metrics remain sample demonstrations; optimization and outage screens call the backend using labelled demo inputs. Importing a file does not train an ML model or connect a backend.

## Backend integration status

The UI checks `GET /api/health`. The Energy Optimization screen calls
`POST /api/optimization/schedule`; the Outage Simulation screen calls
`POST /api/optimization/outage`. Both use labelled sample profiles and display
values returned by the FastAPI backend. They are advisory/simulation endpoints:
the browser never sends equipment control commands, and human review remains
required. Forecasts and most other dashboard values are still illustrative.

For local development, the Vite proxy forwards `/api` to
`http://127.0.0.1:8000`. Set `ECOPULSE_API_TARGET` in `.env` to use another
backend address. CSV imports remain validated and stored in this browser only;
they are not uploaded to the backend or database.
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
screen at 390 px phone width. `npm test` runs eight data-parsing and aggregation checks.

## Use your CSV now

1. Start the app with `npm install` and `npm run dev` inside the EcoPulse folder.
2. Click **Import CSV**, or open **Menu → Data & Imports**.
3. Download the template for an example, then choose your own comma-separated UTF-8 CSV.
4. Map your headers to the expected fields (common names are detected automatically).
5. Click **Validate & preview**, inspect the rows, then **Apply to Overview**.

Limits: 5 MB / 10,000 rows per import. Each import replaces the current dataset.
The original file is unchanged. Applied records are stored in this browser's localStorage,
not on a server; private browsing, clearing browser data or changing device/browser removes
or separates that copy. If browser storage is full, a visible notice reports session-only use.
Do not treat browser storage as your permanent database.

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

## For the real backend

Use this flow for a shared system:

`CSV upload in browser → POST /api/v1/imports → server validation → database → GET /api/v1/overview`

These endpoints are a proposed integration contract, not implemented by this frontend ZIP.
The server should enforce the same schema, reject duplicates, record upload provenance and
return validation errors and a dataset ID. Do not trust browser-only validation. Live meter/API
feeds can write the same database so the dashboard uses a single data source. Keep changing
records out of application source code. A working ML pipeline additionally requires suitable
historical data, training/evaluation, a saved model and an inference endpoint.

To run the UI locally you need Node.js and npm. A backend, database, trained model and hosting
are additional components for a shared online system with real AI results.

## Eco-Pulse repository integration

This directory is the frontend workspace of the Eco-Pulse repository. Start the
existing FastAPI backend from the repository root (see the root README), then
run this workspace in another terminal. The header checks `GET /api/health` through the Vite development proxy. Optimization and outage controls call the existing backend endpoints with labelled sample profiles. Copy `.env.example` to `.env` to change the backend target. Other dashboard screens and browser-only CSV handling retain the data-mode limits described above. No server CSV import is wired yet.
