from app.core.config import Settings
from app.models.planning import (
    BudgetLevel,
    BudgetPreference,
    CandidatePlace,
    DayPlan,
    PlaceLocation,
    PlanningState,
    PreferenceWeight,
    TransportMode,
    TransportPreference,
    TravelStep,
)
from app.services.optimizer import ItineraryOptimizer


def make_place(
    place_id: str,
    name: str,
    lat: float,
    lng: float,
    primary_type: str,
    rating: float,
    price_level: int,
) -> CandidatePlace:
    return CandidatePlace(
        place_id=place_id,
        name=name,
        location=PlaceLocation(lat=lat, lng=lng),
        primary_type=primary_type,
        rating=rating,
        price_level=price_level,
        user_rating_count=500,
    )


def test_optimizer_builds_balanced_itinerary() -> None:
    settings = Settings(planner_shortlist_size=4, planner_default_days=2)
    optimizer = ItineraryOptimizer(settings=settings)

    planning_state = PlanningState(
        raw_request="Plan 2 days in Kyoto with temples and food",
        destination={"value": "Kyoto", "confidence": 1.0, "source": "user"},
        duration={"selected_days": 2, "confidence": 1.0, "source": "user"},
        budget=BudgetPreference(level=BudgetLevel.MODERATE, currency_code="USD"),
        requested_stops=4,
        transport_preference=TransportPreference.OPTIMIZE_TIME,
        transport_modes=[TransportMode.WALK, TransportMode.TRANSIT],
        soft_preferences=[
            PreferenceWeight(key="temples", description="temples", weight=0.9),
            PreferenceWeight(key="food", description="food", weight=0.8),
        ],
        language_code="en",
        region_code="US",
        currency_code="USD",
    )

    places = [
        make_place("1", "Kiyomizu Temple", 35.0, 135.0, "hindu_temple", 4.8, 1),
        make_place("2", "Nishiki Market", 35.01, 135.01, "market", 4.7, 2),
        make_place("3", "Arashiyama Grove", 35.02, 135.02, "park", 4.6, 0),
        make_place("4", "Tea House", 35.03, 135.03, "cafe", 4.5, 2),
    ]
    shortlist = optimizer.shortlist_candidates(planning_state, places)

    route_map = {
        (origin.place_id, destination.place_id): TravelStep(
            mode=TransportMode.WALK,
            duration_minutes=15,
            distance_meters=1000,
        )
        for origin in shortlist
        for destination in shortlist
        if origin.place_id != destination.place_id
    }

    itinerary = optimizer.build_itinerary(
        planning_state=planning_state,
        candidates=shortlist,
        route_map=route_map,
    )

    assert len(itinerary) == 2
    assert all(isinstance(day, DayPlan) for day in itinerary)
    assert sum(len(day.stops) for day in itinerary) == 4


def test_budget_estimate_uses_price_levels() -> None:
    settings = Settings()
    optimizer = ItineraryOptimizer(settings=settings)

    day = DayPlan(
        day_number=1,
        theme="Food day",
        stops=[
            {
                "order": 1,
                "place": make_place("1", "Cafe", 0, 0, "cafe", 4.5, 2),
                "rationale": "Good fit",
                "estimated_visit_minutes": 60,
            },
            {
                "order": 2,
                "place": make_place("2", "Museum", 0, 0, "museum", 4.6, 3),
                "rationale": "Good fit",
                "estimated_visit_minutes": 90,
            },
        ],
    )
    planning_state = PlanningState(
        raw_request="Kyoto trip",
        destination={"value": "Kyoto", "confidence": 1.0, "source": "user"},
        budget=BudgetPreference(level=BudgetLevel.MODERATE, currency_code="USD"),
        transport_preference=TransportPreference.OPTIMIZE_TIME,
        language_code="en",
        region_code="US",
        currency_code="USD",
    )

    budget = optimizer.estimate_budget(planning_state, [day])
    assert budget.estimated_total == 95.0
    assert budget.currency_code == "USD"


def test_budget_estimate_includes_transport_costs() -> None:
    settings = Settings()
    optimizer = ItineraryOptimizer(settings=settings)

    day = DayPlan(
        day_number=1,
        theme="Transit day",
        stops=[
            {
                "order": 1,
                "place": make_place("1", "Station Cafe", 0, 0, "cafe", 4.5, 1),
                "rationale": "Good fit",
                "estimated_visit_minutes": 60,
            },
            {
                "order": 2,
                "place": make_place("2", "Museum", 0, 1, "museum", 4.6, 2),
                "rationale": "Good fit",
                "estimated_visit_minutes": 90,
                "travel_from_previous": {
                    "mode": "transit",
                    "duration_minutes": 20,
                    "distance_meters": 5000,
                    "cost_estimate": 3.25,
                },
            },
        ],
    )
    planning_state = PlanningState(
        raw_request="Kyoto trip",
        destination={"value": "Kyoto", "confidence": 1.0, "source": "user"},
        budget=BudgetPreference(level=BudgetLevel.MODERATE, currency_code="USD"),
        transport_preference=TransportPreference.OPTIMIZE_MONEY,
        language_code="en",
        region_code="US",
        currency_code="USD",
    )

    budget = optimizer.estimate_budget(planning_state, [day])
    assert budget.estimated_total == 45.25
