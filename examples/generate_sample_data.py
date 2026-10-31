"""Generate a clearly synthetic 15-day campus energy dataset."""

from __future__ import annotations

import csv
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dataset" / "sample_energy_timeseries.csv"
DAYS = 15


def occupancy_for(hour: int, weekday: bool) -> int:
    """Return a simple day/night occupancy pattern for a demo campus."""
    if not weekday:
        return 4 if hour < 8 or hour >= 20 else 14
    if hour < 7 or hour >= 22:
        return 5
    if hour < 9:
        return 28
    if hour < 17:
        return 86
    if hour < 20:
        return 38
    return 14


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    start = datetime(2026, 9, 1, tzinfo=timezone.utc)
    cloud_factors = (
        0.86, 0.97, 0.74, 0.91, 0.82, 1.0, 0.89,
        0.92, 0.79, 0.88, 0.72, 0.96, 0.85, 0.77, 0.93,
    )

    with OUTPUT.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=("timestamp", "demand_kwh", "occupancy_count", "solar_kwh"),
        )
        writer.writeheader()
        for step in range(DAYS * 24):
            timestamp = start + timedelta(hours=step)
            hour = timestamp.hour
            day = step // 24
            weekday = timestamp.weekday() < 5
            occupancy = occupancy_for(hour, weekday)
            if day >= 7 and weekday and 9 <= hour < 17:
                occupancy += 3  # a small second-week attendance change
            if day == DAYS - 1 and weekday and 9 <= hour < 11:
                occupancy += 12  # a one-off event during the holdout day
            sunlight = max(0.0, math.sin(math.pi * (hour - 6) / 12))
            solar_kwh = 22 * sunlight * cloud_factors[day % len(cloud_factors)]
            evening_hvac = 3.5 if 16 <= hour < 22 else 0.0
            daily_cycle = 2.2 * math.sin(2 * math.pi * hour / 24)
            weekly_cycle = 1.4 * math.sin(2 * math.pi * timestamp.weekday() / 7)
            demand_kwh = (
                42 + 0.65 * day + 0.46 * occupancy + evening_hvac + daily_cycle + weekly_cycle
            )
            writer.writerow(
                {
                    "timestamp": timestamp.isoformat().replace("+00:00", "Z"),
                    "demand_kwh": round(max(0.0, demand_kwh), 2),
                    "occupancy_count": occupancy,
                    "solar_kwh": round(max(0.0, solar_kwh), 2),
                }
            )

    print(f"Wrote {DAYS * 24} synthetic hourly rows to {OUTPUT}")


if __name__ == "__main__":
    main()
