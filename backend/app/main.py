
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database.models import initialize_database
from app.energy import router as energy_router
from app.health import router as health_router
from app.optimization import router as optimization_router


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load application settings
settings = get_settings()


# Initialize database when the application starts
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting EcoPulse API...")
    initialize_database()
    logger.info("Database initialized successfully.")

    yield

    logger.info("EcoPulse API shutting down.")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="EcoPulse carbon-aware energy optimization backend.",
    version="0.1.0",
    debug=settings.debug,
    lifespan=lifespan,
)


# Configure CORS
# Keep these origins synchronized with your actual frontend URLs.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


# Register health-check API
app.include_router(
    health_router,
    prefix="/api",
    tags=["Health"],
)


# Register energy API
app.include_router(
    energy_router,
    prefix="/api/energy",
    tags=["Energy"],
)

app.include_router(
    optimization_router,
    prefix="/api/optimization",
    tags=["Energy Optimization"],
)


# Root endpoint
@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Welcome to EcoPulse API",
        "docs": "/docs",
        "health": "/api/health",
        "energy_analytics": "/api/energy/analytics",
        "energy_optimization": "/api/optimization/schedule",
        "outage_simulation": "/api/optimization/outage",
    }
