"""Grid-outage simulation that prioritizes critical loads."""

from __future__ import annotations

from math import isfinite
from typing import Iterable

from .controller import BatteryConfig, _aligned_series, _series


def simulate_islanding(
    critical_load_kwh: Iterable[float],
    battery: BatteryConfig,
    renewable_kwh: Iterable[float] | None = None,
    *,
    step_hours: float = 1.0,
) -> dict:
    """Estimate how long the battery and renewables can supply critical loads.

    The simulation can consume the battery down to ``min_soc_kwh`` during an
    outage. It assumes critical load is attempted first and reports any shortfall;
    it never sends an automatic switching command to physical equipment.
    """
    if not isfinite(step_hours) or step_hours <= 0:
        raise ValueError("step_hours must be a positive finite number")
    critical = _series("critical_load_kwh", critical_load_kwh)
    renewable = _aligned_series("renewable_kwh", renewable_kwh, len(critical), 0.0)
    if any(value < 0 for value in critical + renewable):
        raise ValueError("critical load and renewable energy cannot be negative")

    soc = battery.initial_soc_kwh
    steps = []
    backup_duration = 0.0
    outage_ended = False
    for index, (critical_load, renewable_energy) in enumerate(zip(critical, renewable)):
        renewable_to_load = min(critical_load, renewable_energy)
        remaining_load = critical_load - renewable_to_load
        available_from_battery = min(
            battery.max_discharge_kw * step_hours,
            max(0.0, soc - battery.min_soc_kwh) * battery.discharge_efficiency,
        )
        battery_to_load = min(remaining_load, available_from_battery)
        stored_energy_used = battery_to_load / battery.discharge_efficiency
        soc = max(battery.min_soc_kwh, soc - stored_energy_used)
        served = renewable_to_load + battery_to_load
        shortfall = max(0.0, critical_load - served)
        if not outage_ended:
            if shortfall > 1e-9:
                fraction_of_step = served / critical_load if critical_load > 0 else 1.0
                backup_duration += fraction_of_step * step_hours
                outage_ended = True
            else:
                backup_duration += step_hours
        steps.append(
            {
                "step": index,
                "critical_load_kwh": critical_load,
                "critical_load_served_kwh": served,
                "critical_load_shortfall_kwh": shortfall,
                "renewable_used_kwh": renewable_to_load,
                "battery_discharge_kwh": battery_to_load,
                "battery_soc_kwh": soc,
            }
        )

    return {
        "mode": "islanding_simulation_only",
        "automatic_switching": False,
        "backup_duration_hours": backup_duration,
        "critical_load_violations": sum(
            step["critical_load_shortfall_kwh"] > 1e-9 for step in steps
        ),
        "battery_final_soc_kwh": soc,
        "steps": steps,
    }
