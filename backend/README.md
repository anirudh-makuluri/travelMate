# travelMate Planner API

A clean FastAPI scaffold for a travel planner that uses:

- Gemini for planning-state extraction and itinerary explanations
- Google Places API for place discovery
- Google Routes API for travel times between shortlisted stops

## What is implemented

- `POST /api/v1/planner/planning-state`
  - Converts natural-language travel requests into a flexible planning state
- `POST /api/v1/planner/plan`
  - Builds a multi-day itinerary from Gemini + Places + Routes
- `GET /api/v1/health`
  - Returns service and configuration status

## Architecture

The service is split into a few readable layers:

- `app/models`
  - Pydantic request, planning-state, and itinerary schemas
- `app/clients`
  - Thin Google API clients for Gemini, Places, and Routes
- `app/services`
  - Query building, itinerary optimization, and orchestration
- `app/api/routes`
  - FastAPI route definitions

Gemini interprets intent and explains the final answer. Google Maps APIs remain the source of truth for geo facts and travel durations.

## Environment

Copy `.env.example` to `.env` and set the API keys.

The app expects:

- `GEMINI_API_KEY`
  - Used for Gemini reasoning and itinerary explanations
- `MAPS_API_KEY`
  - Used for Places and Routes requests

You should enable the relevant services in your Google project before running the app.

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
  "transport_preference": "optimize_for_time"
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

- The planning-state endpoint can fall back to a simple heuristic parser when Gemini is not configured.
- Full itinerary generation requires valid Google Places and Routes access.
- The optimizer is intentionally lightweight for readability. It is a good foundation for later replacement with OR-Tools or a stronger constraint solver.
