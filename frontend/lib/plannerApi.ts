export type TransportPreference =
  | 'own_transport'
  | 'public_transport'
  | 'hybrid'
  | 'optimize_for_time'
  | 'optimize_for_money'

export interface TravelPlanningRequest {
  prompt: string
  language_code: string
  region_code: string
  currency_code: string
  transport_preference: TransportPreference
  session_id: string
}

interface CompletenessAssessment {
  status: 'complete' | 'incomplete'
  reason: string
  missing_information: string[]
  follow_up_question: string | null
}

interface FeasibilityAssessment {
  status: 'feasible' | 'needs_more_info' | 'not_feasible'
  reason: string
  missing_information: string[]
  follow_up_question: string | null
}

interface CandidatePlaceLite {
  name: string
  address?: string | null
  primary_type?: string | null
}

interface TravelFromPrevious {
  mode: string
  duration_minutes?: number | null
  departure_stop?: string | null
  arrival_stop?: string | null
  transit_line?: string | null
  transit_headsign?: string | null
}

interface PlannedStop {
  order: number
  place: CandidatePlaceLite
  rationale: string
  travel_from_previous?: TravelFromPrevious | null
}

interface DayPlan {
  day_number: number
  theme: string
  stops: PlannedStop[]
}

interface BudgetEstimate {
  estimated_total?: number | null
  currency_code: string
  confidence: string
}

export interface TripPlanResponse {
  session_id: string
  completeness: CompletenessAssessment
  feasibility: FeasibilityAssessment
  follow_up_question?: string | null
  explanation: string
  warnings: string[]
  itinerary: DayPlan[]
  candidates: CandidatePlaceLite[]
  budget: BudgetEstimate
}

const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim()

const normalizeMarkdownForChat = (text: string): string =>
  text
    .replace(/^###\s+/gm, '')
    .replace(/^##\s+/gm, '')
    .replace(/^#\s+/gm, '')
    .replace(/^\*\s+/gm, '- ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .trim()

export const inferTransportPreference = (prompt: string): TransportPreference => {
  const lower = prompt.toLowerCase()
  if (
    lower.includes('public transport') ||
    lower.includes('transit') ||
    lower.includes('bus') ||
    lower.includes('metro') ||
    lower.includes('subway') ||
    lower.includes('train')
  ) {
    return 'public_transport'
  }
  if (
    lower.includes('car') ||
    lower.includes('drive') ||
    lower.includes('driving') ||
    lower.includes('own transport')
  ) {
    return 'own_transport'
  }
  if (
    lower.includes('cheapest') ||
    lower.includes('cheap') ||
    lower.includes('budget') ||
    lower.includes('save money')
  ) {
    return 'optimize_for_money'
  }
  return 'optimize_for_time'
}

export const planTrip = async (payload: TravelPlanningRequest): Promise<TripPlanResponse> => {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured in frontend/.env.')
  }

  const response = await fetch(`${API_URL}/api/v1/planner/plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const body = (await response.json().catch(() => ({}))) as {
    detail?: string
    message?: string
  } & Partial<TripPlanResponse>

  if (!response.ok) {
    const errorMessage = body.detail || body.message || `Planner API failed with HTTP ${response.status}.`
    throw new Error(errorMessage)
  }

  return body as TripPlanResponse
}

const formatStops = (day: DayPlan): string[] => {
  const lines: string[] = []
  for (const stop of day.stops.slice(0, 4)) {
    const transport = stop.travel_from_previous
    if (!transport) {
      lines.push(`- Stop ${stop.order}: ${stop.place.name}`)
      continue
    }
    const legSummary = [
      transport.mode?.toUpperCase() || 'TRANSIT',
      transport.duration_minutes ? `${transport.duration_minutes} min` : null,
      transport.transit_line ? transport.transit_line : null,
    ]
      .filter(Boolean)
      .join(' | ')
    lines.push(`- Stop ${stop.order}: ${stop.place.name} (${legSummary})`)
  }
  return lines
}

export const formatTripPlanForChat = (plan: TripPlanResponse): string => {
  const parts: string[] = []

  if (plan.follow_up_question) {
    parts.push(plan.follow_up_question)
    if (plan.completeness.missing_information.length) {
      parts.push(`Missing details: ${plan.completeness.missing_information.join(', ')}`)
    }
  } else if (plan.explanation?.trim()) {
    parts.push(normalizeMarkdownForChat(plan.explanation))
  }

  if (plan.itinerary.length) {
    const snapshot: string[] = ['Itinerary Snapshot:']
    for (const day of plan.itinerary.slice(0, 2)) {
      snapshot.push(`Day ${day.day_number} (${day.theme})`)
      snapshot.push(...formatStops(day))
    }
    parts.push(snapshot.join('\n'))
  } else if (plan.candidates.length) {
    const topPlaces = plan.candidates
      .slice(0, 5)
      .map((place, index) => `${index + 1}. ${place.name}`)
      .join('\n')
    parts.push(`Top place suggestions:\n${topPlaces}`)
  }

  if (plan.budget.estimated_total !== null && plan.budget.estimated_total !== undefined) {
    parts.push(
      `Estimated budget: ${plan.budget.estimated_total} ${plan.budget.currency_code} (${plan.budget.confidence} confidence)`
    )
  }

  if (plan.warnings.length) {
    parts.push(`Notes:\n- ${plan.warnings.join('\n- ')}`)
  }

  return parts.filter(Boolean).join('\n\n').trim()
}
