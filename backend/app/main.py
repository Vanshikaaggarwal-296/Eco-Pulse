import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database.models import initialize_database
from app.energy import router as energy_router
from app.health import router as health_router

settings = get_settings()

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    version="0.1.0",
    description="EcoPulse carbon-aware energy optimization backend.",
)

# Allow the frontend to communicate with the backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the health-check API.
app.include_router(
    health_router,
    prefix="/api",
    tags=["Health"],
)

# Register the energy API.
app.include_router(
    energy_router,
    prefix="/api/energy",
    tags=["Energy"],
)


# Initialize the database when the application starts.
@app.on_event("startup")
def startup_event():
    initialize_database()


# Root endpoint.
@app.get("/")
def root():
    return {
        "message": "Welcome to EcoPulse API",
        "docs": "/docs",
    }