from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.clients.base import GoogleAPIError
from app.clients.gemini import GeminiClient
from app.clients.maps import PlacesClient, RoutesClient
from app.core.config import get_settings
from app.models.planning import (
    PlanningStateResponse,
    TravelPlanningRequest,
    TripPlanResponse,
)
from app.services.memory import InMemorySessionStore
from app.services.optimizer import ItineraryOptimizer
from app.services.planner import PlannerService
from app.services.query_builder import SearchQueryBuilder


router = APIRouter(prefix="/api/v1/planner", tags=["planner"])


def get_planner_service(request: Request) -> PlannerService:
    settings = getattr(request.app.state, "settings", get_settings())
    http_client = getattr(request.app.state, "http_client", None)
    memory_store = getattr(request.app.state, "memory_store", None)
    if http_client is None:
        http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(settings.planner_request_timeout_seconds)
        )
        request.app.state.http_client = http_client
    if memory_store is None:
        memory_store = InMemorySessionStore()
        request.app.state.memory_store = memory_store

    return PlannerService(
        settings=settings,
        gemini_client=GeminiClient(http_client=http_client, settings=settings),
        places_client=PlacesClient(http_client=http_client, settings=settings),
        routes_client=RoutesClient(http_client=http_client, settings=settings),
        query_builder=SearchQueryBuilder(settings=settings),
        optimizer=ItineraryOptimizer(settings=settings),
        memory_store=memory_store,
    )


@router.post("/test-simple-gemini", response_model=PlanningStateResponse)
@router.post(
    "/planning-state",
    response_model=PlanningStateResponse,
    deprecated=True,
    include_in_schema=False,
)
async def test_simple_gemini(
    payload: TravelPlanningRequest,
    planner_service: PlannerService = Depends(get_planner_service),
) -> PlanningStateResponse:
    try:
        planning_state = await planner_service.extract_planning_state(payload)
    except GoogleAPIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return PlanningStateResponse(planning_state=planning_state)


@router.post("/plan", response_model=TripPlanResponse)
async def build_trip_plan(
    payload: TravelPlanningRequest,
    planner_service: PlannerService = Depends(get_planner_service),
) -> TripPlanResponse:
    try:
        return await planner_service.build_trip_plan(payload)
    except GoogleAPIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
