from __future__ import annotations

from app.models.planning import FeasibilityAssessment, FeasibilityStatus, PlanningState


class FeasibilityEvaluator:
    """Checks if a complete request is realistically plan-able."""

    def evaluate(self, planning_state: PlanningState) -> FeasibilityAssessment:
        selected_days = (
            planning_state.duration.selected_days
            or planning_state.duration.max_days
            or planning_state.duration.min_days
            or 0
        )
        if (
            planning_state.budget.hard_cap
            and planning_state.budget.amount is not None
            and selected_days > 0
            and planning_state.budget.amount < selected_days * 20
        ):
            return FeasibilityAssessment(
                status=FeasibilityStatus.NOT_FEASIBLE,
                reason=(
                    "The hard budget cap looks too low for the requested trip length, "
                    "so the current plan is unlikely to be realistic."
                ),
                missing_information=[],
                follow_up_question=(
                    "Would you like to increase the budget cap, reduce the number of days, "
                    "or keep the budget as a soft preference?"
                ),
            )

        if selected_days > 14 and planning_state.requested_stops and planning_state.requested_stops > 120:
            return FeasibilityAssessment(
                status=FeasibilityStatus.NOT_FEASIBLE,
                reason=(
                    "The requested number of stops is too high for the trip length and would create an unrealistic pace."
                ),
                missing_information=[],
                follow_up_question=(
                    "Would you like me to reduce the number of stops or shorten the trip duration?"
                ),
            )

        return FeasibilityAssessment(
            status=FeasibilityStatus.FEASIBLE,
            reason="Given the provided constraints, the request looks feasible.",
            missing_information=[],
            follow_up_question=None,
        )
