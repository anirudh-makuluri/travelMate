# travelMate Planner API

A clean FastAPI scaffold for a travel planner that uses:

- Gemini for planning-state extraction and itinerary explanations
- Google Places API for place discovery
- Google Routes API for travel times between shortlisted stops

## What is implemented

- `POST /api/v1/planner/test-simple-gemini`
  - Converts natural-language travel requests into a flexible planning state
- `POST /api/v1/planner/plan`
  - Completeness + feasibility gated planning with memory, then itinerary generation from Gemini + Places + Routes
- `GET /api/v1/health`
  - Returns service and configuration status

## Architecture

The service is split into a few readable layers:

- `app/models`
  - Pydantic request, planning-state, and itinerary schemas
- `app/clients`
  - Thin Google API clients for Gemini, Places, and Routes
- `app/services`
  - Query building, completeness/feasibility checks, memory, and itinerary optimization
- `app/workflows`
  - Orchestration for planning flow
- `app/api/routes`
  - FastAPI route definitions

## Current request flow

`POST /api/v1/planner/plan` runs through this sequence:

- User input
- Session memory load/write (by `session_id`)
- Planning-state extraction (Gemini)
- Completeness evaluator
  - If incomplete: return specific missing-detail follow-up prompts
  - After repeated incomplete attempts, return an approximate itinerary draft
  - If complete: continue
- Feasibility evaluator
  - If not feasible: return follow-up question and stop
  - If feasible: continue
- Places + Routes calls (only when complete and feasible)
- Final itinerary and explanation

Implementation detail:

- Workflow orchestration lives in `app/workflows/planner_graph.py`
- Runs as a sequential workflow
- Session memory is in-process (`InMemorySessionStore`) and ephemeral (resets on app restart)

`POST /api/v1/planner/test-simple-gemini` remains a lightweight parser endpoint (no feasibility gate and no Places/Routes calls).

## Environment

Copy `.env.example` to `.env` and set the API keys.

The app expects:

- `GEMINI_API_KEY`
  - Used for Gemini reasoning and itinerary explanations
- `MAPS_API_KEY`
  - Used for Places and Routes requests
- `CORS_ALLOW_ORIGINS`
  - Comma-separated frontend origins allowed to call backend APIs from browser
- `ELEVENLABS_API_KEY`
  - Used by the ElevenLabs text-to-speech helper in `app/services/elevenlabs_tts.py`
- `ELEVENLABS_VOICE_ID`
  - Optional voice override for audio generation

You should enable the relevant services in your Google project before running the app.

## Text to speech helper

The `app/services/elevenlabs_tts.py` module exposes an async `elevenlabsTTS(text)` helper. It reads `ELEVENLABS_API_KEY` from `.env`, sends the text to ElevenLabs, and writes an `.mp3` file to `generated_audio/` by default.

## Run locally

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e .[dev]
uvicorn app.main:app --reload
```

## Example request

```json
{
  "prompt": "Plan me a relaxed 3 day trip in Kyoto with good food, temples, and a moderate budget.",
  "language_code": "en",
  "region_code": "US",
  "currency_code": "USD",
  "transport_preference": "optimize_for_time",
  "session_id": "user-42-trip-thread"
}
```

## Transport preferences

The planner now supports a request-level `transport_preference` parameter:

- `own_transport`
  - Use car-first routing for all legs
- `public_transport`
  - Use transit-first routing for all legs
- `hybrid`
  - Compare car and transit per leg and pick a balanced option
- `optimize_for_time`
  - Compare car and transit per leg and choose the faster option
- `optimize_for_money`
  - Compare car and transit per leg and choose the cheaper option

If omitted, the API defaults to `optimize_for_time`.

## Notes

- The `test-simple-gemini` endpoint can fall back to a simple heuristic parser when Gemini is not configured.
- Full itinerary generation requires valid Google Places and Routes access.
- The `/plan` response includes both completeness and feasibility status, plus optional follow-up questions when more detail is needed.
- The `/plan` response also includes `session_id`, `recent_context`, and metadata such as `workflow_engine` and `session_turn_count`.
- `PLANNER_MAX_INCOMPLETE_ATTEMPTS` controls when incomplete sessions switch to an approximate Gemini-generated itinerary.
- The optimizer is intentionally lightweight for readability. It is a good foundation for later replacement with OR-Tools or a stronger constraint solver.
