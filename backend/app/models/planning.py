from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum

from pydantic import BaseModel, Field


class IntentType(str, Enum):
    PLAN_TRIP = "plan_trip"
    ASK_TRAVEL_QUESTION = "ask_travel_question"


class ConstraintStrength(str, Enum):
    HARD = "hard"
    SOFT = "soft"


class ConstraintSource(str, Enum):
    USER = "user"
    INFERRED = "inferred"
    DEFAULT = "default"


class BudgetLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    LUXURY = "luxury"


class BudgetScope(str, Enum):
    DAY = "day"
    TRIP = "trip"


class TransportMode(str, Enum):
    WALK = "walk"
    TRANSIT = "transit"
    DRIVE = "drive"
    BICYCLE = "bicycle"


class TransportPreference(str, Enum):
    OWN_TRANSPORT = "own_transport"
    PUBLIC_TRANSPORT = "public_transport"
    HYBRID = "hybrid"
    OPTIMIZE_TIME = "optimize_for_time"
    OPTIMIZE_MONEY = "optimize_for_money"


class FeasibilityStatus(str, Enum):
    FEASIBLE = "feasible"
    NEEDS_MORE_INFO = "needs_more_info"
    NOT_FEASIBLE = "not_feasible"


class CompletenessStatus(str, Enum):
    COMPLETE = "complete"
    INCOMPLETE = "incomplete"


class ConversationRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class TravelPlanningRequest(BaseModel):
    prompt: str = Field(min_length=3)
    language_code: str | None = None
    region_code: str | None = None
    currency_code: str | None = None
    transport_preference: TransportPreference = TransportPreference.OPTIMIZE_TIME
    session_id: str | None = None
    referenced_blog_posts: list[str] = Field(default_factory=list)


class DestinationSelection(BaseModel):
    value: str
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    source: ConstraintSource = ConstraintSource.USER


class DurationPreference(BaseModel):
    selected_days: int | None = Field(default=None, ge=1, le=30)
    min_days: int | None = Field(default=None, ge=1, le=30)
    max_days: int | None = Field(default=None, ge=1, le=30)
    confidence: float = Field(default=0.6, ge=0.0, le=1.0)
    source: ConstraintSource = ConstraintSource.INFERRED


class BudgetPreference(BaseModel):
    amount: float | None = Field(default=None, ge=0)
    currency_code: str | None = None
    level: BudgetLevel | None = None
    scope: BudgetScope = BudgetScope.TRIP
    hard_cap: bool = False
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class PartyComposition(BaseModel):
    adults: int = Field(default=1, ge=1, le=20)
    children: int = Field(default=0, ge=0, le=20)


class PlanningConstraint(BaseModel):
    key: str
    description: str
    strength: ConstraintStrength = ConstraintStrength.SOFT
    value: str | int | float | bool | None = None
    source: ConstraintSource = ConstraintSource.USER


class PreferenceWeight(BaseModel):
    key: str
    description: str
    weight: float = Field(default=0.5, ge=0.0, le=1.0)
    source: ConstraintSource = ConstraintSource.USER


class PlanningState(BaseModel):
    raw_request: str
    intent_type: IntentType = IntentType.PLAN_TRIP
    destination: DestinationSelection
    duration: DurationPreference = Field(default_factory=DurationPreference)
    budget: BudgetPreference = Field(default_factory=BudgetPreference)
    party: PartyComposition = Field(default_factory=PartyComposition)
    requested_stops: int | None = Field(default=None, ge=1, le=30)
    transport_preference: TransportPreference = TransportPreference.OPTIMIZE_TIME
    transport_modes: list[TransportMode] = Field(default_factory=list)
    max_walk_minutes: int | None = Field(default=None, ge=0, le=240)
    hard_constraints: list[PlanningConstraint] = Field(default_factory=list)
    soft_preferences: list[PreferenceWeight] = Field(default_factory=list)
    unknowns: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    language_code: str = "en"
    region_code: str = "US"
    currency_code: str = "USD"


class PlaceLocation(BaseModel):
    lat: float
    lng: float


class CandidatePlace(BaseModel):
    place_id: str
    name: str
    address: str | None = None
    location: PlaceLocation
    primary_type: str | None = None
    rating: float | None = None
    user_rating_count: int | None = None
    price_level: int | None = Field(default=None, ge=0, le=4)
    google_maps_uri: str | None = None
    editorial_summary: str | None = None
    source_query: str | None = None
    match_score: float = 0.0


class TravelStep(BaseModel):
    mode: TransportMode
    duration_minutes: int | None = None
    distance_meters: int | None = None
    cost_estimate: float | None = None
    note: str | None = None


class PlannedStop(BaseModel):
    order: int
    place: CandidatePlace
    rationale: str
    estimated_visit_minutes: int = Field(default=90, ge=15, le=600)
    travel_from_previous: TravelStep | None = None


class DayPlan(BaseModel):
    day_number: int
    theme: str
    stops: list[PlannedStop] = Field(default_factory=list)
    total_travel_minutes: int = 0
    total_visit_minutes: int = 0


class BudgetEstimate(BaseModel):
    estimated_total: float | None = None
    currency_code: str
    confidence: str = "low"
    notes: list[str] = Field(default_factory=list)


class PlanMetadata(BaseModel):
    itinerary_generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    search_queries: list[str] = Field(default_factory=list)
    candidate_count: int = 0
    shortlist_count: int = 0
    transport_preference: TransportPreference = TransportPreference.OPTIMIZE_TIME
    primary_transport_mode: TransportMode = TransportMode.WALK
    evaluated_transport_modes: list[TransportMode] = Field(default_factory=list)
    session_turn_count: int = 0
    workflow_engine: str = "sequential"


class FeasibilityAssessment(BaseModel):
    status: FeasibilityStatus = FeasibilityStatus.FEASIBLE
    reason: str
    missing_information: list[str] = Field(default_factory=list)
    follow_up_question: str | None = None


class CompletenessAssessment(BaseModel):
    status: CompletenessStatus = CompletenessStatus.COMPLETE
    reason: str
    missing_information: list[str] = Field(default_factory=list)
    follow_up_question: str | None = None


class ConversationTurn(BaseModel):
    role: ConversationRole
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class PlanningStateResponse(BaseModel):
    planning_state: PlanningState


class TripPlanResponse(BaseModel):
    session_id: str
    completeness: CompletenessAssessment
    feasibility: FeasibilityAssessment
    follow_up_question: str | None = None
    recent_context: list[ConversationTurn] = Field(default_factory=list)
    planning_state: PlanningState
    candidates: list[CandidatePlace] = Field(default_factory=list)
    itinerary: list[DayPlan] = Field(default_factory=list)
    budget: BudgetEstimate
    explanation: str
    warnings: list[str] = Field(default_factory=list)
    referenced_blog_posts: list[str] = Field(default_factory=list)
    metadata: PlanMetadata
