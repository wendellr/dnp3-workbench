from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "DNP3 Master Simulator"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    DNP3_ENGINE: str = "simulated"
    DNP3_MASTER_RUNTIME_BASE_URL: str = "http://dnp3-master-runtime:21200"
    ENABLE_DEMO_OUTSTATION: bool = True
    ENABLE_PUBLIC_OUTSTATION_MANAGEMENT: bool = True

settings = Settings()
