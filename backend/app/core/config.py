from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, ConfigDict, SecretStr


class Settings(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    app_name: str = "travelMate Planner API"
    env: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000

    gemini_api_key: SecretStr | None = None
    maps_api_key: SecretStr | None = None
    gemini_model: str = "gemini-2.5-flash"

    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    places_base_url: str = "https://places.googleapis.com/v1"
    routes_base_url: str = "https://routes.googleapis.com"

    default_language_code: str = "en"
    default_region_code: str = "US"
    default_currency_code: str = "USD"

    planner_candidate_limit: int = 12
    planner_default_days: int = 2
    planner_default_stops_per_day: int = 4
    planner_shortlist_size: int = 8
    planner_request_timeout_seconds: float = 20.0
    planner_enable_google_calls: bool = True

    @property
    def gemini_api_key_value(self) -> str | None:
        if self.gemini_api_key is None:
            return None
        return self.gemini_api_key.get_secret_value()

    @property
    def maps_api_key_value(self) -> str | None:
        if self.maps_api_key is None:
            return None
        return self.maps_api_key.get_secret_value()

    @classmethod
    def from_env(cls) -> "Settings":
        env_file_values = _read_env_file()
        return cls(
            app_name=_read_value("APP_NAME", "travelMate Planner API", env_file_values),
            env=_read_value("ENV", "development", env_file_values),
            host=_read_value("HOST", "0.0.0.0", env_file_values),
            port=int(_read_value("PORT", "8000", env_file_values)),
            gemini_api_key=_read_secret("GEMINI_API_KEY", env_file_values),
            maps_api_key=_read_secret("MAPS_API_KEY", env_file_values),
            gemini_model=_read_value("GEMINI_MODEL", "gemini-2.5-flash", env_file_values),
            default_language_code=_read_value(
                "DEFAULT_LANGUAGE_CODE",
                "en",
                env_file_values,
            ),
            default_region_code=_read_value("DEFAULT_REGION_CODE", "US", env_file_values),
            default_currency_code=_read_value(
                "DEFAULT_CURRENCY_CODE",
                "USD",
                env_file_values,
            ),
            planner_candidate_limit=int(
                _read_value("PLANNER_CANDIDATE_LIMIT", "12", env_file_values)
            ),
            planner_default_days=int(
                _read_value("PLANNER_DEFAULT_DAYS", "2", env_file_values)
            ),
            planner_default_stops_per_day=int(
                _read_value("PLANNER_DEFAULT_STOPS_PER_DAY", "4", env_file_values)
            ),
            planner_shortlist_size=int(
                _read_value("PLANNER_SHORTLIST_SIZE", "8", env_file_values)
            ),
            planner_request_timeout_seconds=float(
                _read_value("PLANNER_REQUEST_TIMEOUT_SECONDS", "20", env_file_values)
            ),
            planner_enable_google_calls=_read_bool(
                _read_value("PLANNER_ENABLE_GOOGLE_CALLS", "true", env_file_values)
            ),
        )


def _read_value(name: str, default: str, env_file_values: dict[str, str]) -> str:
    return os.getenv(name) or env_file_values.get(name) or default


def _read_secret(name: str, env_file_values: dict[str, str]) -> SecretStr | None:
    value = os.getenv(name) or env_file_values.get(name)
    if not value:
        return None
    return SecretStr(value)


def _read_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _read_env_file() -> dict[str, str]:
    env_path = Path(".env")
    if not env_path.exists():
        return {}

    parsed: dict[str, str] = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        parsed[key.strip()] = value.strip().strip('"').strip("'")
    return parsed


@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()
