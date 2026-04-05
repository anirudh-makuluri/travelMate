from __future__ import annotations

from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.api.routes.planner import router as planner_router
from app.core.config import get_settings
from app.services.memory import InMemorySessionStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    timeout = httpx.Timeout(settings.planner_request_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as http_client:
        app.state.settings = settings
        app.state.http_client = http_client
        app.state.memory_store = InMemorySessionStore()
        yield


app = FastAPI(
    title=get_settings().app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(health_router)
app.include_router(planner_router)
