from __future__ import annotations

import re

from app.core.config import Settings
from app.models.planning import BudgetLevel, PlanningState


PREFERENCE_QUERY_FRAGMENTS = {
    "food": "local food, restaurants, cafes, street food",
    "temples": "temples, shrines, spiritual landmarks",
    "nature": "parks, gardens, scenic viewpoints",
    "history": "museums, heritage sites, historic landmarks",
    "shopping": "markets, shopping streets, artisan stores",
    "nightlife": "nightlife, bars, evening spots",
    "hidden_gems": "hidden gems, local favorites, unique places",
    "family": "family friendly attractions",
}


class SearchQueryBuilder:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def build_queries(
        self,
        planning_state: PlanningState,
        *,
        origin: str | None = None,
        destination: str | None = None,
    ) -> list[str]:
        destination = destination or planning_state.destination.value
        queries = [f"best attractions and experiences in {destination}"]

        ranked_preferences = sorted(
            planning_state.soft_preferences,
            key=lambda preference: preference.weight,
            reverse=True,
        )

        for preference in ranked_preferences[:3]:
            fragment = PREFERENCE_QUERY_FRAGMENTS.get(preference.key)
            if fragment:
                queries.append(f"{fragment} in {destination}")

        focus_terms = self._focus_terms(planning_state)
        for term in focus_terms[:3]:
            queries.append(f"best {term} in {destination}")

        raw_request = planning_state.raw_request.lower()
        if origin and self._is_along_the_way_request(raw_request):
            queries.append(f"best stops along route from {origin} to {destination}")
            for term in focus_terms[:2]:
                queries.append(f"best {term} along route from {origin} to {destination}")

        if planning_state.budget.level == BudgetLevel.LOW:
            queries.append(f"free or inexpensive attractions in {destination}")

        unique_queries: list[str] = []
        seen: set[str] = set()
        for query in queries:
            normalized = query.lower()
            if normalized in seen:
                continue
            unique_queries.append(query)
            seen.add(normalized)

        return unique_queries

    def _focus_terms(self, planning_state: PlanningState) -> list[str]:
        terms: list[str] = []

        for preference in planning_state.soft_preferences:
            description_terms = re.findall(r"[a-zA-Z][a-zA-Z\-]{2,}", preference.description.lower())
            key_terms = preference.key.replace("_", " ").split()
            for term in [*key_terms, *description_terms]:
                normalized = term.strip().lower()
                if normalized in {"quality", "style", "preference", "experience"}:
                    continue
                if normalized and normalized not in terms:
                    terms.append(normalized)

        raw_request_terms = re.findall(
            r"\b(ramen|dosa|biryani|sushi|pizza|cafe|coffee|temple|museum|park|nightlife)\b",
            planning_state.raw_request.lower(),
        )
        for term in raw_request_terms:
            if term not in terms:
                terms.append(term)

        return terms

    def _is_along_the_way_request(self, text: str) -> bool:
        markers = (
            "along the way",
            "on the way",
            "along route",
            "en route",
            "between",
        )
        return any(marker in text for marker in markers)
