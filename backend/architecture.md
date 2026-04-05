# TravelMate Backend Architecture

This document describes the **current** backend flow in code today, with emphasis on:

- where LLM calls happen
- where data is transformed/processed
- where exceptions are raised and handled

---

## 1. Runtime Topology

At startup, FastAPI is created in [`app/main.py`](./app/main.py).

`lifespan()` initializes shared app state:

- `settings`: loaded from env via [`app/core/config.py`](./app/core/config.py)
- `http_client`: a single shared `httpx.AsyncClient`
- `memory_store`: process-local [`InMemorySessionStore`](./app/services/memory.py)

Routers:

- health routes: [`app/api/routes/health.py`](./app/api/routes/health.py)
- planner routes: [`app/api/routes/planner.py`](./app/api/routes/planner.py)

---

## 2. High-Level Request Flow

```text
Client
  -> FastAPI route
    -> PlannerService
      -> PlannerWorkflow (sequential)
        -> Memory load
        -> Gemini planning-state extraction
        -> Completeness evaluation
        -> (if incomplete and attempts < threshold) specific follow-up questions
        -> (if incomplete and attempts >= threshold) Gemini approximate itinerary
        -> Feasibility evaluation
        -> (if complete + feasible) Places search + Routes compute + optimization
        -> Gemini itinerary explanation
        -> Response finalize + memory append
```

---

## 3. API Surface

### `POST /api/v1/planner/test-simple-gemini`

File: [`app/api/routes/planner.py`](./app/api/routes/planner.py)

Purpose:

- extracts and returns a normalized `PlanningState` only
- does **not** run completeness/feasibility/itinerary generation pipeline
- utility/debug endpoint to test Gemini extraction in isolation

Compatibility note:

- deprecated alias still exists at `POST /api/v1/planner/planning-state` (hidden from schema)

Execution path:

1. Route dependency builds `PlannerService` with Gemini/Maps clients, optimizer, query builder, memory.
2. `PlannerService.extract_planning_state()` calls Gemini parser.
3. Service normalizes language/region/currency and transport preference/modes.
4. Returns `PlanningStateResponse`.

---

### `POST /api/v1/planner/plan`

File: [`app/api/routes/planner.py`](./app/api/routes/planner.py)

Purpose:

- full orchestration endpoint with gating:
  - first completeness
  - then feasibility
  - then place/routing/itinerary only when both pass

Execution path:

1. `PlannerService.build_trip_plan()`
2. `PlannerWorkflow.run()` in [`app/workflows/planner_graph.py`](./app/workflows/planner_graph.py)
3. Workflow engine:
   - uses internal sequential runner
4. Final `TripPlanResponse` always produced through `_finalize_response()`

### Happy Path API Call Order (`/plan`)

Assuming request is complete and feasible, the API calls happen in this exact order:

1. Client -> Backend: `POST /api/v1/planner/plan`
2. Backend -> Gemini: `POST {gemini_base_url}/models/{gemini_model}:generateContent`
Purpose: extract structured `PlanningState` from user prompt + session context.
3. Backend -> Places (repeated per generated query): `POST {places_base_url}/places:searchText`
Purpose: fetch candidate places for each query produced by `SearchQueryBuilder`.
4. Backend -> Routes (repeated per transport mode and per origin/destination pair):
`POST {routes_base_url}/directions/v2:computeRoutes`
Purpose: compute travel legs used for route selection and itinerary ordering.
5. Backend -> Gemini: `POST {gemini_base_url}/models/{gemini_model}:generateContent`
Purpose: generate final natural-language itinerary explanation from structured itinerary summary.
6. Backend -> Client: return `TripPlanResponse` (planning state, candidates, itinerary, budget, explanation, metadata).

Notes:

- Steps 3 and 4 are fan-out calls:
  - Places: one call per search query.
  - Routes: one call per `(origin, destination, transport mode)` combination.
- If completeness fails, steps 3-5 are skipped.
- If feasibility fails, steps 3-5 are skipped.

---

## 4. Workflow Internals (`PlannerWorkflow`)

File: [`app/workflows/planner_graph.py`](./app/workflows/planner_graph.py)

### Step A: `_load_memory`

- appends the current user prompt to session memory (`ConversationRole.USER`)
- if `session_id` missing, workflow creates one (`uuid4`)

### Step B: `_extract_planning_state`  **(LLM call #1)**

- builds context block from recent turns (excluding newest user turn)
- merges context + latest request into one prompt for extraction
- calls `GeminiClient.extract_planning_state(...)`
- writes normalized transport preference and transport modes
- stores planning state in memory

### Step C: `_evaluate_completeness`

- calls rule-based `CompletenessEvaluator.evaluate(...)`
- determines `complete` vs `incomplete`
- produces specific follow-up prompts for each missing field when needed
- tracks per-session incomplete attempts in memory
- uses prior session context so follow-up turns can omit destination/origin if they were already provided earlier
- missing-detail priority order is fixed as:
  - `destination` -> `origin`

### Step D: `_evaluate_feasibility`

- only reached if completeness is `complete`
- calls rule-based `FeasibilityEvaluator.evaluate(...)`
- determines `feasible` vs `not_feasible`

### Step E: `_build_plan` (only if complete + feasible)

Data processing stages:

1. Query generation:
   - `SearchQueryBuilder.build_queries(planning_state, origin, destination)`
   - includes route-aware queries for "along the way / on the way / en route" prompts
2. Candidate collection:
   - `_collect_candidates()` -> `PlacesClient.search_text(...)` per query
   - dedupe by `place_id`
3. Candidate scoring + shortlist:
   - `ItineraryOptimizer.shortlist_candidates(...)`
   - applies exclusion constraints (for example "exclude X")
4. Route evaluation by transport mode:
   - `RoutesClient.compute_route_maps_for_modes(...)`
   - evaluates all requested/effective modes
   - computes an origin->destination route overview when both endpoints can be resolved
5. Route option selection:
   - `_select_route_map()` + `_choose_route_option()`
   - selection strategy depends on `transport_preference`
6. Itinerary build:
   - `ItineraryOptimizer.build_itinerary(...)`
7. Budget estimate:
   - `ItineraryOptimizer.estimate_budget(...)`
8. Explanation generation **(LLM call #2)**:
   - `GeminiClient.explain_itinerary(...)`
   - final prompt includes:
     - route overview from Routes API
     - place data from Places API
     - structured itinerary summary with travel legs
   - asks Gemini to return sections:
     - `How To Get There`
     - `Places Along The Way`
     - `Suggested Itinerary`
     - `Notes And Tradeoffs`

Special branch:

- if zero Places candidates found, workflow marks request as `not_feasible` and returns guidance question without itinerary.

### Step F: `_finalize_response`

- central response builder for all outcomes:
  - incomplete
  - not feasible
  - successful itinerary
- when incomplete attempts reach `PLANNER_MAX_INCOMPLETE_ATTEMPTS` (default `3`), it calls Gemini to return an approximate itinerary draft instead of only another follow-up prompt
- appends assistant message to memory
- attaches recent context and metadata (turn count, transport summary, engine used)

---

## 5. LLM Call Locations and Behavior

File: [`app/clients/gemini.py`](./app/clients/gemini.py)

### `extract_planning_state(...)`

- endpoint called: `POST {gemini_base_url}/models/{gemini_model}:generateContent`
- prompt style: strict JSON schema extraction
- output normalized before Pydantic validation:
  - constraint strengths (e.g., `must` -> `hard`)
  - preference weights (e.g., `high` -> `0.9`)
  - transport preference synonyms

If Gemini is disabled or missing key:

- uses local heuristic parser (`_heuristic_planning_state`)

### `explain_itinerary(...)`

- endpoint called: same Gemini `generateContent`
- prompt includes:
  - raw user request
  - full planning state JSON
  - itinerary summary
- used only for natural-language explanation after itinerary exists

If Gemini is disabled or missing key:

- uses local explanation fallback (`_fallback_explanation`)

---

## 6. Google Maps/Places/Routes Call Locations

File: [`app/clients/maps.py`](./app/clients/maps.py)

### Places

- `PlacesClient.search_text(...)`
- endpoint: `POST {places_base_url}/places:searchText`
- field-mask constrained payload; converts results to `CandidatePlace`

### Routes

- `RoutesClient.compute_route(...)`
- endpoint: `POST {routes_base_url}/directions/v2:computeRoutes`
- called pairwise for each shortlisted origin/destination and mode
- supports `DRIVE`, `TRANSIT`, `WALK`, `BICYCLE` mode mapping

If routes are unavailable (or Google calls disabled):

- local heuristic route fallback via haversine + speed assumptions

---

## 7. Data Processing Responsibilities (by module)

- extraction/parsing: [`app/clients/gemini.py`](./app/clients/gemini.py)
- completeness rules: [`app/services/completeness.py`](./app/services/completeness.py)
- feasibility rules: [`app/services/feasibility.py`](./app/services/feasibility.py)
- query construction: [`app/services/query_builder.py`](./app/services/query_builder.py)
- ranking/shortlisting/itinerary/budget: [`app/services/optimizer.py`](./app/services/optimizer.py)
- memory/session context: [`app/services/memory.py`](./app/services/memory.py)
- contract schemas: [`app/models/planning.py`](./app/models/planning.py)

---

## 8. Exception and Error Handling

### Outbound Google API errors

Source: [`app/clients/base.py`](./app/clients/base.py)

- `post_json(...)` catches `httpx.HTTPError` and raises `GoogleAPIError`
- non-2xx HTTP responses are converted to `GoogleAPIError`
- missing API keys also raise `GoogleAPIError` via `require_*_api_key()`

### Route-level handling

File: [`app/api/routes/planner.py`](./app/api/routes/planner.py)

- `GoogleAPIError` -> HTTP `502 Bad Gateway`
- `ValueError` in `/plan` -> HTTP `400 Bad Request`
- `ValueError` in `/test-simple-gemini` is **not** explicitly mapped here (would surface as default server error unless handled upstream)

### Internal fallback behavior (not exceptions)

- missing Gemini key or disabled Google calls:
  - planning extraction/explanation use local heuristics/fallback text
- missing Maps key during route computation:
  - heuristic route estimates are used in `RoutesClient.compute_route(...)`

---

## 9. Session Memory Model

File: [`app/services/memory.py`](./app/services/memory.py)

Current behavior:

- memory is in-process only (`dict` in Python process)
- not persistent across server restarts
- keyed by `session_id`
- stores:
  - conversation turns (user/assistant)
  - last planning state

Usage in workflow:

- prior turns are injected into the planning-state LLM extraction prompt
- recent context is returned in API response

---

## 10. Transport Strategy in Current Architecture

Transport is controlled by `transport_preference` in `TravelPlanningRequest`.

Mapping occurs in:

- [`app/services/planner.py`](./app/services/planner.py)
- [`app/workflows/planner_graph.py`](./app/workflows/planner_graph.py)

Behavior:

- `own_transport` -> evaluate `drive`
- `public_transport` -> evaluate `transit`
- `hybrid` -> evaluate both and choose per leg by hybrid score
- `optimize_for_time` (default) -> evaluate both and choose fastest-first per leg
- `optimize_for_money` -> evaluate both and choose lowest estimated cost per leg

So route options are processed internally and the selected leg-level results are returned to the user as part of each stop's `travel_from_previous`.

---

## 11. Configuration and External Dependencies

Settings source: [`app/core/config.py`](./app/core/config.py)

Key runtime flags:

- `GEMINI_API_KEY`
- `MAPS_API_KEY`
- `PLANNER_ENABLE_GOOGLE_CALLS`
- `GEMINI_MODEL`
- defaults for language/region/currency

Health endpoint exposes effective readiness signals:

- [`GET /api/v1/health`](./app/api/routes/health.py)

---

## 12. Practical Summary

Current architecture is a gated planning pipeline:

1. Parse user request into structured planning state (LLM or heuristic fallback).
2. Check completeness.
3. Check feasibility.
4. Only then call Places/Routes and optimize itinerary.
5. Generate explanation (LLM or fallback).
6. Return structured response + conversational context.

The key control points are in `PlannerWorkflow`, and all Google-network errors are normalized through `GoogleAPIError` before route-level HTTP mapping.
