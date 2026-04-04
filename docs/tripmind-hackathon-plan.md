# TripMind — Full Hackathon Build Plan

## Product Overview

TripMind is an AI travel companion that helps users plan trips using memories from past trips and friends' experiences, stays active during the trip with proactive replanning and voice interaction, and closes the loop by auto-generating a blog post that feeds future travellers.

**Google Track:** Build With AI — The Agentic Frontier
**Side Tracks:** ElevenLabs (voice), Auth0 (auth + agent identity)

---

## App Structure (2 Pages)

### Page 1 — Main App (`/`)

Three-panel layout:

```
┌─────────────────┬──────────────────────────┬───────────────────┐
│  LEFT PANEL     │     CENTER PANEL         │  RIGHT PANEL      │
│                 │                          │                   │
│  Live           │   Chat + Itinerary       │  Past Trips       │
│  Preferences    │                          │  (yours +         │
│                 │  [Voice input button]    │   friends)        │
│  Budget: $$$    │                          │                   │
│  Vibe: Relaxed  │  [Chatbox]               │  🗺 Tokyo '24     │
│  Pace: Slow     │                          │  🗺 Bali '23      │
│  Dietary: Veg   │  [Itinerary renders      │  🗺 Paris '23     │
│                 │   below chat once        │  (friend) NYC '24 │
│  (updates live  │   generated]             │                   │
│   as you chat)  │                          │  Click → Page 2   │
└─────────────────┴──────────────────────────┴───────────────────┘
```

### Page 2 — Blog Post (`/trip/:id`)

- Full blog post with photos, diary entries, day-by-day breakdown
- Rendered from the agent-generated and user-approved post
- Publicly visible, referenceable by other users' agents

---

## Tech Stack

### Frontend
- **Next.js 14** (App Router) — main framework
- **TanStack Query** — server state, real-time itinerary updates
- **Zustand** — left panel preference state (updates live as user chats)
- **Tailwind CSS** — styling
- **ElevenLabs JS SDK** — voice input and output in chatbox

### Backend / Agent
- **FastAPI** — main API server
- **LangGraph** — multi-node agent workflow (planner, memory retriever, replanner, diary writer, blog generator)
- **Gemini 1.5 Pro via Vertex AI** — primary LLM for all agent reasoning
- **Vertex AI Embeddings** — semantic search over past trips and blogs

### Auth
- **Auth0** — user authentication and session management
- **Auth0 for AI Agents** — agent gets scoped tokens to act on behalf of user (read preferences, post blogs)

### Database
- **Firestore** — users, trips, diary entries, blog posts, preferences

### External APIs
- **Google Flights API / SerpAPI** — live flight prices
- **Google Places API** — hotels, attractions, restaurant recommendations
- **Google Maps API** — route visualization in itinerary
- **Open-Meteo API** — free real-time weather (no key needed, reliable)

---

## Database Schema

```sql
-- Users (managed by Auth0, mirrored here)
users (id, auth0_id, name, email, avatar_url, created_at)

-- User preferences (updated live by agent)
preferences (
  id, user_id,
  budget_tier,        -- budget / mid / luxury
  trip_vibe,          -- relaxed / adventure / cultural / party
  pace,               -- slow / moderate / fast
  dietary,            -- none / vegetarian / vegan / halal
  accommodation,      -- hostel / hotel / airbnb / resort
  updated_at
)

-- Trips
trips (
  id, user_id, destination, country,
  start_date, end_date, status,  -- planned / ongoing / completed
  itinerary_json,                -- full itinerary stored as JSON
  embedding vector(768),         -- for semantic search
  created_at
)

-- Trip participants (for friend trips)
trip_participants (trip_id, user_id, role)  -- owner / friend

-- Diary entries
diary_entries (
  id, trip_id, user_id,
  entry_date, content, voice_transcript,
  reviewed_by_user,  -- boolean
  created_at
)

-- Blog posts
blog_posts (
  id, trip_id, user_id,
  title, content_markdown, cover_image_url,
  published,  -- boolean (user approves before publish)
  embedding vector(768),  -- for agent retrieval
  created_at
)
```

---

## Agent Architecture (LangGraph)

### Nodes

```
1. MEMORY_RETRIEVER
   Input: destination + user_id
   Action: semantic search over own trips, friend trips, blog posts
   Output: relevant past experiences, tips, preferences

2. CONTEXT_BUILDER
   Input: memory results + chat history
   Action: infer missing context, generate follow-up questions
   Output: enriched trip context OR clarification questions to user

3. PREFERENCE_UPDATER
   Input: chat messages
   Action: extract preference signals, update Supabase preferences table
   Output: updated preferences JSON (streamed to left panel via SSE)

4. ITINERARY_PLANNER
   Input: full context (destination, dates, budget, vibe, memory)
   Action: call Google Flights + Places APIs, generate day-by-day plan
   Output: structured itinerary JSON with flights, hotels, activities

5. TRIP_MONITOR (active during trip)
   Input: current itinerary + weather API + user location (optional)
   Action: detect disruptions, generate proactive replanning suggestions
   Output: alert + updated itinerary section

6. DIARY_WRITER
   Input: user voice/text diary entry OR auto-prompt at end of day
   Action: format into structured diary, ask user to review
   Output: diary entry stored in DB

7. BLOG_GENERATOR (post-trip)
   Input: all diary entries + itinerary + photos metadata
   Action: generate full blog post in markdown, ask user to review
   Output: blog post draft → published on approval
```

### Agent Flow Diagram

```
User input
    │
    ▼
MEMORY_RETRIEVER ──────────────────────────────────┐
    │                                               │
    ▼                                               │
CONTEXT_BUILDER                                     │
    │                                               │
    ├── needs more info? → ask user → loop back     │
    │                                               │
    ▼                                               │
PREFERENCE_UPDATER (parallel, streams to UI)        │
    │                                               │
    ▼                                               │
ITINERARY_PLANNER                                   │
    │                                               │
    ▼                                               │
[Trip starts]                                       │
    │                                               │
TRIP_MONITOR ← weather/delay triggers               │
    │                                               │
DIARY_WRITER ← user input or auto-prompt            │
    │                                               │
[Trip ends]                                         │
    │                                               │
BLOG_GENERATOR → user review → publish ────────────┘
                                    (feeds back into memory)
```

---

## ElevenLabs Integration

- **Voice input:** User clicks mic → browser captures audio → sent to ElevenLabs STT → text injected into chat as user message
- **Voice output:** Agent text responses → ElevenLabs TTS → played back automatically
- **Key moments to use voice:**
  - Agent asking follow-up questions ("What's your budget for this trip?")
  - Proactive disruption alerts ("Your Tuesday flight is delayed. I've updated your plan.")
  - End-of-day diary prompt ("How was your day? Tell me what you did.")
  - Blog post ready notification

```javascript
// Voice output example
import { ElevenLabsClient } from 'elevenlabs'

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })

async function speak(text) {
  const audio = await client.textToSpeech.convert('voice_id_here', {
    text,
    model_id: 'eleven_turbo_v2',
    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
  })
  // play audio in browser
}
```

---

## Auth0 Integration

### Standard Auth
- Login / signup via Auth0 Universal Login
- User profile and preferences tied to Auth0 `sub` ID
- Session stored in Auth0, preferences mirrored to Supabase

### Auth0 for AI Agents
The agent acts on behalf of the user using Auth0 Machine-to-Machine tokens with scoped permissions:

```
Scopes:
  read:preferences    → agent reads user preferences
  write:preferences   → agent updates preferences after chat
  write:diary         → agent saves diary entries
  write:blog          → agent drafts blog post
  publish:blog        → only granted after user explicit approval
```

```javascript
// Agent gets token with specific scopes
const token = await auth0.getToken({
  audience: 'https://tripmind-api',
  scope: 'read:preferences write:diary'
})
// All agent API calls include this token
// publish:blog only requested when user clicks "Publish"
```

This is a strong demo point for the Auth0 for AI Agents side track — the agent cannot post publicly without explicit user approval.

---

## 48-Hour Build Plan

### Team of 4 — Role Split

| Person | Owns |
|---|---|
| **Person 1** | Frontend — 3-panel UI, chat interface, left panel real-time preferences |
| **Person 2** | Agent — LangGraph nodes, Gemini integration, Vertex AI embeddings |
| **Person 3** | Backend — FastAPI routes, Supabase schema, SSE streaming, Google APIs |
| **Person 4** | Auth + Voice + Blog Page — Auth0, ElevenLabs, Page 2 blog renderer |

---

### Hour-by-Hour Schedule

#### Block 1: Hours 0-8 — Foundation

**Person 1 (Frontend)**
- Next.js project setup with Tailwind
- 3-panel layout skeleton (static, no data yet)
- Chat component with message history
- Past trips panel (hardcoded mock data)

**Person 2 (Agent)**
- LangGraph skeleton with all 7 nodes stubbed
- Gemini 1.5 Pro connected via Vertex AI
- MEMORY_RETRIEVER node working with mock data
- CONTEXT_BUILDER generating follow-up questions

**Person 3 (Backend)**
- FastAPI project setup
- Supabase schema created (all tables above)
- Seed database with 3 sample past trips and 2 blog posts
- `/chat` POST endpoint connected to LangGraph

**Person 4 (Auth + Voice)**
- Auth0 project setup, login/logout working
- User session passed to backend
- ElevenLabs account setup, TTS working for a test string
- Page 2 blog post layout (static mock)

**End of Block 1 checkpoint:**
User can log in, type in chatbox, get a response from Gemini, see mock past trips on right panel.

---

#### Block 2: Hours 8-20 — Core Flow

**Person 1 (Frontend)**
- Left panel connected to SSE stream from backend (preferences update live)
- Itinerary renders below chat (flights, hotels, day plan cards)
- ElevenLabs voice input button in chatbox
- Loading states and smooth transitions

**Person 2 (Agent)**
- PREFERENCE_UPDATER streaming updates via SSE
- ITINERARY_PLANNER generating structured JSON itinerary
- Vertex AI embeddings on past trips seeded into pgvector
- MEMORY_RETRIEVER doing real semantic search

**Person 3 (Backend)**
- Google Places API returning real hotel and attraction data
- SerpAPI / Google Flights returning real or mocked flight prices
- SSE endpoint for preference streaming
- Open-Meteo weather API connected

**Person 4 (Auth + Voice)**
- Auth0 for AI Agents — M2M token with scopes working
- ElevenLabs voice output playing agent responses
- Voice input capturing and sending to agent
- Page 2 connected to real blog post data from DB

**End of Block 2 checkpoint:**
Full pre-trip flow works end to end. User types destination → agent asks follow-ups → itinerary generated with real data → preferences update live on left panel → voice works both ways.

---

#### Block 3: Hours 20-32 — During Trip + Blog

**Person 1 (Frontend)**
- Trip status toggle (planned → ongoing → completed)
- Weather alert banner with updated plan diff
- Diary entry UI (voice + text)
- Blog post review and publish flow

**Person 2 (Agent)**
- TRIP_MONITOR node: detects weather disruption, triggers replanning
- DIARY_WRITER node: formats voice/text entry, saves to DB
- BLOG_GENERATOR node: compiles diary + itinerary into markdown blog

**Person 3 (Backend)**
- Weather disruption trigger (cron or manual webhook for demo)
- Diary entry endpoints
- Blog post draft endpoint with user review gate
- Blog publish endpoint (requires publish:blog scope)

**Person 4 (Auth + Voice)**
- Voice diary recording flow end to end
- "Agent is generating your blog..." loading state
- Blog published to Page 2
- Blog embedding stored in pgvector for future retrieval

**End of Block 3 checkpoint:**
Full trip lifecycle works. Pre-trip → during trip disruption replanning → diary entry → blog post generated and published.

---

#### Block 4: Hours 32-44 — Polish + Demo Prep

- Fix all broken edges found in Block 3
- Seed realistic demo data (3 past trips, 1 friend trip, 2 blog posts)
- Smooth all UI animations and loading states
- Make sure voice flow works reliably without errors
- Build the exact demo script scenario (Tokyo trip with Day 2 weather disruption)
- Test demo 5+ times end to end

---

#### Block 5: Hours 44-48 — Rehearsal Only

- No new code unless something is broken
- Full demo run with all 4 team members watching
- Prepare judge Q&A answers
- Make sure deployment is stable on GCP Cloud Run

---

## Demo Script (3 minutes)

```
0:00 - 0:20  Setup
"TripMind is an AI travel companion with memory. It learns from your past 
trips and your friends' trips to plan smarter every time."

0:20 - 1:00  Pre-trip planning
[Type: "I want to go to Tokyo"]
Agent: "You've been to Tokyo before — and your friend Sarah went last month. 
Want me to factor those in?"
[Left panel updates: Budget $$, Relaxed pace, Vegetarian]
Agent asks: "How many days? Adventure or relaxing?"
[Full itinerary appears: flights $680, Park Hyatt hotel, 3-day plan]

1:00 - 1:40  During trip disruption
[Toggle trip to "Ongoing"]
[Weather alert banner: "Heavy rain on Tuesday afternoon"]
Agent via voice: "Looks like rain Tuesday. I've moved your outdoor walk 
to Wednesday and booked a ramen experience instead. Want to keep this?"
[User says "Yes" via voice]
[Itinerary updates live]

1:40 - 2:10  Diary + Blog
[User speaks: "Today I had the best sushi in Tsukiji market"]
Agent: "Got it. Here's your diary entry — does this look right?"
[End of trip: Blog post draft appears]
[User clicks Publish]
[Page 2 shows full blog — now visible to other travellers]

2:10 - 2:30  The loop
"Now when your friend plans a Tokyo trip, TripMind finds this blog. 
The more you travel, the smarter it gets for everyone."

2:30 - 3:00  Side tracks callout
"Voice powered by ElevenLabs. Auth0 ensures the agent can only publish 
after your explicit approval — secure agentic actions by design."
```

---

## Deployment

- **Frontend:** Vercel (Next.js native, instant deploy)
- **Backend:** GCP Cloud Run (FastAPI Docker container)
- **Database:** Supabase (managed, no infra needed)
- **Agent:** Runs inside Cloud Run, calls Vertex AI APIs
- **Auth:** Auth0 hosted (no infra needed)

```dockerfile
# Backend Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

---

## What Judges Will See

| Criteria | What TripMind shows |
|---|---|
| Agentic reasoning | 7-node LangGraph workflow, agent acts without being asked (proactive replan, diary, blog) |
| Google Cloud | Vertex AI, Gemini 1.5 Pro, GCP Cloud Run, Google Places + Maps APIs |
| Real-world impact | Solves actual travel planning pain, memory loop makes it genuinely better over time |
| Technical execution | Full-stack, realtime SSE, vector search, voice, secure agent auth |
| Innovation | Blog loop feeding future trips is the unique differentiator no workshop project has |

---

## The One Thing That Wins This

The blog feedback loop. Every other travel agent answers questions. TripMind **learns and shares** across users. That single idea is what no workshop template will have, and it is what judges will remember after seeing 10 travel demos in a row.
