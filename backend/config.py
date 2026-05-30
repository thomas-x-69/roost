from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent

class Settings(BaseSettings):
    app_name: str = "Roost"
    app_version: str = "1.0.0"
    # Bind to localhost by default — the control API has no authentication.
    # Override to 0.0.0.0 only on a trusted network (see SECURITY.md).
    host: str = "127.0.0.1"
    port: int = 5000
    debug: bool = False
    db_path: str = str(BASE_DIR / "data" / "roost.db")
    data_dir: str = str(BASE_DIR / "data")
    frontend_dist: str = str(BASE_DIR / "frontend" / "dist")
    scan_interval_seconds: int = 30
    usage_aggregation_seconds: int = 60
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
