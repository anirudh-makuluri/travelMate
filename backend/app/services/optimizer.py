from __future__ import annotations

import math
import re

from app.core.config import Settings
from app.models.planning import (
    BudgetEstimate,
    BudgetLevel,
    CandidatePlace,
    DayPlan,
    PlannedStop,
    PlanningState,
    PlaceLocation,
    TransportPreference,
    TravelStep,
)


PRICE_LEVEL_ESTIMATES = {
    0: 0,
    1: 12,
    2: 30,
    3: 65,
    4: 120,
}


class ItineraryOptimizer:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def shortlist_candidates(
        self,
        planning_state: PlanningState,
        candidates: list[CandidatePlace],
    ) -> list[CandidatePlace]:
        candidates = self._apply_exclusion_constraints(planning_state, candidates)
        scored = []
        for candidate in candidates:
            score = self._score_candidate(planning_state, candidate)
            candidate.match_score = round(score, 3)
            scored.append(candidate)

        scored.sort(key=lambda candidate: candidate.match_score, reverse=True)
        shortlist: list[CandidatePlace] = []
        type_counts: dict[str, int] = {}

        for candidate in scored:
            primary_type = candidate.primary_type or "unknown"
            if type_counts.get(primary_type, 0) >= 2:
                continue
            shortlist.append(candidate)
            type_counts[primary_type] = type_counts.get(primary_type, 0) + 1
            if len(shortlist) >= self.settings.planner_shortlist_size:
                break

        return shortlist or scored[: self.settings.planner_shortlist_size]

    def build_itinerary(
        self,
        planning_state: PlanningState,
        candidates: list[CandidatePlace],
        route_map: dict[tuple[str, str], TravelStep],
    ) -> list[DayPlan]:
        if not candidates:
            return []

        days = (
            planning_state.duration.selected_days
            or planning_state.duration.max_days
            or planning_state.duration.min_days
            or self.settings.planner_default_days
        )
        requested_total_stops = (
            planning_state.requested_stops
            or days * self.settings.planner_default_stops_per_day
        )
        selected = candidates[: min(len(candidates), requested_total_stops)]
        remaining = selected.copy()
        itinerary: list[DayPlan] = []

        for day_number in range(1, days + 1):
            if not remaining:
                break
            remaining_days = days - day_number + 1
            target_stops = max(1, math.ceil(len(remaining) / remaining_days))
            day_places = self._order_day(planning_state, remaining, route_map)
            day_places = day_places[:target_stops]

            for place in day_places:
                remaining.remove(place)

            stops: list[PlannedStop] = []
            total_travel_minutes = 0
            total_visit_minutes = 0
            previous_place: CandidatePlace | None = None

            for order, place in enumerate(day_places, start=1):
                travel_step = None
                if previous_place is not None:
                    travel_step = route_map.get((previous_place.place_id, place.place_id))
                    if travel_step and travel_step.duration_minutes:
                        total_travel_minutes += travel_step.duration_minutes

                visit_minutes = self._estimate_visit_minutes(place)
                total_visit_minutes += visit_minutes
                stops.append(
                    PlannedStop(
                        order=order,
                        place=place,
                        rationale=self._build_rationale(planning_state, place),
                        estimated_visit_minutes=visit_minutes,
                        travel_from_previous=travel_step,
                    )
                )
                previous_place = place

            itinerary.append(
                DayPlan(
                    day_number=day_number,
                    theme=self._day_theme(planning_state, day_places),
                    stops=stops,
                    total_travel_minutes=total_travel_minutes,
                    total_visit_minutes=total_visit_minutes,
                )
            )

        return itinerary

    def estimate_budget(
        self,
        planning_state: PlanningState,
        itinerary: list[DayPlan],
        *,
        arrival_transport_cost: float | None = None,
        arrival_transport_label: str | None = None,
    ) -> BudgetEstimate:
        total = 0.0
        price_level_count = 0

        for day in itinerary:
            for stop in day.stops:
                price_level = stop.place.price_level
                if price_level is not None:
                    price_level_count += 1
                    total += PRICE_LEVEL_ESTIMATES.get(price_level, 0)
                if stop.travel_from_previous and stop.travel_from_previous.cost_estimate is not None:
                    total += stop.travel_from_previous.cost_estimate

        if arrival_transport_cost is not None:
            total += arrival_transport_cost

        notes = [
            "This estimate uses place price levels as rough spend signals.",
            "Transport costs are estimated heuristically from route distance and mode.",
            "Lodging and ticket inventory are not priced exactly in this MVP.",
        ]
        if arrival_transport_cost is not None and arrival_transport_label is not None:
            notes.append(
                f"Includes an estimated {arrival_transport_label} cost of {arrival_transport_cost:.2f} {planning_state.currency_code}."
            )
        confidence = "medium" if price_level_count >= max(1, len(itinerary)) else "low"

        if planning_state.budget.amount is not None and total > planning_state.budget.amount:
            notes.append("The estimated spend exceeds the user-specified budget cap.")

        return BudgetEstimate(
            estimated_total=round(total, 2) if total else None,
            currency_code=planning_state.currency_code,
            confidence=confidence,
            notes=notes,
        )

    def estimate_arrival_transport_cost(
        self,
        *,
        origin_location: PlaceLocation | None,
        destination_location: PlaceLocation | None,
    ) -> tuple[float | None, str | None]:
        if origin_location is None or destination_location is None:
            return None, None

        distance_km = self._haversine_distance(origin_location, destination_location) / 1000
        if distance_km < 400:
            return None, None

        if distance_km >= 1200:
            # Heuristic round-trip economy flight estimate.
            estimated_cost = 120 + distance_km * 0.09
            return round(estimated_cost, 2), "round-trip flight"

        estimated_cost = max(30.0, distance_km * 0.12)
        return round(estimated_cost, 2), "arrival transfer"

    def _haversine_distance(self, a: PlaceLocation, b: PlaceLocation) -> float:
        radius_meters = 6_371_000
        lat1 = math.radians(a.lat)
        lat2 = math.radians(b.lat)
        delta_lat = math.radians(b.lat - a.lat)
        delta_lng = math.radians(b.lng - a.lng)

        haversine = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lng / 2) ** 2
        )
        return 2 * radius_meters * math.asin(math.sqrt(haversine))

    def _score_candidate(
        self,
        planning_state: PlanningState,
        candidate: CandidatePlace,
    ) -> float:
        rating_component = (candidate.rating or 0) * 20
        popularity_component = min((candidate.user_rating_count or 0) / 100, 20)
        preference_component = self._preference_match(planning_state, candidate)
        price_component = self._price_fit(planning_state, candidate)
        editorial_component = 6 if candidate.editorial_summary else 0
        return (
            rating_component
            + popularity_component
            + preference_component
            + price_component
            + editorial_component
        )

    def _preference_match(
        self,
        planning_state: PlanningState,
        candidate: CandidatePlace,
    ) -> float:
        searchable = " ".join(
            filter(
                None,
                [
                    candidate.name.lower(),
                    (candidate.primary_type or "").lower(),
                    (candidate.editorial_summary or "").lower(),
                ],
            )
        )
        score = 0.0
        weighted_token_groups = self._weighted_preference_tokens(planning_state)
        for tokens, weight in weighted_token_groups:
            if any(token in searchable for token in tokens):
                score += weight * 45

        if not planning_state.soft_preferences:
            score += 10
        return score

    def _weighted_preference_tokens(
        self,
        planning_state: PlanningState,
    ) -> list[tuple[list[str], float]]:
        weighted: list[tuple[list[str], float]] = []
        for preference in planning_state.soft_preferences:
            key_tokens = preference.key.replace("_", " ").lower().split()
            description_tokens = re.findall(
                r"[a-zA-Z][a-zA-Z\-]{2,}",
                preference.description.lower(),
            )
            tokens = [
                token
                for token in [*key_tokens, *description_tokens]
                if token not in {"quality", "style", "preference", "experience"}
            ]
            if tokens:
                weighted.append((tokens, preference.weight))

        for constraint in planning_state.hard_constraints:
            if constraint.value is None:
                continue
            description = constraint.description.lower()
            value = str(constraint.value).lower()
            if any(token in description for token in ["exclude", "avoid"]):
                continue
            tokens = re.findall(r"[a-zA-Z][a-zA-Z\-]{2,}", f"{description} {value}")
            if tokens:
                weighted.append((tokens, 0.65))

        return weighted

    def _apply_exclusion_constraints(
        self,
        planning_state: PlanningState,
        candidates: list[CandidatePlace],
    ) -> list[CandidatePlace]:
        exclusion_phrases: list[str] = []

        for constraint in planning_state.hard_constraints:
            key = constraint.key.lower()
            description = constraint.description.lower()
            value = str(constraint.value).strip().lower() if constraint.value is not None else ""
            is_exclusion = (
                "exclude" in key
                or "exclude" in description
                or "avoid" in key
                or "avoid" in description
            )
            if not is_exclusion:
                continue
            if value in {"false", "0", "no"}:
                continue
            inferred_from_key = key.replace("exclude_", "").replace("avoid_", "").strip("_")
            if inferred_from_key:
                exclusion_phrases.append(inferred_from_key.replace("_", " "))
            if value not in {"true", "1", "yes"}:
                exclusion_phrases.append(value)
            cleaned_description = re.sub(
                r"\b(do not include|don't include|exclude|avoid)\b",
                "",
                description,
            ).strip(" .,-")
            if cleaned_description:
                exclusion_phrases.append(cleaned_description)

        normalized_phrases = []
        for phrase in exclusion_phrases:
            normalized = re.sub(r"\s+", " ", phrase.strip().lower())
            if len(normalized) < 3:
                continue
            if normalized in {"true", "false", "yes", "no"}:
                continue
            if normalized not in normalized_phrases:
                normalized_phrases.append(normalized)

        if not normalized_phrases:
            return candidates

        filtered: list[CandidatePlace] = []
        for candidate in candidates:
            name = candidate.name.lower()
            if any(phrase in name for phrase in normalized_phrases):
                continue
            filtered.append(candidate)

        return filtered

    def _price_fit(self, planning_state: PlanningState, candidate: CandidatePlace) -> float:
        if candidate.price_level is None or planning_state.budget.level is None:
            return 0.0

        if planning_state.budget.level == BudgetLevel.LOW:
            return max(0.0, 18 - candidate.price_level * 5)
        if planning_state.budget.level == BudgetLevel.MODERATE:
            return max(0.0, 12 - abs(candidate.price_level - 2) * 4)
        if planning_state.budget.level == BudgetLevel.HIGH:
            return max(0.0, 10 - abs(candidate.price_level - 3) * 3)
        if planning_state.budget.level == BudgetLevel.LUXURY:
            return candidate.price_level * 3
        return 0.0

    def _order_day(
        self,
        planning_state: PlanningState,
        places: list[CandidatePlace],
        route_map: dict[tuple[str, str], TravelStep],
    ) -> list[CandidatePlace]:
        if not places:
            return []

        ordered = [max(places, key=lambda place: place.match_score)]
        remaining = [place for place in places if place.place_id != ordered[0].place_id]

        while remaining:
            previous = ordered[-1]
            next_place = max(
                remaining,
                key=lambda candidate: self._transition_score(
                    planning_state,
                    previous,
                    candidate,
                    route_map,
                ),
            )
            ordered.append(next_place)
            remaining.remove(next_place)

        return ordered

    def _transition_score(
        self,
        planning_state: PlanningState,
        previous: CandidatePlace,
        candidate: CandidatePlace,
        route_map: dict[tuple[str, str], TravelStep],
    ) -> float:
        base_score = candidate.match_score
        route = route_map.get((previous.place_id, candidate.place_id))
        if route is None:
            return base_score - 10

        duration = route.duration_minutes or 20
        cost = route.cost_estimate or 0

        if planning_state.transport_preference == TransportPreference.OPTIMIZE_MONEY:
            return base_score - cost * 6 - duration * 0.1
        if planning_state.transport_preference == TransportPreference.HYBRID:
            return base_score - duration * 0.3 - cost * 3
        return base_score - duration * 0.5 - cost * 0.2

    def _estimate_visit_minutes(self, place: CandidatePlace) -> int:
        if place.primary_type and "museum" in place.primary_type:
            return 120
        if place.primary_type and any(
            token in place.primary_type for token in ["restaurant", "cafe", "food"]
        ):
            return 75
        return 90

    def _build_rationale(
        self,
        planning_state: PlanningState,
        place: CandidatePlace,
    ) -> str:
        preference_keys = [preference.key for preference in planning_state.soft_preferences]
        aligned_preferences = [
            key.replace("_", " ")
            for key in preference_keys
            if key.replace("_", " ") in (place.editorial_summary or "").lower()
            or key.replace("_", " ") in (place.primary_type or "").lower()
            or key.replace("_", " ") in place.name.lower()
        ]

        if aligned_preferences:
            return (
                f"Chosen because it aligns with the user's preference for "
                f"{', '.join(aligned_preferences[:2])}."
            )
        if place.rating:
            return f"Chosen as a strong local option with a {place.rating:.1f} rating."
        return "Chosen to keep the day balanced and geographically reasonable."

    def _day_theme(
        self,
        planning_state: PlanningState,
        day_places: list[CandidatePlace],
    ) -> str:
        if not day_places:
            return "Flexible exploration"

        preferred = [
            preference.key.replace("_", " ")
            for preference in planning_state.soft_preferences[:2]
        ]
        if preferred:
            return f"{' + '.join(preferred).title()} day"
        primary_types = [place.primary_type for place in day_places if place.primary_type]
        if primary_types:
            return f"{primary_types[0].replace('_', ' ').title()} day"
        return "Flexible exploration"
