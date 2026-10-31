# EcoPulse optimization engine

This is Vanshika's Member 2 Energy Optimization & Control module. It produces
recommendations for battery dispatch and flexible-load scheduling over a forecast
horizon. Normal grid-connected schedules never curtail critical load, HVAC stays
at or above the supplied comfort-safe minimum, and battery SOC stays at or above its
protected reserve. During outage simulation only, the battery can use reserve
energy down to `min_soc_kwh`; any critical-load shortfall is reported.

## Install

The first version uses only the Python standard library. It expects forecast
arrays from the forecasting module and does not run equipment automatically.

## Create an hourly recommendation

The load components are non-overlapping parts of total demand. If there is no
comfort model yet, omit `hvac_min_kwh`; the controller will keep HVAC at forecast
demand. Set `reserve_soc_kwh` to the energy the team wants to protect for backup.

```python
from optimization_engine import BatteryConfig, optimize_schedule

recommendation = optimize_schedule(
    demand_kwh=[42, 40, 55],
    solar_kwh=[0, 12, 8],
    price_per_kwh=[6.0, 4.0, 9.0],
    carbon_kg_per_kwh=[0.72, 0.35, 0.81],
    battery=BatteryConfig(
        capacity_kwh=80,
        initial_soc_kwh=45,
        min_soc_kwh=10,
        reserve_soc_kwh=25,
        max_charge_kw=20,
        max_discharge_kw=20,
    ),
    critical_load_kwh=[16, 16, 17],
    hvac_load_kwh=[12, 11, 15],
    hvac_min_kwh=[10, 9, 13],  # supplied by the comfort/occupancy model
    flexible_load_kwh=[5, 5, 7],
    carbon_weight=2.0,
)
```

`demand_kwh`, `solar_kwh`, `price_per_kwh`, and `carbon_kg_per_kwh` must have
the same length. Energy values are the energy **within each interval** in kWh;
price and carbon values are per kWh. `step_hours` is used to convert battery
power limits to interval energy and to report peak power in kW. Cost and carbon
are calculated by multiplying interval kWh by their per-kWh rates.

`carbon_weight` is the chosen value of one kg CO2e in the same currency units
as `price_per_kwh`. Flexible loads are separate from the critical-load slice
and are either served or curtailed in that interval; the prototype does not
move curtailed energy to a later interval. Give the optimizer only loads that
are safe to curtail, and set `flexible_shed_penalty_per_kwh` to reflect their
operational importance. HVAC can be reduced only as far as the supplied
comfort-safe energy minimum; this is a proxy supplied by the comfort or
occupancy logic, not a temperature simulation.

The controller uses a finite-horizon dynamic program over discrete battery
SOC levels. `soc_steps` controls the resolution. For receding-horizon MPC
behavior, call it again as updated forecasts arrive and use only the next
interval's recommendation. It assumes the grid can supply remaining loads in
normal operation; outage critical-load shortfalls are reported separately by
`simulate_islanding`.

The result includes a schedule, estimated cost/carbon reductions, estimated
peak demand in kW (and interval energy for compatibility), comfort and
critical-load violation counts, and `requires_human_approval: true`. Cost
metrics estimate the electricity bill and exclude battery degradation; the
optimizer can include degradation in its decision objective when configured.
All savings values are simulations, not guaranteed savings.

## Safe fallback and outage demo

```python
from optimization_engine import BatteryConfig, safe_fallback_schedule, simulate_islanding

fallback = safe_fallback_schedule(demand_kwh=[40, 42])
outage = simulate_islanding(
    critical_load_kwh=[8, 8, 8, 8],
    renewable_kwh=[0, 2, 0, 0],
    battery=BatteryConfig(
        capacity_kwh=30,
        initial_soc_kwh=24,
        min_soc_kwh=4,
        max_discharge_kw=10,
    ),
)
```

The fallback keeps all forecast demand, makes no battery or load changes, and
uses available solar before estimating grid import. The outage function is a
simulation only; it reports backup duration and critical-load shortfalls without
switching a real grid connection.

## Run checks

From the repository root:

```powershell
python -m unittest discover -s tests -v
```

The optimization engine accepts aligned forecast arrays; the forecasting and
backend teammates can map their forecast records into this input contract. The
backend can expose the returned dictionary as JSON using FastAPI; the frontend
can render the schedule and metrics.

## See a complete sample output

From the repository root, run:

```powershell
python -m optimization_engine.demo
```

It prints a JSON recommendation and a separate outage simulation. A backend
FastAPI route can return the same recommendation dictionary after mapping its
request fields to the aligned arrays above.
