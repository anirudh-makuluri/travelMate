import httpx

from app.clients.gemini import GeminiClient
from app.core.config import Settings


def test_normalize_planning_payload_coerces_constraint_strength() -> None:
    client = GeminiClient(http_client=httpx.AsyncClient(), settings=Settings())
    payload = {
        "raw_request": "test",
        "destination": {"value": "Kyoto"},
        "hard_constraints": [
            {"key": "budget_cap", "description": "cap spend", "strength": "must"},
            {"key": "pace", "description": "relaxed", "strength": "should"},
            {"key": "misc", "description": "misc", "strength": "weird-value"},
        ],
        "transport_preference": "fastest",
    }

    normalized = client._normalize_planning_payload(payload)

    assert normalized["hard_constraints"][0]["strength"] == "hard"
    assert normalized["hard_constraints"][1]["strength"] == "soft"
    assert normalized["hard_constraints"][2]["strength"] == "soft"
    assert normalized["transport_preference"] == "optimize_for_time"


def test_normalize_planning_payload_coerces_soft_preference_weights() -> None:
    client = GeminiClient(http_client=httpx.AsyncClient(), settings=Settings())
    payload = {
        "raw_request": "test",
        "destination": {"value": "Kyoto"},
        "soft_preferences": [
            {"key": "food", "weight": "high"},
            {"key": "nature", "weight": "medium"},
            {"key": "museums", "weight": "low"},
            {"key": "shopping", "weight": "0.72"},
            {"key": "pace", "weight": "unknown"},
        ],
    }

    normalized = client._normalize_planning_payload(payload)

    assert normalized["soft_preferences"][0]["weight"] == 0.9
    assert normalized["soft_preferences"][1]["weight"] == 0.6
    assert normalized["soft_preferences"][2]["weight"] == 0.3
    assert normalized["soft_preferences"][3]["weight"] == 0.72
    assert normalized["soft_preferences"][4]["weight"] == 0.5


def test_normalize_planning_payload_fills_missing_destination_fields() -> None:
    client = GeminiClient(http_client=httpx.AsyncClient(), settings=Settings())
    payload = {
        "raw_request": "Build me a weekend food trip with a moderate budget.",
        "destination": {"value": None, "source": "unknown"},
    }

    normalized = client._normalize_planning_payload(payload)

    assert normalized["destination"]["value"] == "Unknown destination"
    assert normalized["destination"]["source"] == "default"
    assert normalized["destination"]["confidence"] == 0.2
