"""Validate uploaded hourly CSV data before per-request model training."""
import csv
from io import StringIO
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import numpy as np
import pandas as pd

from forecasting_engine.data import validate_history, REQUIRED

MAX_BYTES = 8 * 1024 * 1024
MAX_ROWS = 50000
MIN_HOURS = 35 * 24


def parse_csv(text, timezone_name):
    if len(text.encode('utf-8')) > MAX_BYTES:
        raise ValueError('File is too large. Maximum CSV size is 8 MB.')
    try:
        ZoneInfo(timezone_name)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError('Enter a valid IANA timezone, for example Asia/Kolkata or Europe/London.')
    header = next(csv.reader(StringIO(text)), [])
    normalized = [column.strip().lstrip('\ufeff') for column in header]
    if len(set(normalized)) != len(normalized):
        raise ValueError('Column names must be unique.')
    try:
        data = pd.read_csv(StringIO(text), dtype={'building_id': str}, nrows=MAX_ROWS + 1)
    except Exception as exc:
        raise ValueError('Cannot read CSV. Export a UTF-8 comma-separated file with a header row.') from exc
    data.columns = data.columns.str.strip().str.lstrip('\ufeff')
    if data.columns.duplicated().any():
        raise ValueError('Column names must be unique.')
    missing = set(REQUIRED) - set(data.columns)
    if missing:
        raise ValueError('Missing required columns: ' + ', '.join(sorted(missing)))
    if len(data) > MAX_ROWS:
        raise ValueError(f'Maximum {MAX_ROWS:,} rows per upload.')
    if data.building_id.nunique() > 10:
        raise ValueError('Maximum 10 buildings per upload.')
    if data.building_id.isna().any():
        raise ValueError('Each row needs a building_id.')
    data.building_id = data.building_id.astype(str).str.strip()
    if data.building_id.str.len().max() > 100:
        raise ValueError('Building IDs must be at most 100 characters.')
    try:
        parsed = data.timestamp.map(pd.Timestamp)
        if parsed.isna().any():
            raise ValueError('Missing timestamp')
        naive = parsed.map(lambda x: x.tzinfo is None)
        if naive.any() and not naive.all():
            raise ValueError('Do not mix timezone-aware and timezone-free timestamps.')
        if naive.all():
            data.timestamp = pd.DatetimeIndex(parsed).tz_localize(timezone_name, ambiguous='raise', nonexistent='raise').tz_convert('UTC')
        else:
            data.timestamp = pd.to_datetime(data.timestamp, utc=True)
    except Exception as exc:
        raise ValueError('Invalid or ambiguous timestamps. Use ISO timestamps with an offset, e.g. 2026-01-01T00:00:00+05:30.') from exc
    data = validate_history(data, MIN_HOURS)
    if 'battery_soc_pct' in data:
        data.battery_soc_pct = pd.to_numeric(data.battery_soc_pct, errors='raise')
        if not np.isfinite(data.battery_soc_pct).all():
            raise ValueError('battery_soc_pct must be numeric and complete, or omit that column.')
    # Keep the contract only; ignore unrelated columns instead of retaining personal data.
    return data[[*REQUIRED, *(['battery_soc_pct'] if 'battery_soc_pct' in data else [])]]
