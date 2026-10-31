"""Safe, recommendation-only energy scheduling for EcoPulse."""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from typing import Iterable


@dataclass(frozen=True)
class BatteryConfig:
    """Battery limits for scheduling; reserve SOC is kept for resilience."""

    capacity_kwh: float
    initial_soc_kwh: float
    min_soc_kwh: float = 0.0
    reserve_soc_kwh: float = 0.0
    max_charge_kw: float = 0.0
    max_discharge_kw: float = 0.0
    charge_efficiency: float = 0.95
    discharge_efficiency: float = 0.95
    degradation_cost_per_kwh: float = 0.0

    def __post_init__(self) -> None:
        numeric = (
            self.capacity_kwh,
            self.initial_soc_kwh,
            self.min_soc_kwh,
            self.reserve_soc_kwh,
            self.max_charge_kw,
            self.max_discharge_kw,
            self.charge_efficiency,
            self.discharge_efficiency,
            self.degradation_cost_per_kwh,
        )
        if not all(isfinite(value) for value in numeric):
            raise ValueError("battery settings must all be finite numbers")
        if self.capacity_kwh <= 0:
            raise ValueError("battery capacity_kwh must be positive")
        if not 0 <= self.min_soc_kwh <= self.capacity_kwh:
            raise ValueError("min_soc_kwh must be within battery capacity")
        if not 0 <= self.reserve_soc_kwh <= self.capacity_kwh:
            raise ValueError("reserve_soc_kwh must be within battery capacity")
        if self.initial_soc_kwh < max(self.min_soc_kwh, self.reserve_soc_kwh):
            raise ValueError("initial battery SOC must be at or above its protected minimum")
        if self.initial_soc_kwh > self.capacity_kwh:
            raise ValueError("initial_soc_kwh cannot exceed battery capacity")
        if self.max_charge_kw < 0 or self.max_discharge_kw < 0:
            raise ValueError("battery charge and discharge limits cannot be negative")
        if not 0 < self.charge_efficiency <= 1:
            raise ValueError("charge_efficiency must be in (0, 1]")
        if not 0 < self.discharge_efficiency <= 1:
            raise ValueError("discharge_efficiency must be in (0, 1]")
        if self.degradation_cost_per_kwh < 0:
            raise ValueError("degradation_cost_per_kwh cannot be negative")

    @property
    def protected_min_soc_kwh(self) -> float:
        """SOC floor used during normal operation to preserve backup reserve."""
        return max(self.min_soc_kwh, self.reserve_soc_kwh)


def _series(name: str, values: Iterable[float]) -> list[float]:
    try:
        result = [float(value) for value in values]
    except (TypeError, ValueError) as error:
        raise ValueError(f"{name} must be a sequence of numeric values") from error
    if not result:
        raise ValueError(f"{name} must contain at least one value")
    if not all(isfinite(value) for value in result):
        raise ValueError(f"{name} must contain only finite values")
    return result


def _aligned_series(
    name: str,
    values: Iterable[float] | None,
    horizon: int,
    default: float,
) -> list[float]:
    result = [default] * horizon if values is None else _series(name, values)
    if len(result) != horizon:
        raise ValueError(f"{name} must have the same number of values as demand_kwh")
    return result


def _validate_profiles(
    demand_kwh: Iterable[float],
    solar_kwh: Iterable[float],
    price_per_kwh: Iterable[float],
    carbon_kg_per_kwh: Iterable[float],
    critical_load_kwh: Iterable[float] | None,
    hvac_load_kwh: Iterable[float] | None,
    hvac_min_kwh: Iterable[float] | None,
    flexible_load_kwh: Iterable[float] | None,
) -> tuple[list[float], ...]:
    demand = _series("demand_kwh", demand_kwh)
    horizon = len(demand)
    solar = _aligned_series("solar_kwh", solar_kwh, horizon, 0.0)
    price = _aligned_series("price_per_kwh", price_per_kwh, horizon, 0.0)
    carbon = _aligned_series("carbon_kg_per_kwh", carbon_kg_per_kwh, horizon, 0.0)
    critical = _aligned_series("critical_load_kwh", critical_load_kwh, horizon, 0.0)
    hvac = _aligned_series("hvac_load_kwh", hvac_load_kwh, horizon, 0.0)
    hvac_min = _aligned_series(
        "hvac_min_kwh", hvac_min_kwh, horizon, 0.0 if hvac_load_kwh is None else float("nan")
    )
    if hvac_min_kwh is None:
        hvac_min = list(hvac)
    flexible = _aligned_series("flexible_load_kwh", flexible_load_kwh, horizon, 0.0)

    for name, values in (
        ("demand_kwh", demand),
        ("solar_kwh", solar),
        ("critical_load_kwh", critical),
        ("hvac_load_kwh", hvac),
        ("hvac_min_kwh", hvac_min),
        ("flexible_load_kwh", flexible),
    ):
        if any(value < 0 for value in values):
            raise ValueError(f"{name} cannot contain negative values")
    if any(value < 0 for value in carbon):
        raise ValueError("carbon_kg_per_kwh cannot contain negative values")
    if any(minimum > full for minimum, full in zip(hvac_min, hvac)):
        raise ValueError("hvac_min_kwh cannot exceed hvac_load_kwh")
    if any(
        critical_value + hvac_value + flexible_value > demand_value + 1e-9
        for demand_value, critical_value, hvac_value, flexible_value in zip(
            demand, critical, hvac, flexible
        )
    ):
        raise ValueError(
            "critical, HVAC, and flexible loads must be non-overlapping parts of demand"
        )
    return demand, solar, price, carbon, critical, hvac, hvac_min, flexible


def _soc_levels(battery: BatteryConfig | None, soc_steps: int) -> list[float]:
    if battery is None:
        return [0.0]
    low = battery.protected_min_soc_kwh
    high = battery.capacity_kwh
    if high == low:
        return [low]
    levels = [low + (high - low) * step / soc_steps for step in range(soc_steps + 1)]
    levels.append(battery.initial_soc_kwh)
    return sorted({round(value, 10) for value in levels})


def _step_options(
    step: int,
    demand: list[float],
    solar: list[float],
    price: list[float],
    carbon: list[float],
    critical: list[float],
    hvac: list[float],
    hvac_min: list[float],
    flexible: list[float],
    battery: BatteryConfig | None,
    soc: float,
    next_soc: float,
    carbon_weight: float,
    step_hours: float,
    max_grid_import_kw: float | None,
    flexible_shed_penalty_per_kwh: float,
    hvac_reduction_penalty_per_kwh: float,
) -> list[dict[str, float]]:
    soc_change = next_soc - soc
    charge_input = 0.0
    discharge_output = 0.0
    if battery is not None:
        if soc_change > 0:
            charge_input = soc_change / battery.charge_efficiency
        elif soc_change < 0:
            discharge_output = -soc_change * battery.discharge_efficiency

    fixed_load = max(0.0, demand[step] - critical[step] - hvac[step] - flexible[step])
    hvac_options = sorted({hvac[step], hvac_min[step]})
    flexible_shed_options = sorted({0.0, flexible[step]})
    options: list[dict[str, float]] = []

    for served_hvac in hvac_options:
        for shed_flexible in flexible_shed_options:
            served_flexible = flexible[step] - shed_flexible
            served_load = fixed_load + critical[step] + served_hvac + served_flexible
            grid_for_load = max(0.0, served_load - solar[step])
            solar_surplus = max(0.0, solar[step] - served_load)
            charge_from_solar = min(charge_input, solar_surplus)
            charge_from_grid = charge_input - charge_from_solar
            # Do not claim battery energy that the load cannot consume. Any
            # excess discharge would otherwise disappear from the energy
            # balance while still reducing the reported state of charge.
            if discharge_output > grid_for_load + 1e-9:
                continue
            battery_used = min(discharge_output, grid_for_load)
            grid_import = max(0.0, grid_for_load - battery_used + charge_from_grid)
            grid_import_kw = grid_import / step_hours
            if (
                max_grid_import_kw is not None
                and grid_import_kw > max_grid_import_kw + 1e-9
            ):
                continue
            weighted_energy_price = price[step] + carbon_weight * carbon[step]
            service_penalty = (
                shed_flexible * flexible_shed_penalty_per_kwh
                + (hvac[step] - served_hvac) * hvac_reduction_penalty_per_kwh
            )
            degradation = (
                abs(soc_change) * battery.degradation_cost_per_kwh
                if battery is not None
                else 0.0
            )
            objective = (
                grid_import * weighted_energy_price
                + service_penalty
                + degradation
            )
            renewable_used = min(served_load, solar[step]) + charge_from_solar
            options.append(
                {
                    "objective": objective,
                    "grid_import_kwh": grid_import,
                    "grid_import_kw": grid_import_kw,
                    "load_served_kwh": served_load,
                    "battery_soc_kwh": next_soc,
                    "battery_charge_from_grid_kwh": charge_from_grid,
                    "battery_charge_from_solar_kwh": charge_from_solar,
                    "battery_charge_kw": charge_input / step_hours,
                    "battery_discharge_kwh": battery_used,
                    "battery_discharge_kw": battery_used / step_hours,
                    "critical_load_kwh": critical[step],
                    "hvac_served_kwh": served_hvac,
                    "hvac_min_kwh": hvac_min[step],
                    "flexible_load_served_kwh": served_flexible,
                    "flexible_load_shed_kwh": shed_flexible,
                    "renewable_used_kwh": renewable_used,
                    "renewable_curtailed_kwh": max(0.0, solar[step] - renewable_used),
                }
            )
    return options


def _schedule_metrics(
    demand: list[float],
    solar: list[float],
    price: list[float],
    carbon: list[float],
    schedule: list[dict[str, float]],
    step_hours: float,
    max_grid_import_kw: float | None,
) -> dict[str, float | int | None]:
    baseline_import = [max(0.0, load - sun) for load, sun in zip(demand, solar)]
    optimized_import = [item["grid_import_kwh"] for item in schedule]
    baseline_cost = sum(value * rate for value, rate in zip(baseline_import, price))
    optimized_cost = sum(
        item["grid_import_kwh"] * rate
        for item, rate in zip(schedule, price)
    )
    baseline_carbon = sum(
        value * rate for value, rate in zip(baseline_import, carbon)
    )
    optimized_carbon = sum(
        item["grid_import_kwh"] * rate
        for item, rate in zip(schedule, carbon)
    )
    baseline_peak_kwh = max(baseline_import, default=0.0)
    optimized_peak_kwh = max(optimized_import, default=0.0)
    comfort_violations = sum(
        item["hvac_served_kwh"] + 1e-9 < item["hvac_min_kwh"] for item in schedule
    )
    grid_import_limit_violations = (
        sum(item["grid_import_kw"] > max_grid_import_kw + 1e-9 for item in schedule)
        if max_grid_import_kw is not None
        else 0
    )
    return {
        "baseline_cost": baseline_cost,
        "optimized_cost": optimized_cost,
        "estimated_cost_savings": baseline_cost - optimized_cost,
        "estimated_cost_savings_percent": (
            (baseline_cost - optimized_cost) / baseline_cost * 100
            if baseline_cost > 0
            else None
        ),
        "baseline_carbon_kg": baseline_carbon,
        "optimized_carbon_kg": optimized_carbon,
        "estimated_carbon_savings_kg": baseline_carbon - optimized_carbon,
        # Keep interval-energy fields for existing consumers, and expose true
        # power metrics for peak-demand reporting at any interval length.
        "baseline_peak_grid_kwh": baseline_peak_kwh,
        "optimized_peak_grid_kwh": optimized_peak_kwh,
        "estimated_peak_reduction_kwh": baseline_peak_kwh - optimized_peak_kwh,
        "baseline_peak_grid_kw": baseline_peak_kwh / step_hours,
        "optimized_peak_grid_kw": optimized_peak_kwh / step_hours,
        "estimated_peak_reduction_kw": (baseline_peak_kwh - optimized_peak_kwh)
        / step_hours,
        "comfort_violations": comfort_violations,
        "critical_load_violations": 0,
        "max_grid_import_kw": max_grid_import_kw,
        "grid_import_limit_violations": grid_import_limit_violations,
    }


def optimize_schedule(
    demand_kwh: Iterable[float],
    solar_kwh: Iterable[float],
    price_per_kwh: Iterable[float],
    carbon_kg_per_kwh: Iterable[float],
    battery: BatteryConfig | None = None,
    *,
    critical_load_kwh: Iterable[float] | None = None,
    hvac_load_kwh: Iterable[float] | None = None,
    hvac_min_kwh: Iterable[float] | None = None,
    flexible_load_kwh: Iterable[float] | None = None,
    carbon_weight: float = 0.0,
    flexible_shed_penalty_per_kwh: float = 1.0,
    hvac_reduction_penalty_per_kwh: float = 5.0,
    max_grid_import_kw: float | None = None,
    step_hours: float = 1.0,
    soc_steps: int = 20,
) -> dict:
    """Optimize a horizon schedule with a small dynamic-programming MPC.

    The optimizer evaluates each time step over the supplied forecast horizon.
    Critical loads are always served. HVAC may only move between its forecast
    demand and a caller-supplied comfort-safe minimum; with no minimum supplied,
    HVAC stays at its forecast demand. Flexible loads are either served or
    curtailed in the current interval using a service penalty; this prototype
    does not reschedule curtailed energy into a later interval.

    ``max_grid_import_kw``, when supplied, is a hard grid-import cap for each
    interval. If the protected loads cannot fit under it, a conservative
    no-action fallback is returned and the metrics report cap violations.

    The returned schedule is advice for a human or downstream controller. It
    never switches equipment automatically. ``carbon_weight`` expresses the
    team's chosen value of a kilogram of CO2e in the same units as energy price.
    """
    if not isfinite(step_hours) or step_hours <= 0:
        raise ValueError("step_hours must be a positive finite number")
    if not isfinite(carbon_weight) or carbon_weight < 0:
        raise ValueError("carbon_weight must be a non-negative finite number")
    if max_grid_import_kw is not None and (
        not isfinite(max_grid_import_kw) or max_grid_import_kw < 0
    ):
        raise ValueError("max_grid_import_kw must be a non-negative finite number")
    if (
        not isfinite(flexible_shed_penalty_per_kwh)
        or flexible_shed_penalty_per_kwh < 0
        or not isfinite(hvac_reduction_penalty_per_kwh)
        or hvac_reduction_penalty_per_kwh < 0
    ):
        raise ValueError("service penalties must be non-negative finite numbers")
    if isinstance(soc_steps, bool) or not isinstance(soc_steps, int) or soc_steps < 2:
        raise ValueError("soc_steps must be an integer of at least 2")

    profiles = _validate_profiles(
        demand_kwh,
        solar_kwh,
        price_per_kwh,
        carbon_kg_per_kwh,
        critical_load_kwh,
        hvac_load_kwh,
        hvac_min_kwh,
        flexible_load_kwh,
    )
    demand, solar, price, carbon, critical, hvac, hvac_min, flexible = profiles
    levels = _soc_levels(battery, soc_steps)
    initial_soc = battery.initial_soc_kwh if battery is not None else 0.0
    dp: dict[float, tuple[float, list[dict[str, float]]]] = {initial_soc: (0.0, [])}

    for step in range(len(demand)):
        next_dp: dict[float, tuple[float, list[dict[str, float]]]] = {}
        for soc, (prior_score, prior_path) in dp.items():
            for next_soc in levels:
                change = next_soc - soc
                if battery is not None:
                    if change > battery.max_charge_kw * step_hours * battery.charge_efficiency + 1e-9:
                        continue
                    if -change * battery.discharge_efficiency > battery.max_discharge_kw * step_hours + 1e-9:
                        continue
                elif abs(change) > 1e-9:
                    continue

                options = _step_options(
                    step,
                    demand,
                    solar,
                    price,
                    carbon,
                    critical,
                    hvac,
                    hvac_min,
                    flexible,
                    battery,
                    soc,
                    next_soc,
                    carbon_weight,
                    step_hours,
                    max_grid_import_kw,
                    flexible_shed_penalty_per_kwh,
                    hvac_reduction_penalty_per_kwh,
                )
                for option in options:
                    score = prior_score + option["objective"]
                    existing = next_dp.get(next_soc)
                    if existing is None or score < existing[0]:
                        action = {key: value for key, value in option.items() if key != "objective"}
                        action["step"] = float(step)
                        next_dp[next_soc] = (score, prior_path + [action])
        if not next_dp:
            # Preserve forecast demand and critical loads if no constrained
            # optimization state survives; metrics will expose any cap breach.
            fallback = safe_fallback_schedule(
                demand,
                solar,
                critical_load_kwh=critical,
                hvac_load_kwh=hvac,
                hvac_min_kwh=hvac_min,
                flexible_load_kwh=flexible,
                price_per_kwh=price,
                carbon_kg_per_kwh=carbon,
                max_grid_import_kw=max_grid_import_kw,
                step_hours=step_hours,
            )
            fallback["fallback_reason"] = (
                "No feasible schedule met all active constraints; returned a "
                "no-action safe fallback."
            )
            return fallback
        dp = next_dp

    _, schedule = min(dp.values(), key=lambda item: item[0])
    return {
        "mode": "optimized_recommendation",
        "requires_human_approval": True,
        "automatic_switching": False,
        "battery_final_soc_kwh": schedule[-1]["battery_soc_kwh"],
        "schedule": schedule,
        "metrics": _schedule_metrics(
            demand, solar, price, carbon, schedule, step_hours, max_grid_import_kw
        ),
    }


def safe_fallback_schedule(
    demand_kwh: Iterable[float],
    solar_kwh: Iterable[float] | None = None,
    *,
    critical_load_kwh: Iterable[float] | None = None,
    hvac_load_kwh: Iterable[float] | None = None,
    hvac_min_kwh: Iterable[float] | None = None,
    flexible_load_kwh: Iterable[float] | None = None,
    price_per_kwh: Iterable[float] | None = None,
    carbon_kg_per_kwh: Iterable[float] | None = None,
    max_grid_import_kw: float | None = None,
    step_hours: float = 1.0,
) -> dict:
    """Return a conservative no-dispatch schedule and report any grid-cap breach."""
    if not isfinite(step_hours) or step_hours <= 0:
        raise ValueError("step_hours must be a positive finite number")
    if max_grid_import_kw is not None and (
        not isfinite(max_grid_import_kw) or max_grid_import_kw < 0
    ):
        raise ValueError("max_grid_import_kw must be a non-negative finite number")
    demand = _series("demand_kwh", demand_kwh)
    horizon = len(demand)
    solar = _aligned_series("solar_kwh", solar_kwh, horizon, 0.0)
    price = _aligned_series("price_per_kwh", price_per_kwh, horizon, 0.0)
    carbon = _aligned_series("carbon_kg_per_kwh", carbon_kg_per_kwh, horizon, 0.0)
    critical = _aligned_series("critical_load_kwh", critical_load_kwh, horizon, 0.0)
    hvac = _aligned_series("hvac_load_kwh", hvac_load_kwh, horizon, 0.0)
    hvac_min = list(hvac) if hvac_min_kwh is None else _aligned_series(
        "hvac_min_kwh", hvac_min_kwh, horizon, 0.0
    )
    flexible = _aligned_series("flexible_load_kwh", flexible_load_kwh, horizon, 0.0)
    _validate_profiles(demand, solar, price, carbon, critical, hvac, hvac_min, flexible)

    schedule = []
    for step, (load, sun) in enumerate(zip(demand, solar)):
        renewable_to_load = min(load, sun)
        schedule.append(
            {
                "step": float(step),
                "grid_import_kwh": max(0.0, load - sun),
                "grid_import_kw": max(0.0, load - sun) / step_hours,
                "load_served_kwh": load,
                "battery_soc_kwh": 0.0,
                "battery_charge_from_grid_kwh": 0.0,
                "battery_charge_from_solar_kwh": 0.0,
                "battery_charge_kw": 0.0,
                "battery_discharge_kwh": 0.0,
                "battery_discharge_kw": 0.0,
                "critical_load_kwh": critical[step],
                "hvac_served_kwh": hvac[step],
                "hvac_min_kwh": hvac_min[step],
                "flexible_load_served_kwh": flexible[step],
                "flexible_load_shed_kwh": 0.0,
                "renewable_used_kwh": renewable_to_load,
                "renewable_curtailed_kwh": max(0.0, sun - renewable_to_load),
            }
        )
    return {
        "mode": "safe_fallback",
        "requires_human_approval": True,
        "automatic_switching": False,
        "battery_final_soc_kwh": 0.0,
        "schedule": schedule,
        "metrics": _schedule_metrics(
            demand, solar, price, carbon, schedule, step_hours, max_grid_import_kw
        ),
    }
