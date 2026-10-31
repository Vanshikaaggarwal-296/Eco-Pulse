"""Print a small, repeatable EcoPulse optimization and outage demo."""

from __future__ import annotations

import json

from . import BatteryConfig, optimize_schedule, simulate_islanding


def main() -> None:
    battery = BatteryConfig(
        capacity_kwh=12,
        initial_soc_kwh=6,
        min_soc_kwh=2,
        reserve_soc_kwh=3,
        max_charge_kw=4,
        max_discharge_kw=4,
        charge_efficiency=0.92,
        discharge_efficiency=0.94,
        degradation_cost_per_kwh=0.02,
    )
    recommendation = optimize_schedule(
        demand_kwh=[2.0, 3.0, 4.5, 3.5],
        solar_kwh=[0.0, 2.0, 1.0, 0.0],
        price_per_kwh=[4.0, 2.0, 3.0, 9.0],
        carbon_kg_per_kwh=[0.65, 0.35, 0.4, 0.8],
        battery=battery,
        critical_load_kwh=[1.0, 1.0, 1.5, 1.5],
        hvac_load_kwh=[0.5, 0.6, 0.8, 0.7],
        hvac_min_kwh=[0.4, 0.5, 0.6, 0.6],
        flexible_load_kwh=[0.0, 0.5, 0.5, 0.5],
        carbon_weight=2.0,
        flexible_shed_penalty_per_kwh=20.0,
        hvac_reduction_penalty_per_kwh=20.0,
        max_grid_import_kw=3.0,
        soc_steps=12,
    )
    outage = simulate_islanding(
        critical_load_kwh=[2.0, 2.0, 2.0, 2.0],
        renewable_kwh=[0.0, 0.5, 0.0, 0.0],
        battery=battery,
    )

    print(
        json.dumps(
            {"recommendation": recommendation, "outage_simulation": outage},
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
