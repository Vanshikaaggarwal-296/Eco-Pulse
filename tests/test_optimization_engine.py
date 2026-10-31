"""Safety and behavior checks for the optimization prototype."""

import unittest

from optimization_engine import (
    BatteryConfig,
    optimize_schedule,
    safe_fallback_schedule,
    simulate_islanding,
)


class OptimizationEngineTests(unittest.TestCase):
    def test_battery_shifts_energy_from_cheap_to_expensive_hour(self):
        result = optimize_schedule(
            demand_kwh=[0, 10],
            solar_kwh=[0, 0],
            price_per_kwh=[1, 10],
            carbon_kg_per_kwh=[0, 0],
            battery=BatteryConfig(
                capacity_kwh=10,
                initial_soc_kwh=0,
                max_charge_kw=10,
                max_discharge_kw=10,
                charge_efficiency=1,
                discharge_efficiency=1,
            ),
            soc_steps=10,
        )

        self.assertEqual(result["schedule"][0]["battery_soc_kwh"], 10)
        self.assertEqual(result["schedule"][1]["battery_discharge_kwh"], 10)
        self.assertEqual(result["metrics"]["optimized_cost"], 10)
        self.assertEqual(result["metrics"]["critical_load_violations"], 0)

    def test_battery_does_not_discharge_more_energy_than_load_uses(self):
        result = optimize_schedule(
            demand_kwh=[1],
            solar_kwh=[0],
            price_per_kwh=[10],
            carbon_kg_per_kwh=[0],
            battery=BatteryConfig(
                capacity_kwh=10,
                initial_soc_kwh=10,
                max_discharge_kw=10,
                discharge_efficiency=1,
            ),
            soc_steps=10,
        )

        self.assertEqual(result["schedule"][0]["battery_discharge_kwh"], 1)
        self.assertEqual(result["schedule"][0]["battery_soc_kwh"], 9)

    def test_cost_carbon_and_peak_metrics_use_interval_energy_correctly(self):
        result = optimize_schedule(
            demand_kwh=[1],
            solar_kwh=[0],
            price_per_kwh=[8],
            carbon_kg_per_kwh=[0.5],
            step_hours=0.25,
        )

        metrics = result["metrics"]
        self.assertEqual(metrics["baseline_cost"], 8)
        self.assertEqual(metrics["optimized_cost"], 8)
        self.assertEqual(metrics["baseline_carbon_kg"], 0.5)
        self.assertEqual(metrics["baseline_peak_grid_kw"], 4)

    def test_soc_steps_must_be_an_integer(self):
        with self.assertRaises(ValueError):
            optimize_schedule(
                demand_kwh=[1],
                solar_kwh=[0],
                price_per_kwh=[1],
                carbon_kg_per_kwh=[0],
                soc_steps=2.5,
            )

    def test_grid_import_cap_reduces_peak_with_flexible_load(self):
        result = optimize_schedule(
            demand_kwh=[5],
            solar_kwh=[0],
            price_per_kwh=[10],
            carbon_kg_per_kwh=[0],
            critical_load_kwh=[2],
            flexible_load_kwh=[3],
            flexible_shed_penalty_per_kwh=0.1,
            max_grid_import_kw=3,
        )

        step = result["schedule"][0]
        self.assertEqual(step["flexible_load_shed_kwh"], 3)
        self.assertEqual(result["metrics"]["estimated_peak_reduction_kw"], 3)
        self.assertEqual(result["metrics"]["grid_import_limit_violations"], 0)

    def test_infeasible_grid_import_cap_uses_safe_fallback(self):
        result = optimize_schedule(
            demand_kwh=[5],
            solar_kwh=[0],
            price_per_kwh=[1],
            carbon_kg_per_kwh=[0],
            critical_load_kwh=[5],
            max_grid_import_kw=3,
        )

        self.assertEqual(result["mode"], "safe_fallback")
        self.assertEqual(result["schedule"][0]["critical_load_kwh"], 5)
        self.assertEqual(result["metrics"]["critical_load_violations"], 0)
        self.assertEqual(result["metrics"]["grid_import_limit_violations"], 1)

    def test_critical_and_comfort_loads_are_protected(self):
        result = optimize_schedule(
            demand_kwh=[10],
            solar_kwh=[0],
            price_per_kwh=[10],
            carbon_kg_per_kwh=[0.8],
            critical_load_kwh=[4],
            hvac_load_kwh=[3],
            hvac_min_kwh=[2],
            flexible_load_kwh=[3],
            flexible_shed_penalty_per_kwh=100,
            hvac_reduction_penalty_per_kwh=100,
        )

        step = result["schedule"][0]
        self.assertEqual(step["critical_load_kwh"], 4)
        self.assertGreaterEqual(step["hvac_served_kwh"], step["hvac_min_kwh"])
        self.assertEqual(result["metrics"]["comfort_violations"], 0)
        self.assertEqual(result["metrics"]["critical_load_violations"], 0)
        self.assertTrue(result["requires_human_approval"])
        self.assertFalse(result["automatic_switching"])

    def test_battery_reserve_is_not_used_during_normal_schedule(self):
        result = optimize_schedule(
            demand_kwh=[10],
            solar_kwh=[0],
            price_per_kwh=[20],
            carbon_kg_per_kwh=[0],
            battery=BatteryConfig(
                capacity_kwh=20,
                initial_soc_kwh=10,
                min_soc_kwh=2,
                reserve_soc_kwh=8,
                max_discharge_kw=20,
                discharge_efficiency=1,
            ),
            soc_steps=10,
        )

        self.assertGreaterEqual(result["battery_final_soc_kwh"], 8)

    def test_safe_fallback_does_not_shed_or_dispatch_battery(self):
        result = safe_fallback_schedule(
            demand_kwh=[10],
            solar_kwh=[3],
            critical_load_kwh=[4],
            hvac_load_kwh=[2],
            flexible_load_kwh=[2],
        )

        self.assertEqual(result["mode"], "safe_fallback")
        self.assertEqual(result["schedule"][0]["grid_import_kwh"], 7)
        self.assertEqual(result["schedule"][0]["flexible_load_shed_kwh"], 0)
        self.assertEqual(result["schedule"][0]["battery_discharge_kwh"], 0)

    def test_islanding_reports_backup_time_and_critical_shortfall(self):
        result = simulate_islanding(
            critical_load_kwh=[3, 3, 3],
            battery=BatteryConfig(
                capacity_kwh=10,
                initial_soc_kwh=10,
                min_soc_kwh=2,
                max_discharge_kw=10,
                discharge_efficiency=1,
            ),
        )

        self.assertEqual(result["backup_duration_hours"], 2 + (2 / 3))
        self.assertEqual(result["critical_load_violations"], 1)
        self.assertEqual(result["mode"], "islanding_simulation_only")
        self.assertFalse(result["automatic_switching"])

    def test_input_rejects_critical_load_above_total_demand(self):
        with self.assertRaises(ValueError):
            optimize_schedule(
                demand_kwh=[5],
                solar_kwh=[0],
                price_per_kwh=[1],
                carbon_kg_per_kwh=[0.5],
                critical_load_kwh=[6],
            )


if __name__ == "__main__":
    unittest.main()
