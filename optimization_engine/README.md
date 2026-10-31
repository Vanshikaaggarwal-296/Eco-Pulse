# EcoPulse optimization engine

This is Vanshika's Member 2 Energy Optimization & Control module. It produces
recommendations for battery dispatch and flexible-load scheduling over a forecast
horizon. Critical load is never curtailed, HVAC stays at or above the supplied
comfort-safe minimum, and battery SOC never drops below its protected reserve.

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
the same length. Energy values are per time step in kWh; price and carbon values
are per kWh. Set `step_hours` if the intervals are not one hour. `carbon_weight`
sets how strongly the objective values one kg of CO2e relative to the price
units. Flexible loads are either fully served or fully curtailed in each time
step, using a service penalty. The prototype does not model later recovery of
curtailed energy. Flexible loads are separate from the critical-load slice.

The result includes a schedule, estimated cost/carbon/peak reductions, comfort
and critical-load violation counts, and `requires_human_approval: true`. These
are model estimates, not guaranteed savings.

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

The demo assumes the forecasting and backend teams will pass aligned arrays or
forecast records. The backend can expose the returned dictionary as JSON using
FastAPI; the frontend can render the schedule and metrics.
