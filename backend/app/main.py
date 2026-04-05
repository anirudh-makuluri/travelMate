from __future__ import annotations

from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.stt import router as stt_router
from app.api.routes.planner import router as planner_router
from app.core.config import get_settings
from app.services.memory import InMemorySessionStore

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    timeout = httpx.Timeout(settings.planner_request_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as http_client:
        app.state.settings = settings
        app.state.http_client = http_client
        app.state.memory_store = InMemorySessionStore()
        yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

app.include_router(health_router)
app.include_router(stt_router)
app.include_router(planner_router)
