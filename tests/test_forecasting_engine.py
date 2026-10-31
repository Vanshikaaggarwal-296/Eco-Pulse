"""Small standard-library tests for the first forecasting-engine baseline."""

import unittest

import pandas as pd

from forecasting_engine import (
    detect_anomalies,
    forecast_demand,
    forecast_metrics,
    forecast_occupancy,
    forecast_renewable,
)


class ForecastingEngineTests(unittest.TestCase):
    def setUp(self):
        timestamps = pd.date_range("2026-01-01", periods=72, freq="h", tz="UTC")
        self.history = pd.DataFrame(
            {
                "timestamp": timestamps,
                "demand_kwh": [10 + (hour % 24) for hour in range(72)],
                "occupancy_count": [20 + (hour % 24) for hour in range(72)],
                "solar_kwh": [max(0, 8 - abs((hour % 24) - 12)) for hour in range(72)],
            }
        )

    def test_forecasters_return_ranges_for_requested_horizon(self):
        cases = (
            (forecast_demand, "demand_kwh"),
            (forecast_occupancy, "occupancy_count"),
            (forecast_renewable, "solar_kwh"),
        )
        for forecaster, value_col in cases:
            with self.subTest(forecaster=forecaster.__name__):
                result = forecaster(self.history, horizon=6, value_col=value_col)
                self.assertEqual(len(result), 6)
                self.assertTrue((result["lower"] <= result["forecast"]).all())
                self.assertTrue((result["forecast"] <= result["upper"]).all())

    def test_forecast_metrics(self):
        scores = forecast_metrics([10, 20], [12, 18])
        self.assertAlmostEqual(scores["mae"], 2.0)
        self.assertAlmostEqual(scores["rmse"], 2.0)
        self.assertAlmostEqual(scores["mape"], 15.0)

    def test_anomaly_detector_flags_a_large_jump(self):
        data = pd.DataFrame(
            {
                "timestamp": pd.date_range("2026-01-01", periods=30, freq="h", tz="UTC"),
                "value": [10.0] * 29 + [100.0],
            }
        )
        result = detect_anomalies(data, window=12)
        self.assertTrue(bool(result.iloc[-1]["is_anomaly"]))


if __name__ == "__main__":
    unittest.main()
