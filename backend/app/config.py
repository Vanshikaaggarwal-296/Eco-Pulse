from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EcoPulse API"
    app_env: str = "development"
    debug: bool = True
    cors_origins: str = (
        "http://localhost:5173,http://localhost:3000,"
        "https://ecopulse-vanshika-demo.onrender.com"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        configured = [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]
        # Keep the public demo frontend allowed even when CORS_ORIGINS is
        # explicitly set in the hosting environment.
        return list(dict.fromkeys([
            *configured,
            "https://ecopulse-vanshika-demo.onrender.com",
        ]))


@lru_cache
def get_settings() -> Settings:
    return Settings()
