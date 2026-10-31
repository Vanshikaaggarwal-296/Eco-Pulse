"""Train on your CSV and save forecasts, evaluation, alerts and optional decisions."""
import argparse
import json
from pathlib import Path

import sys

BACKEND_DIR = str(Path(__file__).resolve().parent / "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.forecasting import AnalyzeRequest, analyze

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('csv_file')
    parser.add_argument('--building', required=True)
    parser.add_argument('--timezone', default='Asia/Kolkata')
    parser.add_argument('--horizon', type=int, default=24)
    parser.add_argument('--controls', help='JSON file with actual tariffs, carbon and equipment constraints')
    parser.add_argument('--output', default='results.json')
    args = parser.parse_args()
    controls = json.loads(Path(args.controls).read_text(encoding='utf-8')) if args.controls else None
    result = analyze(AnalyzeRequest(csv_text=Path(args.csv_file).read_text(encoding='utf-8-sig'), building_id=args.building, timezone=args.timezone, horizon=args.horizon, control_inputs=controls))
    Path(args.output).write_text(json.dumps(result, indent=2, allow_nan=False), encoding='utf-8')
    print(f'Saved analysis to {args.output}')
