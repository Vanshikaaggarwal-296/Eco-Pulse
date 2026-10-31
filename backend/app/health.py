from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "app": "EcoPulse API",
        "version": "0.1.0",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "data_mode": "synthetic_demo",
    }