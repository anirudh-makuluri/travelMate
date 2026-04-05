from __future__ import annotations

from app.clients.gemini import GeminiClient
from app.clients.maps import PlacesClient, RoutesClient
from app.core.config import Settings
from app.models.planning import (
    PlanningState,
    TransportMode,
    TransportPreference,
    TravelPlanningRequest,
    TripPlanResponse,
)
from app.services.completeness import CompletenessEvaluator
from app.services.feasibility import FeasibilityEvaluator
from app.services.memory import InMemorySessionStore
from app.services.optimizer import ItineraryOptimizer
from app.services.query_builder import SearchQueryBuilder
from app.workflows.planner_graph import PlannerWorkflow


class PlannerService:
    def __init__(
        self,
        *,
        settings: Settings,
        gemini_client: GeminiClient,
        places_client: PlacesClient,
        routes_client: RoutesClient,
        query_builder: SearchQueryBuilder,
        optimizer: ItineraryOptimizer,
        memory_store: InMemorySessionStore,
    ) -> None:
        self.settings = settings
        self.gemini_client = gemini_client
        self.workflow = PlannerWorkflow(
            settings=settings,
            gemini_client=gemini_client,
            places_client=places_client,
            routes_client=routes_client,
            query_builder=query_builder,
            optimizer=optimizer,
            completeness_evaluator=CompletenessEvaluator(),
            feasibility_evaluator=FeasibilityEvaluator(),
            memory_store=memory_store,
        )

    async def extract_planning_state(
        self,
        request: TravelPlanningRequest,
    ) -> PlanningState:
        language_code = request.language_code or self.settings.default_language_code
        region_code = request.region_code or self.settings.default_region_code
        currency_code = request.currency_code or self.settings.default_currency_code

        planning_state = await self.gemini_client.extract_planning_state(
            prompt=request.prompt,
            language_code=language_code,
            region_code=region_code,
            currency_code=currency_code,
            default_days=self.settings.planner_default_days,
            default_stops_per_day=self.settings.planner_default_stops_per_day,
        )

        planning_state.raw_request = request.prompt
        planning_state.language_code = language_code
        planning_state.region_code = region_code
        planning_state.currency_code = currency_code
        planning_state.transport_preference = request.transport_preference
        planning_state.transport_modes = self._resolve_transport_modes(
            request.transport_preference
        )
        planning_state.assumptions.append(
            f"Transport preference set to {request.transport_preference.value}."
        )
        return planning_state

    async def build_trip_plan(
        self,
        request: TravelPlanningRequest,
    ) -> TripPlanResponse:
        return await self.workflow.run(request)

    def _resolve_transport_modes(
        self,
        transport_preference: TransportPreference,
    ) -> list[TransportMode]:
        mapping = {
            TransportPreference.OWN_TRANSPORT: [TransportMode.DRIVE],
            TransportPreference.PUBLIC_TRANSPORT: [TransportMode.TRANSIT],
            TransportPreference.HYBRID: [TransportMode.DRIVE, TransportMode.TRANSIT],
            TransportPreference.OPTIMIZE_TIME: [TransportMode.DRIVE, TransportMode.TRANSIT],
            TransportPreference.OPTIMIZE_MONEY: [TransportMode.TRANSIT, TransportMode.DRIVE],
        }
        return mapping[transport_preference]
