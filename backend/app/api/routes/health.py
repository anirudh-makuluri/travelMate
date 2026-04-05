from __future__ import annotations

from fastapi import APIRouter, Request

from app.core.config import get_settings


router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
async def health(request: Request) -> dict[str, object]:
    settings = getattr(request.app.state, "settings", get_settings())
    memory_store = getattr(request.app.state, "memory_store", None)
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.env,
        "gemini_api_key_configured": settings.gemini_api_key is not None,
        "maps_api_key_configured": settings.maps_api_key is not None,
        "google_calls_enabled": settings.planner_enable_google_calls,
        "gemini_model": settings.gemini_model,
        "session_memory_enabled": memory_store is not None,
    }
