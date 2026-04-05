from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, SecretStr


class Settings(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    app_name: str = "travelMate Planner API"
    env: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000

    gemini_api_key: SecretStr | None = None
    maps_api_key: SecretStr | None = None
    elevenlabs_api_key: SecretStr | None = None
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    elevenlabs_model_id: str = "eleven_multilingual_v2"
    elevenlabs_stt_model_id: str = "scribe_v1"
    elevenlabs_music_model_id: str = "music_v1"
    elevenlabs_music_default_length_ms: int = 10000
    elevenlabs_realtime_model_id: str = "scribe_v2_realtime"
    gemini_model: str = "gemini-2.5-flash"

    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    places_base_url: str = "https://places.googleapis.com/v1"
    routes_base_url: str = "https://routes.googleapis.com"
    elevenlabs_base_url: str = "https://api.elevenlabs.io/v1"

    default_language_code: str = "en"
    default_region_code: str = "US"
    default_currency_code: str = "USD"

    planner_candidate_limit: int = 12
    planner_default_days: int = 2
    planner_default_stops_per_day: int = 4
    planner_shortlist_size: int = 8
    planner_max_incomplete_attempts: int = 3
    planner_response_context_limit: int = 1
    planner_request_timeout_seconds: float = 20.0
    planner_response_cache_enabled: bool = True
    planner_response_cache_ttl_seconds: float = 900.0
    planner_cached_response_delay_seconds: float = 1.2
    planner_enable_google_calls: bool = True
    elevenlabs_request_timeout_seconds: float = 30.0
    cors_allow_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )
    cors_allow_methods: list[str] = Field(default_factory=lambda: ["*"])
    cors_allow_headers: list[str] = Field(default_factory=lambda: ["*"])
    cors_allow_credentials: bool = True

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

    @property
    def elevenlabs_api_key_value(self) -> str | None:
        if self.elevenlabs_api_key is None:
            return None
        return self.elevenlabs_api_key.get_secret_value()

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
            elevenlabs_api_key=_read_secret("ELEVENLABS_API_KEY", env_file_values),
            elevenlabs_voice_id=_read_value(
                "ELEVENLABS_VOICE_ID",
                "21m00Tcm4TlvDq8ikWAM",
                env_file_values,
            ),
            elevenlabs_model_id=_read_value(
                "ELEVENLABS_MODEL_ID",
                "eleven_multilingual_v2",
                env_file_values,
            ),
            elevenlabs_stt_model_id=_read_value(
                "ELEVENLABS_STT_MODEL_ID",
                "scribe_v1",
                env_file_values,
            ),
            elevenlabs_music_model_id=_read_value(
                "ELEVENLABS_MUSIC_MODEL_ID",
                "music_v1",
                env_file_values,
            ),
            elevenlabs_music_default_length_ms=int(
                _read_value("ELEVENLABS_MUSIC_DEFAULT_LENGTH_MS", "10000", env_file_values)
            ),
            elevenlabs_realtime_model_id=_read_value(
                "ELEVENLABS_REALTIME_MODEL_ID",
                "scribe_v2_realtime",
                env_file_values,
            ),
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
            planner_max_incomplete_attempts=int(
                _read_value("PLANNER_MAX_INCOMPLETE_ATTEMPTS", "3", env_file_values)
            ),
            planner_response_context_limit=int(
                _read_value("PLANNER_RESPONSE_CONTEXT_LIMIT", "1", env_file_values)
            ),
            planner_request_timeout_seconds=float(
                _read_value("PLANNER_REQUEST_TIMEOUT_SECONDS", "20", env_file_values)
            ),
            planner_response_cache_enabled=_read_bool(
                _read_value("PLANNER_RESPONSE_CACHE_ENABLED", "true", env_file_values)
            ),
            planner_response_cache_ttl_seconds=float(
                _read_value("PLANNER_RESPONSE_CACHE_TTL_SECONDS", "900", env_file_values)
            ),
            planner_cached_response_delay_seconds=float(
                _read_value("PLANNER_CACHED_RESPONSE_DELAY_SECONDS", "1.2", env_file_values)
            ),
            planner_enable_google_calls=_read_bool(
                _read_value("PLANNER_ENABLE_GOOGLE_CALLS", "true", env_file_values)
            ),
            elevenlabs_request_timeout_seconds=float(
                _read_value(
                    "ELEVENLABS_REQUEST_TIMEOUT_SECONDS",
                    "30",
                    env_file_values,
                )
            ),
            cors_allow_origins=_read_csv(
                _read_value(
                    "CORS_ALLOW_ORIGINS",
                    "http://localhost:3000,http://127.0.0.1:3000",
                    env_file_values,
                )
            ),
            cors_allow_methods=_read_csv(
                _read_value(
                    "CORS_ALLOW_METHODS",
                    "*",
                    env_file_values,
                )
            ),
            cors_allow_headers=_read_csv(
                _read_value(
                    "CORS_ALLOW_HEADERS",
                    "*",
                    env_file_values,
                )
            ),
            cors_allow_credentials=_read_bool(
                _read_value(
                    "CORS_ALLOW_CREDENTIALS",
                    "true",
                    env_file_values,
                )
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


def _read_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _read_env_file() -> dict[str, str]:
    candidates = [
        Path(__file__).resolve().parents[2] / ".env",
        Path(".env"),
    ]

    env_path = next((path for path in candidates if path.exists()), None)
    if env_path is None:
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
