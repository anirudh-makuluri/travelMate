from __future__ import annotations

import json
import re
from typing import Any

from app.clients.base import BaseGoogleClient
from app.models.planning import (
    BudgetLevel,
    BudgetPreference,
    ConstraintSource,
    DestinationSelection,
    IntentType,
    PlanningConstraint,
    PlanningState,
    PreferenceWeight,
    TransportPreference,
    TransportMode,
)


PLANNING_STATE_SYSTEM_PROMPT = """
You are a travel planning parser. Convert free-form user requests into a JSON object.
Preserve flexibility by separating:
- hard_constraints
- soft_preferences
- unknowns
- assumptions

Return JSON only. Do not wrap the answer in markdown.
Keep uncertainty explicit through confidence scores.
Do not invent exact budgets, dates, or stop counts when the user did not state them.
""".strip()


class GeminiClient(BaseGoogleClient):
    async def extract_planning_state(
        self,
        *,
        prompt: str,
        language_code: str,
        region_code: str,
        currency_code: str,
        default_days: int,
        default_stops_per_day: int,
    ) -> PlanningState:
        if not self.settings.planner_enable_google_calls or not self.settings.gemini_api_key_value:
            return self._heuristic_planning_state(
                prompt=prompt,
                language_code=language_code,
                region_code=region_code,
                currency_code=currency_code,
                default_days=default_days,
                default_stops_per_day=default_stops_per_day,
            )

        request_prompt = f"""
Analyze the user request and return a planning state as JSON.

User request:
{prompt}

Output keys:
- raw_request: string
- intent_type: "plan_trip" or "ask_travel_question"
- destination: {{ value: string, confidence: float, source: "user"|"inferred"|"default" }}
- duration: {{ selected_days: int|null, min_days: int|null, max_days: int|null, confidence: float, source: "user"|"inferred"|"default" }}
- budget: {{ amount: number|null, currency_code: string|null, level: "low"|"moderate"|"high"|"luxury"|null, scope: "day"|"trip", hard_cap: boolean, confidence: float }}
- party: {{ adults: int, children: int }}
- requested_stops: int|null
- transport_modes: array of "walk"|"transit"|"drive"|"bicycle"
- max_walk_minutes: int|null
- hard_constraints: array of {{ key, description, strength, value, source }}
- soft_preferences: array of {{ key, description, weight, source }}
- unknowns: array of string
- assumptions: array of string
- language_code: string
- region_code: string
- currency_code: string

Defaults:
- language_code = "{language_code}"
- region_code = "{region_code}"
- currency_code = "{currency_code}"
- if duration is unspecified, selected_days can be null and note the likely range in min_days/max_days
- if requested_stops is unspecified, leave it null
""".strip()

        url = (
            f"{self.settings.gemini_base_url}/models/"
            f"{self.settings.gemini_model}:generateContent"
        )
        payload = {
            "system_instruction": {
                "parts": [{"text": PLANNING_STATE_SYSTEM_PROMPT}],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": request_prompt}],
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }
        data = await self.post_json(
            url,
            json_payload=payload,
            params={"key": self.require_gemini_api_key()},
        )
        raw_text = self._extract_text(data)
        parsed = self._normalize_planning_payload(self._load_json(raw_text))
        planning_state = PlanningState.model_validate(parsed)

        if not planning_state.transport_modes:
            planning_state.transport_modes = [TransportMode.WALK, TransportMode.TRANSIT]
        if planning_state.duration.selected_days is None and planning_state.duration.max_days is None:
            planning_state.duration.min_days = default_days
            planning_state.duration.max_days = default_days
            planning_state.assumptions.append(
                f"Defaulted to a {default_days}-day planning window because the user did not specify duration."
            )
        if planning_state.requested_stops is None and planning_state.duration.selected_days:
            planning_state.requested_stops = (
                planning_state.duration.selected_days * default_stops_per_day
            )

        return planning_state

    async def explain_itinerary(
        self,
        *,
        raw_request: str,
        planning_state: PlanningState,
        itinerary_summary: list[dict[str, Any]],
    ) -> str:
        if not self.settings.planner_enable_google_calls or not self.settings.gemini_api_key_value:
            return self._fallback_explanation(planning_state, itinerary_summary)

        explanation_prompt = f"""
You are a travel planner assistant. Explain the itinerary in the user's preferred language.
Keep the answer helpful and concise.

User request:
{raw_request}

Planning state:
{planning_state.model_dump_json(indent=2)}

Itinerary summary:
{json.dumps(itinerary_summary, indent=2)}

Requirements:
- Explain why the stop mix fits the request
- Call out any assumptions or tradeoffs
- Mention pacing and transport logic
- Do not invent facts outside the planning state or itinerary summary
""".strip()

        url = (
            f"{self.settings.gemini_base_url}/models/"
            f"{self.settings.gemini_model}:generateContent"
        )
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": explanation_prompt}],
                }
            ],
            "generationConfig": {"temperature": 0.4},
        }
        data = await self.post_json(
            url,
            json_payload=payload,
            params={"key": self.require_gemini_api_key()},
        )
        return self._extract_text(data).strip()

    def _extract_text(self, payload: dict[str, Any]) -> str:
        candidates = payload.get("candidates") or []
        if not candidates:
            raise ValueError("Gemini returned no candidates.")
        parts = candidates[0].get("content", {}).get("parts", [])
        texts = [part.get("text", "") for part in parts if part.get("text")]
        if not texts:
            raise ValueError("Gemini response did not include text content.")
        return "\n".join(texts)

    def _load_json(self, raw_text: str) -> dict[str, Any]:
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        return json.loads(cleaned)

    def _normalize_planning_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        payload = dict(payload)

        for constraint in payload.get("hard_constraints", []) or []:
            if not isinstance(constraint, dict):
                continue
            raw_strength = str(constraint.get("strength", "")).strip().lower()
            constraint["strength"] = self._normalize_strength(raw_strength)

        for preference in payload.get("soft_preferences", []) or []:
            if not isinstance(preference, dict):
                continue
            preference["weight"] = self._normalize_weight(preference.get("weight"))

        transport_preference = payload.get("transport_preference")
        if isinstance(transport_preference, str):
            payload["transport_preference"] = self._normalize_transport_preference(
                transport_preference
            )

        return payload

    def _normalize_strength(self, raw_strength: str) -> str:
        mapping = {
            "hard": "hard",
            "must": "hard",
            "required": "hard",
            "strict": "hard",
            "mandatory": "hard",
            "soft": "soft",
            "should": "soft",
            "prefer": "soft",
            "optional": "soft",
            "nice_to_have": "soft",
        }
        return mapping.get(raw_strength, "soft")

    def _normalize_weight(self, raw_weight: Any) -> float:
        if isinstance(raw_weight, (int, float)):
            return self._clamp_weight(float(raw_weight))

        if isinstance(raw_weight, str):
            normalized = raw_weight.strip().lower()
            labeled_weights = {
                "high": 0.9,
                "medium": 0.6,
                "med": 0.6,
                "low": 0.3,
                "very_high": 1.0,
                "very_low": 0.15,
            }
            if normalized in labeled_weights:
                return labeled_weights[normalized]
            try:
                return self._clamp_weight(float(normalized))
            except ValueError:
                return 0.5

        return 0.5

    def _clamp_weight(self, value: float) -> float:
        return max(0.0, min(1.0, value))

    def _normalize_transport_preference(self, raw_value: str) -> str:
        normalized = raw_value.strip().lower()
        mapping = {
            "own_transport": "own_transport",
            "car": "own_transport",
            "drive": "own_transport",
            "public_transport": "public_transport",
            "transit": "public_transport",
            "hybrid": "hybrid",
            "mixed": "hybrid",
            "mix": "hybrid",
            "optimize_for_time": "optimize_for_time",
            "time": "optimize_for_time",
            "fastest": "optimize_for_time",
            "optimize_for_money": "optimize_for_money",
            "money": "optimize_for_money",
            "cheapest": "optimize_for_money",
        }
        return mapping.get(normalized, "optimize_for_time")

    def _heuristic_planning_state(
        self,
        *,
        prompt: str,
        language_code: str,
        region_code: str,
        currency_code: str,
        default_days: int,
        default_stops_per_day: int,
    ) -> PlanningState:
        lower_prompt = prompt.lower()
        day_match = re.search(r"\b(\d+)\s+days?\b", lower_prompt)
        stop_match = re.search(r"\b(\d+)\s+(?:spots?|places?|stops?)\b", lower_prompt)
        budget_match = re.search(
            r"\b(?:budget|under|within)\s+\$?(\d+(?:\.\d+)?)",
            lower_prompt,
        )
        destination_match = re.search(
            r"\b(?:in|to|for)\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+\b(?:for|with|under|within|on)\b|[,.!?]|$)",
            prompt,
            re.IGNORECASE,
        )

        duration_days = int(day_match.group(1)) if day_match else None
        requested_stops = int(stop_match.group(1)) if stop_match else None
        budget_amount = float(budget_match.group(1)) if budget_match else None
        destination = destination_match.group(1).strip() if destination_match else "Unknown destination"

        transport_modes: list[TransportMode] = []
        if "transit" in lower_prompt or "metro" in lower_prompt or "train" in lower_prompt:
            transport_modes.append(TransportMode.TRANSIT)
        if "drive" in lower_prompt or "car" in lower_prompt or "road trip" in lower_prompt:
            transport_modes.append(TransportMode.DRIVE)
        if "bike" in lower_prompt or "cycle" in lower_prompt:
            transport_modes.append(TransportMode.BICYCLE)
        if not transport_modes:
            transport_modes = [TransportMode.WALK, TransportMode.TRANSIT]

        soft_preferences: list[PreferenceWeight] = []
        keyword_preferences = {
            "food": ["food", "restaurant", "eat", "cafe"],
            "temples": ["temple", "shrine"],
            "nature": ["park", "nature", "garden", "scenic"],
            "history": ["museum", "history", "heritage"],
            "shopping": ["shopping", "market"],
            "nightlife": ["nightlife", "bar", "club"],
            "hidden_gems": ["hidden", "local", "unique"],
            "relaxed": ["relaxed", "chill", "slow"],
        }
        for key, keywords in keyword_preferences.items():
            if any(word in lower_prompt for word in keywords):
                soft_preferences.append(
                    PreferenceWeight(
                        key=key,
                        description=f"Preference inferred from the user's request: {key}.",
                        weight=0.7 if key != "relaxed" else 0.9,
                        source=ConstraintSource.INFERRED,
                    )
                )

        hard_constraints: list[PlanningConstraint] = []
        if "wheelchair" in lower_prompt:
            hard_constraints.append(
                PlanningConstraint(
                    key="wheelchair_accessible",
                    description="Only include wheelchair-accessible options.",
                    strength="hard",
                    value=True,
                    source=ConstraintSource.USER,
                )
            )

        assumptions = [
            "Gemini was unavailable, so the planning state was created with heuristic parsing."
        ]
        if duration_days is None:
            assumptions.append(
                f"Used a default {default_days}-day planning window because duration was not explicit."
            )

        return PlanningState(
            raw_request=prompt,
            intent_type=IntentType.PLAN_TRIP,
            destination=DestinationSelection(
                value=destination,
                confidence=0.65 if destination != "Unknown destination" else 0.2,
                source=ConstraintSource.INFERRED,
            ),
            duration={
                "selected_days": duration_days,
                "min_days": duration_days or default_days,
                "max_days": duration_days or default_days,
                "confidence": 0.8 if duration_days else 0.4,
                "source": ConstraintSource.USER if duration_days else ConstraintSource.DEFAULT,
            },
            budget=BudgetPreference(
                amount=budget_amount,
                currency_code=currency_code,
                level=self._infer_budget_level(lower_prompt, budget_amount),
                hard_cap=budget_amount is not None,
                confidence=0.75 if budget_amount is not None else 0.4,
            ),
            requested_stops=requested_stops or (
                (duration_days or default_days) * default_stops_per_day
            ),
            transport_preference=TransportPreference.OPTIMIZE_TIME,
            transport_modes=transport_modes,
            hard_constraints=hard_constraints,
            soft_preferences=soft_preferences,
            unknowns=["hotel_area", "daily_start_time"],
            assumptions=assumptions,
            language_code=language_code,
            region_code=region_code,
            currency_code=currency_code,
        )

    def _fallback_explanation(
        self,
        planning_state: PlanningState,
        itinerary_summary: list[dict[str, Any]],
    ) -> str:
        day_count = len(itinerary_summary)
        preference_names = ", ".join(
            preference.key for preference in planning_state.soft_preferences[:3]
        ) or "general sightseeing"
        return (
            f"This plan covers {day_count} day(s) in {planning_state.destination.value} with a focus on "
            f"{preference_names}. Stops were grouped to keep daily travel reasonable, and the order favors "
            f"higher-match places before adding longer transfers. Review the assumptions section because the "
            f"explanation used the local fallback path rather than Gemini."
        )

    def _infer_budget_level(
        self,
        prompt: str,
        budget_amount: float | None,
    ) -> BudgetLevel | None:
        if "luxury" in prompt:
            return BudgetLevel.LUXURY
        if "cheap" in prompt or "budget" in prompt:
            return BudgetLevel.LOW
        if "moderate" in prompt or "mid-range" in prompt:
            return BudgetLevel.MODERATE
        if "premium" in prompt or "high-end" in prompt:
            return BudgetLevel.HIGH
        if budget_amount is None:
            return None
        if budget_amount < 150:
            return BudgetLevel.LOW
        if budget_amount < 500:
            return BudgetLevel.MODERATE
        if budget_amount < 1500:
            return BudgetLevel.HIGH
        return BudgetLevel.LUXURY
