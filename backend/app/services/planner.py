from __future__ import annotations

from app.clients.gemini import GeminiClient
from app.clients.maps import PlacesClient, RoutesClient
from app.core.config import Settings
from app.models.planning import (
    CandidatePlace,
    PlanMetadata,
    PlanningState,
    TransportMode,
    TransportPreference,
    TravelStep,
    TravelPlanningRequest,
    TripPlanResponse,
)
from app.services.optimizer import ItineraryOptimizer
from app.services.query_builder import SearchQueryBuilder


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
    ) -> None:
        self.settings = settings
        self.gemini_client = gemini_client
        self.places_client = places_client
        self.routes_client = routes_client
        self.query_builder = query_builder
        self.optimizer = optimizer

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
        planning_state = await self.extract_planning_state(request)
        search_queries = self.query_builder.build_queries(planning_state)

        per_query_limit = max(
            4,
            self.settings.planner_candidate_limit // max(1, len(search_queries)),
        )
        candidates = await self._collect_candidates(
            search_queries=search_queries,
            planning_state=planning_state,
            per_query_limit=per_query_limit,
        )
        if not candidates:
            raise ValueError(
                "No places were returned by Google Places for the current request. "
                "Refine the destination or preferences and try again."
            )

        shortlist = self.optimizer.shortlist_candidates(planning_state, candidates)
        evaluated_modes = self._resolve_transport_modes(planning_state.transport_preference)
        route_maps_by_mode = await self.routes_client.compute_route_maps_for_modes(
            places=shortlist,
            modes=evaluated_modes,
            language_code=planning_state.language_code,
        )
        route_map = self._select_route_map(
            planning_state=planning_state,
            route_maps_by_mode=route_maps_by_mode,
        )
        selected_modes = self._selected_modes(route_map)
        primary_mode = selected_modes[0] if selected_modes else evaluated_modes[0]

        itinerary = self.optimizer.build_itinerary(
            planning_state=planning_state,
            candidates=shortlist,
            route_map=route_map,
        )
        budget = self.optimizer.estimate_budget(planning_state, itinerary)

        itinerary_summary = [
            {
                "day_number": day.day_number,
                "theme": day.theme,
                "stops": [
                    {
                        "name": stop.place.name,
                        "type": stop.place.primary_type,
                        "travel_minutes": (
                            stop.travel_from_previous.duration_minutes
                            if stop.travel_from_previous
                            else None
                        ),
                        "rationale": stop.rationale,
                    }
                    for stop in day.stops
                ],
            }
            for day in itinerary
        ]
        explanation = await self.gemini_client.explain_itinerary(
            raw_request=request.prompt,
            planning_state=planning_state,
            itinerary_summary=itinerary_summary,
        )

        warnings = []
        if not self.settings.gemini_api_key_value:
            warnings.append(
                "GEMINI_API_KEY is not configured. Planning-state parsing and explanations may use fallback logic."
            )
        if not self.settings.maps_api_key_value:
            warnings.append(
                "MAPS_API_KEY is not configured. Places and routing may fail or use fallback estimates."
            )
        if planning_state.destination.value == "Unknown destination":
            warnings.append("The destination could not be extracted reliably from the request.")

        return TripPlanResponse(
            planning_state=planning_state,
            candidates=shortlist,
            itinerary=itinerary,
            budget=budget,
            explanation=explanation,
            warnings=warnings,
            metadata=PlanMetadata(
                search_queries=search_queries,
                candidate_count=len(candidates),
                shortlist_count=len(shortlist),
                transport_preference=planning_state.transport_preference,
                primary_transport_mode=primary_mode,
                evaluated_transport_modes=evaluated_modes,
            ),
        )

    async def _collect_candidates(
        self,
        *,
        search_queries: list[str],
        planning_state: PlanningState,
        per_query_limit: int,
    ) -> list[CandidatePlace]:
        deduplicated: dict[str, CandidatePlace] = {}

        for query in search_queries:
            query_results = await self.places_client.search_text(
                text_query=query,
                language_code=planning_state.language_code,
                region_code=planning_state.region_code,
                max_results=per_query_limit,
            )
            for place in query_results:
                deduplicated.setdefault(place.place_id, place)

        return list(deduplicated.values())

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

    def _select_route_map(
        self,
        *,
        planning_state: PlanningState,
        route_maps_by_mode: dict[TransportMode, dict[tuple[str, str], TravelStep]],
    ) -> dict[tuple[str, str], TravelStep]:
        all_keys = {
            key
            for route_map in route_maps_by_mode.values()
            for key in route_map
        }
        selected: dict[tuple[str, str], TravelStep] = {}

        for key in all_keys:
            options = [
                route_map[key]
                for route_map in route_maps_by_mode.values()
                if key in route_map
            ]
            if not options:
                continue
            selected[key] = self._choose_route_option(
                options=options,
                transport_preference=planning_state.transport_preference,
            )

        return selected

    def _choose_route_option(
        self,
        *,
        options: list[TravelStep],
        transport_preference: TransportPreference,
    ) -> TravelStep:
        if transport_preference == TransportPreference.OWN_TRANSPORT:
            return self._find_mode_or_fallback(options, TransportMode.DRIVE)
        if transport_preference == TransportPreference.PUBLIC_TRANSPORT:
            return self._find_mode_or_fallback(options, TransportMode.TRANSIT)
        if transport_preference == TransportPreference.OPTIMIZE_MONEY:
            return min(
                options,
                key=lambda option: (
                    option.cost_estimate if option.cost_estimate is not None else float("inf"),
                    option.duration_minutes if option.duration_minutes is not None else float("inf"),
                ),
            )
        if transport_preference == TransportPreference.HYBRID:
            return min(
                options,
                key=lambda option: self._hybrid_score(option),
            )
        return min(
            options,
            key=lambda option: (
                option.duration_minutes if option.duration_minutes is not None else float("inf"),
                option.cost_estimate if option.cost_estimate is not None else float("inf"),
            ),
        )

    def _find_mode_or_fallback(
        self,
        options: list[TravelStep],
        preferred_mode: TransportMode,
    ) -> TravelStep:
        for option in options:
            if option.mode == preferred_mode:
                return option
        return options[0]

    def _hybrid_score(self, option: TravelStep) -> float:
        duration = option.duration_minutes if option.duration_minutes is not None else 1_000
        cost = option.cost_estimate if option.cost_estimate is not None else 100
        return duration * 0.65 + cost * 8

    def _selected_modes(
        self,
        route_map: dict[tuple[str, str], TravelStep],
    ) -> list[TransportMode]:
        seen: list[TransportMode] = []
        for route in route_map.values():
            if route.mode not in seen:
                seen.append(route.mode)
        return seen
