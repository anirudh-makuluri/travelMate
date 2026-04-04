from __future__ import annotations

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

    def build_queries(self, planning_state: PlanningState) -> list[str]:
        destination = planning_state.destination.value
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
