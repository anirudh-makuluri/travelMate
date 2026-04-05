from __future__ import annotations

from dataclasses import dataclass, field

from app.models.planning import ConversationRole, ConversationTurn, PlanningState


@dataclass
class SessionMemory:
    turns: list[ConversationTurn] = field(default_factory=list)
    last_planning_state: PlanningState | None = None
    incomplete_attempts: int = 0


class InMemorySessionStore:
    """Small in-process memory store for conversation context."""

    def __init__(self) -> None:
        self._sessions: dict[str, SessionMemory] = {}

    def append_turn(
        self,
        session_id: str,
        *,
        role: ConversationRole,
        content: str,
    ) -> None:
        session = self._sessions.setdefault(session_id, SessionMemory())
        session.turns.append(ConversationTurn(role=role, content=content))

    def get_recent_turns(
        self,
        session_id: str,
        *,
        limit: int = 8,
    ) -> list[ConversationTurn]:
        session = self._sessions.get(session_id)
        if session is None:
            return []
        return session.turns[-limit:]

    def build_context_block(
        self,
        session_id: str,
        *,
        limit: int = 8,
        exclude_latest_user_turn: bool = True,
    ) -> str:
        turns = self.get_recent_turns(session_id, limit=limit)
        if (
            exclude_latest_user_turn
            and turns
            and turns[-1].role == ConversationRole.USER
        ):
            turns = turns[:-1]

        if not turns:
            return ""

        lines = [f"{turn.role.value}: {turn.content}" for turn in turns]
        return "\n".join(lines)

    def set_last_planning_state(self, session_id: str, planning_state: PlanningState) -> None:
        session = self._sessions.setdefault(session_id, SessionMemory())
        session.last_planning_state = planning_state

    def increment_incomplete_attempts(self, session_id: str) -> int:
        session = self._sessions.setdefault(session_id, SessionMemory())
        session.incomplete_attempts += 1
        return session.incomplete_attempts

    def reset_incomplete_attempts(self, session_id: str) -> None:
        session = self._sessions.setdefault(session_id, SessionMemory())
        session.incomplete_attempts = 0

    def get_incomplete_attempts(self, session_id: str) -> int:
        session = self._sessions.get(session_id)
        if session is None:
            return 0
        return session.incomplete_attempts

    def turn_count(self, session_id: str) -> int:
        session = self._sessions.get(session_id)
        if session is None:
            return 0
        return len(session.turns)
