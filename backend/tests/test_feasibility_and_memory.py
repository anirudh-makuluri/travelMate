from app.models.planning import (
    CompletenessStatus,
    ConversationRole,
    FeasibilityStatus,
    IntentType,
    PlanningState,
)
from app.services.completeness import CompletenessEvaluator
from app.services.feasibility import FeasibilityEvaluator
from app.services.memory import InMemorySessionStore


def test_completeness_requests_destination_when_missing() -> None:
    evaluator = CompletenessEvaluator()
    planning_state = PlanningState(
        raw_request="plan a trip",
        intent_type=IntentType.PLAN_TRIP,
        destination={"value": "Unknown destination", "confidence": 0.2, "source": "inferred"},
        language_code="en",
        region_code="US",
        currency_code="USD",
    )

    assessment = evaluator.evaluate(planning_state)

    assert assessment.status == CompletenessStatus.INCOMPLETE
    assert "destination" in assessment.missing_information
    assert assessment.follow_up_question == (
        "Destination is missing. Share the city/region/country to plan for."
    )


def test_feasibility_flags_unrealistic_hard_budget() -> None:
    evaluator = FeasibilityEvaluator()
    planning_state = PlanningState(
        raw_request="Plan 7 days in Tokyo under $50 total.",
        destination={"value": "Tokyo", "confidence": 0.99, "source": "user"},
        duration={
            "selected_days": 7,
            "min_days": 7,
            "max_days": 7,
            "confidence": 1.0,
            "source": "user",
        },
        budget={
            "amount": 50,
            "currency_code": "USD",
            "hard_cap": True,
            "confidence": 1.0,
        },
        language_code="en",
        region_code="US",
        currency_code="USD",
    )

    assessment = evaluator.evaluate(planning_state)

    assert assessment.status == FeasibilityStatus.NOT_FEASIBLE
    assert "unlikely to be realistic" in assessment.reason.lower()


def test_session_memory_tracks_recent_turns() -> None:
    store = InMemorySessionStore()
    session_id = "session-123"

    store.append_turn(session_id, role=ConversationRole.USER, content="Plan Kyoto.")
    store.append_turn(
        session_id,
        role=ConversationRole.ASSISTANT,
        content="How many days should I plan?",
    )

    turns = store.get_recent_turns(session_id, limit=5)
    context = store.build_context_block(session_id, limit=5)

    assert len(turns) == 2
    assert "user: Plan Kyoto." in context
    assert "assistant: How many days should I plan?" in context


def test_completeness_handles_unknowns_with_specific_follow_up() -> None:
    evaluator = CompletenessEvaluator()
    planning_state = PlanningState(
        raw_request="Plan 3 days in Gandipet with temples and local food.",
        intent_type=IntentType.PLAN_TRIP,
        destination={"value": "Gandipet", "confidence": 1.0, "source": "user"},
        duration={
            "selected_days": 3,
            "min_days": 3,
            "max_days": 3,
            "confidence": 1.0,
            "source": "user",
        },
        unknowns=["party_size", "travel_dates", "origin_city"],
        language_code="en",
        region_code="US",
        currency_code="USD",
    )

    assessment = evaluator.evaluate(planning_state)

    assert assessment.status == CompletenessStatus.INCOMPLETE
    assert assessment.missing_information == ["origin"]
    assert assessment.follow_up_question == (
        "Origin is missing. Share where you will start your trip from."
    )


def test_session_memory_tracks_incomplete_attempts() -> None:
    store = InMemorySessionStore()
    session_id = "session-456"

    assert store.get_incomplete_attempts(session_id) == 0
    assert store.increment_incomplete_attempts(session_id) == 1
    assert store.increment_incomplete_attempts(session_id) == 2
    assert store.get_incomplete_attempts(session_id) == 2

    store.reset_incomplete_attempts(session_id)
    assert store.get_incomplete_attempts(session_id) == 0
