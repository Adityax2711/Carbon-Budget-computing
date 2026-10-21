import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "CarbonGuard"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # Database (aiosqlite for local, postgresql+asyncpg for production)
    DATABASE_URL: str = "sqlite+aiosqlite:///./carbonguard.db"
    
    # Grid Carbon Intensity Defaults (gCO2e per kWh)
    DEFAULT_CARBON_INTENSITY: float = 380.0
    
    # Policy defaults
    WARNING_THRESHOLD_PERCENT: float = 80.0
    DEPLETION_THRESHOLD_PERCENT: float = 100.0
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="allow"
    )

settings = Settings()
