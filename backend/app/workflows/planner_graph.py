from __future__ import annotations

import asyncio
import hashlib
import json
import re
from typing import Any, TypedDict
from uuid import uuid4

from app.clients.gemini import GeminiClient
from app.clients.maps import PlacesClient, RoutesClient
from app.core.config import Settings
from app.models.planning import (
    BudgetEstimate,
    CandidatePlace,
    CompletenessAssessment,
    CompletenessStatus,
    ConversationRole,
    FeasibilityAssessment,
    FeasibilityStatus,
    PlanMetadata,
    PlanningState,
    TransportMode,
    TransportPreference,
    TravelStep,
    TravelPlanningRequest,
    TripPlanResponse,
)
from app.services.completeness import CompletenessEvaluator
from app.services.feasibility import FeasibilityEvaluator
from app.services.memory import InMemorySessionStore
from app.services.optimizer import ItineraryOptimizer
from app.services.query_builder import SearchQueryBuilder


class PlannerGraphState(TypedDict, total=False):
    request: TravelPlanningRequest
    session_id: str
    context_block: str
    planning_state: PlanningState
    completeness: CompletenessAssessment
    feasibility: FeasibilityAssessment
    search_queries: list[str]
    origin: str | None
    candidates: list[CandidatePlace]
    itinerary_summary: list[dict[str, Any]]
    route_overview: dict[str, Any] | None
    itinerary: list[Any]
    budget: BudgetEstimate
    explanation: str
    warnings: list[str]
    metadata: PlanMetadata
    incomplete_attempts: int
    response: TripPlanResponse


class PlannerWorkflow:
    def __init__(
        self,
        *,
        settings: Settings,
        gemini_client: GeminiClient,
        places_client: PlacesClient,
        routes_client: RoutesClient,
        query_builder: SearchQueryBuilder,
        optimizer: ItineraryOptimizer,
        completeness_evaluator: CompletenessEvaluator,
        feasibility_evaluator: FeasibilityEvaluator,
        memory_store: InMemorySessionStore,
    ) -> None:
        self.settings = settings
        self.gemini_client = gemini_client
        self.places_client = places_client
        self.routes_client = routes_client
        self.query_builder = query_builder
        self.optimizer = optimizer
        self.completeness_evaluator = completeness_evaluator
        self.feasibility_evaluator = feasibility_evaluator
        self.memory_store = memory_store
        self.workflow_engine = "sequential"

    async def run(self, request: TravelPlanningRequest) -> TripPlanResponse:
        session_id = request.session_id or str(uuid4())
        cache_key = self._build_cache_key(
            request=request,
        )
        if self.settings.planner_response_cache_enabled:
            cached_response = self.memory_store.get_cached_planner_response(
                cache_key,
                ttl_seconds=self.settings.planner_response_cache_ttl_seconds,
            )
            if cached_response is not None:
                return await self._serve_cached_response(
                    session_id=session_id,
                    request=request,
                    cached_response=cached_response,
                )

        initial_state: PlannerGraphState = {
            "request": request,
            "session_id": session_id,
        }
        result = await self._run_sequential(initial_state)
        response = result["response"]
        if self.settings.planner_response_cache_enabled:
            self.memory_store.set_cached_planner_response(cache_key, response)
        return response

    async def _run_sequential(self, state: PlannerGraphState) -> PlannerGraphState:
        updates = await self._load_memory(state)
        state = {**state, **updates}
        updates = await self._extract_planning_state(state)
        state = {**state, **updates}
        updates = await self._evaluate_completeness(state)
        state = {**state, **updates}
        if state["completeness"].status != CompletenessStatus.COMPLETE:
            updates = await self._finalize_response(state)
            return {**state, **updates}
        updates = await self._evaluate_feasibility(state)
        state = {**state, **updates}

        if state["feasibility"].status == FeasibilityStatus.FEASIBLE:
            updates = await self._build_plan(state)
            state = {**state, **updates}

        updates = await self._finalize_response(state)
        return {**state, **updates}

    async def _load_memory(self, state: PlannerGraphState) -> PlannerGraphState:
        request = state["request"]
        session_id = state["session_id"]
        self.memory_store.append_turn(
            session_id,
            role=ConversationRole.USER,
            content=request.prompt,
        )
        return {}

    async def _extract_planning_state(self, state: PlannerGraphState) -> PlannerGraphState:
        request = state["request"]
        session_id = state["session_id"]

        language_code = request.language_code or self.settings.default_language_code
        region_code = request.region_code or self.settings.default_region_code
        currency_code = request.currency_code or self.settings.default_currency_code

        context_block = self.memory_store.build_context_block(
            session_id,
            limit=8,
            exclude_latest_user_turn=True,
        )
        planning_prompt = request.prompt
        if context_block:
            planning_prompt = (
                "Recent conversation context:\n"
                f"{context_block}\n\n"
                f"Latest request:\n{request.prompt}"
            )

        planning_state = await self.gemini_client.extract_planning_state(
            prompt=planning_prompt,
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
        if context_block:
            planning_state.assumptions.append(
                "Planner considered recent conversation context from session memory."
            )

        origin = self._extract_origin(
            prompt=request.prompt,
            context_block=context_block,
        )
        if origin:
            planning_state.assumptions.append(f"Origin inferred as {origin}.")

        self.memory_store.set_last_planning_state(session_id, planning_state)
        return {
            "planning_state": planning_state,
            "context_block": context_block,
            "origin": origin,
        }

    async def _evaluate_completeness(self, state: PlannerGraphState) -> PlannerGraphState:
        session_id = state["session_id"]
        planning_state = state["planning_state"]
        completeness = self.completeness_evaluator.evaluate(
            planning_state,
            context_text=state.get("context_block", ""),
        )
        if completeness.status == CompletenessStatus.COMPLETE:
            self.memory_store.reset_incomplete_attempts(session_id)
            incomplete_attempts = 0
        else:
            incomplete_attempts = self.memory_store.increment_incomplete_attempts(session_id)
        return {
            "completeness": completeness,
            "incomplete_attempts": incomplete_attempts,
        }

    async def _evaluate_feasibility(self, state: PlannerGraphState) -> PlannerGraphState:
        planning_state = state["planning_state"]
        feasibility = self.feasibility_evaluator.evaluate(planning_state)
        return {"feasibility": feasibility}

    async def _build_plan(self, state: PlannerGraphState) -> PlannerGraphState:
        planning_state = state["planning_state"]
        request = state["request"]
        origin = state.get("origin")
        destination = planning_state.destination.value

        search_queries = self.query_builder.build_queries(
            planning_state,
            origin=origin,
            destination=destination,
        )
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
            fallback_feasibility = FeasibilityAssessment(
                status=FeasibilityStatus.NOT_FEASIBLE,
                reason=(
                    "The current destination/preferences returned no place matches."
                ),
                follow_up_question=(
                    "Could you share a more specific destination area or one must-visit place?"
                ),
            )
            return {
                "feasibility": fallback_feasibility,
                "search_queries": search_queries,
                "candidates": [],
                "itinerary": [],
                "budget": BudgetEstimate(
                    estimated_total=None,
                    currency_code=planning_state.currency_code,
                    confidence="low",
                    notes=[
                        "Add a more specific destination area or must-visit place so we can refine costs."
                    ],
                ),
                "explanation": fallback_feasibility.reason,
                "warnings": [
                    "Google Places returned zero results for the generated queries."
                ],
                "metadata": PlanMetadata(
                    search_queries=search_queries,
                    candidate_count=0,
                    shortlist_count=0,
                    transport_preference=planning_state.transport_preference,
                    primary_transport_mode=planning_state.transport_modes[0],
                    evaluated_transport_modes=planning_state.transport_modes,
                    workflow_engine=self.workflow_engine,
                ),
            }

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
        route_overview = await self._build_origin_destination_route_overview(
            planning_state=planning_state,
            origin=origin,
            destination=destination,
            evaluated_modes=evaluated_modes,
        )
        origin_place = None
        destination_place = None
        if origin:
            origin_place = await self._resolve_location_point(
                text_query=origin,
                planning_state=planning_state,
            )
        if destination:
            destination_place = await self._resolve_location_point(
                text_query=destination,
                planning_state=planning_state,
            )
        selected_modes = self._selected_modes(route_map)
        primary_mode = selected_modes[0] if selected_modes else evaluated_modes[0]

        itinerary = self.optimizer.build_itinerary(
            planning_state=planning_state,
            candidates=shortlist,
            route_map=route_map,
        )
        arrival_transport_cost, arrival_transport_label = (
            self.optimizer.estimate_arrival_transport_cost(
                origin_location=origin_place.location if origin_place else None,
                destination_location=destination_place.location if destination_place else None,
            )
        )
        budget = self.optimizer.estimate_budget(
            planning_state,
            itinerary,
            arrival_transport_cost=arrival_transport_cost,
            arrival_transport_label=arrival_transport_label,
        )

        itinerary_summary = [
            {
                "day_number": day.day_number,
                "theme": day.theme,
                "stops": [
                    {
                        "name": stop.place.name,
                        "address": stop.place.address,
                        "maps_uri": stop.place.google_maps_uri,
                        "type": stop.place.primary_type,
                        "rating": stop.place.rating,
                        "travel_minutes": (
                            stop.travel_from_previous.duration_minutes
                            if stop.travel_from_previous
                            else None
                        ),
                        "travel": (
                            {
                                "mode": stop.travel_from_previous.mode.value,
                                "duration_minutes": stop.travel_from_previous.duration_minutes,
                                "distance_meters": stop.travel_from_previous.distance_meters,
                                "cost_estimate": stop.travel_from_previous.cost_estimate,
                                "note": stop.travel_from_previous.note,
                            }
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
        candidate_snapshot = [
            {
                "name": place.name,
                "address": place.address,
                "type": place.primary_type,
                "rating": place.rating,
                "maps_uri": place.google_maps_uri,
            }
            for place in shortlist[:8]
        ]
        explanation = await self.gemini_client.explain_itinerary(
            raw_request=request.prompt,
            planning_state=planning_state,
            itinerary_summary=itinerary_summary,
            route_overview=route_overview,
            candidate_snapshot=candidate_snapshot,
        )

        warnings: list[str] = []
        if not self.settings.gemini_api_key_value:
            warnings.append("yo code trash not work")
        if not self.settings.maps_api_key_value:
            warnings.append(
                "MAPS_API_KEY is not configured. Places and routing may fail or use fallback estimates."
            )
        if planning_state.destination.value == "Unknown destination":
            warnings.append("The destination could not be extracted reliably from the request.")

        metadata = PlanMetadata(
            search_queries=search_queries,
            candidate_count=len(candidates),
            shortlist_count=len(shortlist),
            transport_preference=planning_state.transport_preference,
            primary_transport_mode=primary_mode,
            evaluated_transport_modes=evaluated_modes,
            workflow_engine=self.workflow_engine,
        )
        return {
            "search_queries": search_queries,
            "candidates": shortlist,
            "itinerary": itinerary,
            "budget": budget,
            "explanation": explanation,
            "warnings": warnings,
            "metadata": metadata,
            "route_overview": route_overview,
        }

    async def _finalize_response(self, state: PlannerGraphState) -> PlannerGraphState:
        session_id = state["session_id"]
        response_context_limit = max(1, self.settings.planner_response_context_limit)
        planning_state = state["planning_state"]
        completeness = state.get(
            "completeness",
            CompletenessAssessment(
                status=CompletenessStatus.COMPLETE,
                reason="Completeness check was skipped.",
            ),
        )
        feasibility = state.get(
            "feasibility",
            FeasibilityAssessment(
                status=FeasibilityStatus.FEASIBLE,
                reason="Feasibility check was skipped because completeness is incomplete.",
            ),
        )
        warnings = state.get("warnings", [])

        if completeness.status != CompletenessStatus.COMPLETE:
            incomplete_attempts = state.get(
                "incomplete_attempts",
                self.memory_store.get_incomplete_attempts(session_id),
            )
            max_attempts = self.settings.planner_max_incomplete_attempts

            use_approximation = incomplete_attempts >= max_attempts
            if use_approximation:
                follow_up = None
                explanation = await self.gemini_client.approximate_itinerary_from_incomplete(
                    raw_request=planning_state.raw_request,
                    planning_state=planning_state,
                    missing_information=completeness.missing_information,
                )
                warnings = [
                    *warnings,
                    (
                        f"Returned an approximate itinerary after {incomplete_attempts} incomplete attempts."
                    ),
                ]
            else:
                follow_up = completeness.follow_up_question
                explanation = follow_up or completeness.reason

            budget = BudgetEstimate(
                estimated_total=None,
                currency_code=planning_state.currency_code,
                confidence="low",
                notes=[
                    "Share the missing details to unlock a full grounded itinerary with place and route calls."
                ],
            )
            metadata = PlanMetadata(
                transport_preference=planning_state.transport_preference,
                primary_transport_mode=planning_state.transport_modes[0],
                evaluated_transport_modes=planning_state.transport_modes,
                workflow_engine=self.workflow_engine,
            )
            self.memory_store.append_turn(
                session_id,
                role=ConversationRole.ASSISTANT,
                content=explanation,
            )
            metadata.session_turn_count = self.memory_store.turn_count(session_id)
            response = TripPlanResponse(
                session_id=session_id,
                completeness=completeness,
                feasibility=feasibility,
                follow_up_question=follow_up,
                recent_context=self.memory_store.get_recent_turns(
                    session_id,
                    limit=response_context_limit,
                ),
                planning_state=planning_state,
                candidates=[],
                itinerary=[],
                budget=budget,
                explanation=explanation,
                warnings=warnings,
                referenced_blog_posts=state["request"].referenced_blog_posts,
                metadata=metadata,
            )
            return {"response": response}

        if feasibility.status != FeasibilityStatus.FEASIBLE:
            follow_up = feasibility.follow_up_question
            explanation = follow_up or feasibility.reason
            budget = state.get(
                "budget",
                BudgetEstimate(
                    estimated_total=None,
                    currency_code=planning_state.currency_code,
                    confidence="low",
                    notes=[
                        "Please adjust the constraints (for example budget, days, or stop count) and try again."
                    ],
                ),
            )
            metadata = state.get(
                "metadata",
                PlanMetadata(
                    transport_preference=planning_state.transport_preference,
                    primary_transport_mode=planning_state.transport_modes[0],
                    evaluated_transport_modes=planning_state.transport_modes,
                    workflow_engine=self.workflow_engine,
                ),
            )
            self.memory_store.append_turn(
                session_id,
                role=ConversationRole.ASSISTANT,
                content=explanation,
            )
            metadata.session_turn_count = self.memory_store.turn_count(session_id)
            response = TripPlanResponse(
                session_id=session_id,
                completeness=completeness,
                feasibility=feasibility,
                follow_up_question=follow_up,
                recent_context=self.memory_store.get_recent_turns(
                    session_id,
                    limit=response_context_limit,
                ),
                planning_state=planning_state,
                candidates=[],
                itinerary=[],
                budget=budget,
                explanation=explanation,
                warnings=warnings,
                referenced_blog_posts=state["request"].referenced_blog_posts,
                metadata=metadata,
            )
            return {"response": response}

        explanation = state["explanation"]
        self.memory_store.append_turn(
            session_id,
            role=ConversationRole.ASSISTANT,
            content=explanation,
        )
        metadata = state["metadata"]
        metadata.session_turn_count = self.memory_store.turn_count(session_id)
        response = TripPlanResponse(
            session_id=session_id,
            completeness=completeness,
            feasibility=feasibility,
            follow_up_question=None,
            recent_context=self.memory_store.get_recent_turns(
                session_id,
                limit=response_context_limit,
            ),
            planning_state=planning_state,
            candidates=state["candidates"],
            itinerary=state["itinerary"],
            budget=state["budget"],
            explanation=explanation,
            warnings=warnings,
            referenced_blog_posts=state["request"].referenced_blog_posts,
            metadata=metadata,
        )
        return {"response": response}

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

    async def _build_origin_destination_route_overview(
        self,
        *,
        planning_state: PlanningState,
        origin: str | None,
        destination: str | None,
        evaluated_modes: list[TransportMode],
    ) -> dict[str, Any] | None:
        if not origin or not destination:
            return None
        destination_normalized = destination.strip().lower()
        if destination_normalized in {"", "unknown destination"}:
            return None

        origin_place = await self._resolve_location_point(
            text_query=origin,
            planning_state=planning_state,
        )
        destination_place = await self._resolve_location_point(
            text_query=destination,
            planning_state=planning_state,
        )
        if origin_place is None or destination_place is None:
            return None

        options: list[TravelStep] = []
        for mode in evaluated_modes:
            route = await self.routes_client.compute_route(
                origin=origin_place,
                destination=destination_place,
                mode=mode,
                language_code=planning_state.language_code,
            )
            options.append(route)
        if not options:
            return None

        selected = self._choose_route_option(
            options=options,
            transport_preference=planning_state.transport_preference,
        )
        return {
            "origin": origin_place.name,
            "destination": destination_place.name,
            "mode": selected.mode.value,
            "duration_minutes": selected.duration_minutes,
            "distance_meters": selected.distance_meters,
            "cost_estimate": selected.cost_estimate,
            "note": selected.note,
        }

    async def _resolve_location_point(
        self,
        *,
        text_query: str,
        planning_state: PlanningState,
    ) -> CandidatePlace | None:
        try:
            places = await self.places_client.search_text(
                text_query=text_query,
                language_code=planning_state.language_code,
                region_code=planning_state.region_code,
                max_results=1,
            )
        except Exception:
            return None
        if not places:
            return None
        return places[0]

    def _extract_origin(
        self,
        *,
        prompt: str,
        context_block: str,
    ) -> str | None:
        search_text = f"{prompt}\n{context_block}".strip()
        match = re.search(
            r"\bfrom\s+([A-Za-z][A-Za-z\s\-',]{1,80}?)(?:\s+\bto\b|[,.!?]|$)",
            search_text,
            flags=re.IGNORECASE,
        )
        if not match:
            return None
        origin = re.sub(r"\s+", " ", match.group(1)).strip(" ,.-")
        return origin or None

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

    def _build_cache_key(
        self,
        *,
        request: TravelPlanningRequest,
    ) -> str:
        payload = {
            "prompt": request.prompt,
            "referenced_blog_posts": request.referenced_blog_posts,
        }
        normalized = json.dumps(payload, sort_keys=True, ensure_ascii=True)
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    async def _serve_cached_response(
        self,
        *,
        session_id: str,
        request: TravelPlanningRequest,
        cached_response: TripPlanResponse,
    ) -> TripPlanResponse:
        self.memory_store.append_turn(
            session_id,
            role=ConversationRole.USER,
            content=request.prompt,
        )

        if self.settings.planner_cached_response_delay_seconds > 0:
            await asyncio.sleep(self.settings.planner_cached_response_delay_seconds)

        assistant_content = cached_response.follow_up_question or cached_response.explanation
        self.memory_store.append_turn(
            session_id,
            role=ConversationRole.ASSISTANT,
            content=assistant_content,
        )
        self.memory_store.set_last_planning_state(
            session_id,
            cached_response.planning_state.model_copy(deep=True),
        )

        response = cached_response.model_copy(deep=True)
        response.session_id = session_id
        response.referenced_blog_posts = list(request.referenced_blog_posts)
        response.recent_context = self.memory_store.get_recent_turns(
            session_id,
            limit=max(1, self.settings.planner_response_context_limit),
        )
        response.metadata.session_turn_count = self.memory_store.turn_count(session_id)
        return response
