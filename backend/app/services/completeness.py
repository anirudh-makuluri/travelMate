from __future__ import annotations

import re

from app.models.planning import (
    CompletenessAssessment,
    CompletenessStatus,
    IntentType,
    PlanningState,
)


class CompletenessEvaluator:
    """Determines if we have enough information to materialize an itinerary."""

    REQUIRED_PRIORITY_ORDER = ["destination", "origin"]

    def evaluate(self, planning_state: PlanningState) -> CompletenessAssessment:
        if planning_state.intent_type == IntentType.ASK_TRAVEL_QUESTION:
            return CompletenessAssessment(
                status=CompletenessStatus.INCOMPLETE,
                reason="Please confirm whether you want a full itinerary plan.",
                missing_information=["trip_planning_intent"],
                follow_up_question=(
                    "Confirm whether you want a full itinerary plan or a quick travel answer."
                ),
            )

        missing_information = self._collect_missing_information(planning_state)
        if missing_information:
            top_missing = missing_information[0]
            prompt = self._follow_up_question(top_missing)
            return CompletenessAssessment(
                status=CompletenessStatus.INCOMPLETE,
                reason=prompt,
                missing_information=missing_information,
                follow_up_question=prompt,
            )

        return CompletenessAssessment(
            status=CompletenessStatus.COMPLETE,
            reason="The request has enough detail to proceed to feasibility checks.",
            missing_information=[],
            follow_up_question=None,
        )

    def _collect_missing_information(self, planning_state: PlanningState) -> list[str]:
        checks = {
            "destination": self._is_destination_missing(planning_state),
            "origin": self._is_origin_missing(planning_state),
        }
        return [key for key in self.REQUIRED_PRIORITY_ORDER if checks[key]]

    def _is_destination_missing(self, planning_state: PlanningState) -> bool:
        destination_value = planning_state.destination.value.strip().lower()
        return destination_value in {"", "unknown destination"} or planning_state.destination.confidence < 0.35

    def _is_origin_missing(self, planning_state: PlanningState) -> bool:
        raw_request = planning_state.raw_request
        has_origin_in_prompt = bool(
            re.search(r"\bfrom\s+[A-Za-z][A-Za-z\s\-']+", raw_request, flags=re.IGNORECASE)
        )
        has_origin_unknown = any(
            "origin" in unknown.strip().lower()
            for unknown in planning_state.unknowns
        )
        return has_origin_unknown or not has_origin_in_prompt

    def _follow_up_question(self, missing_field: str) -> str:
        prompts = {
            "destination": "Destination is missing. Share the city/region/country to plan for.",
            "origin": "Origin is missing. Share where you will start your trip from.",
            "trip_planning_intent": "Confirm whether you want a full itinerary plan or a quick travel answer.",
        }
        return prompts.get(
            missing_field,
            "Please share a bit more detail so I can finalize the itinerary.",
        )
