import type { Itinerary, Preference } from '@/store/appStore'

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

interface PreferenceWeight {
  key: string
  description: string
  weight: number
}

interface PlanningConstraint {
  key: string
  description: string
  value?: string | number | boolean | null
}

interface PlanningState {
  destination?: {
    value?: string
  }
  duration?: {
    selected_days?: number | null
    min_days?: number | null
    max_days?: number | null
  }
  budget?: {
    amount?: number | null
    currency_code?: string | null
    level?: string | null
    scope?: string | null
    hard_cap?: boolean
  }
  party?: {
    adults?: number
    children?: number
  }
  requested_stops?: number | null
  transport_preference?: string
  hard_constraints?: PlanningConstraint[]
  soft_preferences?: PreferenceWeight[]
  assumptions?: string[]
  unknowns?: string[]
  language_code?: string
  region_code?: string
  currency_code?: string
}

export interface TripPlanResponse {
  session_id: string
  completeness: CompletenessAssessment
  feasibility: FeasibilityAssessment
  follow_up_question?: string | null
  recent_context?: Array<{
    role: 'user' | 'assistant'
    content: string
    created_at: string
  }>
  planning_state?: PlanningState
  explanation: string
  warnings: string[]
  itinerary: DayPlan[]
  candidates: CandidatePlaceLite[]
  budget: BudgetEstimate
  metadata?: {
    itinerary_generated_at?: string
  }
}

export interface CalendarExportEvent {
  id: string
  title: string
  start: Date | null
  end: Date | null
  location: string
  details: string
  googleCalendarUrl: string | null
  isExportable: boolean
}

export interface CalendarExportResult {
  exportableEvents: CalendarExportEvent[]
  skippedEvents: CalendarExportEvent[]
  blockedEvents: CalendarExportEvent[]
  openedCount: number
}

const PLANNER_PROXY_PATH = '/api/planner/plan'

const DAY_ACTIVITY_TIMES = ['09:00', '11:30', '14:30', '17:30', '20:00']

const PREFERENCE_ICONS: Record<string, string> = {
  budget: '💰',
  transport: '🚌',
  pace: '🚶',
  vibe: '✨',
  dietary: '🥗',
  stay: '🏨',
  group: '👤',
  style: '🧠',
}

const getPreferenceIcon = (key: string): string => {
  const normalized = key.toLowerCase()
  return (
    PREFERENCE_ICONS[normalized] ||
    (normalized.includes('budget')
      ? '💰'
      : normalized.includes('food') || normalized.includes('diet')
        ? '🥗'
        : normalized.includes('hotel') || normalized.includes('stay') || normalized.includes('accommodation') || normalized.includes('lodging')
          ? '🏨'
          : '•')
  )
}

const startCase = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const getCountryLabel = (regionCode?: string): string => {
  switch ((regionCode || '').toUpperCase()) {
    case 'US':
      return 'USA'
    case 'JP':
      return 'Japan'
    case 'GB':
      return 'United Kingdom'
    case 'FR':
      return 'France'
    case 'IT':
      return 'Italy'
    case 'ES':
      return 'Spain'
    default:
      return regionCode?.toUpperCase() || 'Trip plan'
  }
}

const getHeroImageForDestination = (destination: string): string => {
  const lower = destination.toLowerCase()

  if (lower.includes('tokyo') || lower.includes('japan')) {
    return 'https://images.unsplash.com/photo-1540959375944-7049f642e9d4?w=1600&h=1000&fit=crop'
  }
  if (lower.includes('vegas') || lower.includes('las vegas')) {
    return 'https://images.unsplash.com/photo-1574219743318-5f0d79d85979?w=1600&h=1000&fit=crop'
  }
  if (lower.includes('vermont')) {
    return 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&h=1000&fit=crop'
  }

  return 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1600&h=1000&fit=crop'
}

const addDays = (isoDate: string, daysToAdd: number): string => {
  const date = new Date(isoDate)
  date.setDate(date.getDate() + daysToAdd)
  return date.toISOString()
}

const parseActivityDateTime = (date: string, time: string): Date | null => {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
    return null
  }

  const activityDate = new Date(date)
  if (Number.isNaN(activityDate.getTime())) {
    return null
  }

  activityDate.setHours(hours, minutes, 0, 0)
  return activityDate
}

const addMinutes = (date: Date, minutesToAdd: number): Date => {
  const updated = new Date(date)
  updated.setMinutes(updated.getMinutes() + minutesToAdd)
  return updated
}

const formatGoogleCalendarDate = (date: Date): string => {
  const pad = (value: number) => value.toString().padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    pad(date.getMinutes()),
    '00',
  ].join('')
}

const buildGoogleCalendarUrl = (event: {
  title: string
  start: Date
  end: Date
  location: string
  details: string
}) => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleCalendarDate(event.start)}/${formatGoogleCalendarDate(event.end)}`,
    details: event.details,
    location: event.location,
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export const mapTripPlanToItinerary = (plan: TripPlanResponse): Itinerary | null => {
  if (!plan.itinerary.length) {
    return null
  }

  const destination = plan.planning_state?.destination?.value?.trim() || plan.candidates[0]?.name || 'Planned trip'
  const country = getCountryLabel(plan.planning_state?.region_code)
  const startDate = plan.metadata?.itinerary_generated_at || new Date().toISOString()
  const endDate = addDays(startDate, Math.max(plan.itinerary.length - 1, 0))
  const estimatedTotal = plan.budget.estimated_total ?? null
  const hotelNightlyEstimate =
    estimatedTotal !== null && plan.itinerary.length > 0
      ? Math.max(Math.round(estimatedTotal / Math.max(plan.itinerary.length, 1) / 2), 0)
      : null

  return {
    destination,
    country,
    startDate,
    endDate,
    flights: {
      airline: 'Flexible arrival',
      departure: null,
      arrival: destination,
      price: null,
      date: startDate,
    },
    hotel: {
      name: 'Stay to be selected',
      rating: null,
      price: hotelNightlyEstimate,
      image: '',
    },
    days: plan.itinerary.map((day, dayIndex) => ({
      dayNumber: day.day_number,
      date: addDays(startDate, dayIndex),
      activities: day.stops.map((stop, stopIndex) => {
        const transport = stop.travel_from_previous
        const transportSummary =
          transport && (transport.duration_minutes || transport.mode)
            ? [
                transport.mode ? transport.mode.toUpperCase() : null,
                transport.duration_minutes ? `${transport.duration_minutes} min` : null,
              ]
                .filter(Boolean)
                .join(' | ')
            : null

        return {
          time: DAY_ACTIVITY_TIMES[stopIndex] ?? 'Flexible',
          name: stop.place.name,
          location: stop.place.address || day.theme,
          description: transportSummary ? `${stop.rationale} Travel: ${transportSummary}.` : stop.rationale,
        }
      }),
    })),
    heroImage: getHeroImageForDestination(destination),
  }
}

export const mapPlanningStateToPreferences = (planningState?: PlanningState): Preference[] => {
  if (!planningState) {
    return []
  }

  const preferences: Preference[] = []
  const seenKeys = new Set<string>()
  const pushPreference = (key: string, label: string, value?: string | null) => {
    const normalizedValue = value?.trim()
    if (!normalizedValue || seenKeys.has(key)) {
      return
    }

    seenKeys.add(key)
    preferences.push({
      key,
      label,
      value: normalizedValue,
      icon: getPreferenceIcon(key),
      updated: true,
    })
  }

  pushPreference('budget', 'Budget', planningState.budget?.level ? startCase(planningState.budget.level) : null)

  if (planningState.party) {
    const adults = planningState.party.adults ?? 1
    const children = planningState.party.children ?? 0
    let groupValue = 'Solo'
    if (children > 0) {
      groupValue = 'Family or group travel'
    } else if (adults === 2) {
      groupValue = 'Pair travel'
    } else if (adults > 2) {
      groupValue = 'Group travel'
    }
    pushPreference('group', 'Group', groupValue)
  }

  pushPreference(
    'transport',
    'Transport',
    planningState.transport_preference ? startCase(planningState.transport_preference) : null
  )

  for (const preference of planningState.soft_preferences ?? []) {
    const key = preference.key.toLowerCase()

    if (key.includes('food') || key.includes('diet') || key.includes('vegetarian') || key.includes('vegan')) {
      pushPreference('dietary', 'Dietary', preference.description)
      continue
    }

    if (key.includes('pace') || key.includes('relax') || key.includes('slow') || key.includes('fast')) {
      pushPreference('pace', 'Pace', preference.description)
      continue
    }

    if (
      key.includes('hotel') ||
      key.includes('stay') ||
      key.includes('luxury') ||
      key.includes('hostel') ||
      key.includes('accommodation') ||
      key.includes('lodging')
    ) {
      pushPreference('stay', 'Stay', preference.description)
      continue
    }

    if (key.includes('vibe') || key.includes('culture') || key.includes('nightlife') || key.includes('adventure')) {
      pushPreference('vibe', 'Vibe', preference.description)
      continue
    }

    pushPreference(key, startCase(preference.key), preference.description)
  }

  return preferences
}

export const mapItineraryToCalendarEvents = (itinerary: Itinerary): CalendarExportEvent[] => {
  return itinerary.days.flatMap((day) =>
    day.activities.map((activity, index) => {
      const start = parseActivityDateTime(day.date, activity.time)
      const end = start ? addMinutes(start, 90) : null
      const details = [
        `Trip: ${itinerary.destination}, ${itinerary.country}`,
        `Day ${day.dayNumber}`,
        activity.description || null,
      ]
        .filter(Boolean)
        .join('\n\n')

      return {
        id: `${day.dayNumber}-${index}-${activity.name}`,
        title: activity.name,
        start,
        end,
        location: activity.location,
        details,
        googleCalendarUrl: start && end ? buildGoogleCalendarUrl({
          title: activity.name,
          start,
          end,
          location: activity.location,
          details,
        }) : null,
        isExportable: Boolean(start && end),
      }
    })
  )
}

export const launchGoogleCalendarExport = (itinerary: Itinerary): CalendarExportResult => {
  const events = mapItineraryToCalendarEvents(itinerary)
  const exportableEvents = events.filter((event) => event.isExportable && event.googleCalendarUrl)
  const skippedEvents = events.filter((event) => !event.isExportable)
  const blockedEvents: CalendarExportEvent[] = []
  let openedCount = 0

  for (const event of exportableEvents) {
    const openedWindow = window.open(event.googleCalendarUrl!, '_blank', 'noopener,noreferrer')
    if (openedWindow) {
      openedCount += 1
      continue
    }
    blockedEvents.push(event)
  }

  return {
    exportableEvents,
    skippedEvents,
    blockedEvents,
    openedCount,
  }
}

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
  const response = await fetch(PLANNER_PROXY_PATH, {
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
  const hasVisualItinerary = plan.itinerary.length > 0

  if (plan.follow_up_question) {
    parts.push(plan.follow_up_question)
    if (plan.completeness.missing_information.length) {
      parts.push(`Missing details: ${plan.completeness.missing_information.join(', ')}`)
    }
  } else if (plan.explanation?.trim() && !hasVisualItinerary) {
    parts.push(normalizeMarkdownForChat(plan.explanation))
  } else if (hasVisualItinerary) {
    parts.push('Your itinerary is ready.')
  }

  if (plan.itinerary.length && !hasVisualItinerary) {
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

export const getFollowUpOptions = (plan: TripPlanResponse): string[] => {
  const question = plan.follow_up_question?.toLowerCase() || ''
  const missing = new Set(plan.completeness.missing_information)

  if (!question) {
    return []
  }

  if (question.includes('increase the budget cap') || question.includes('budget as a soft preference')) {
    return ['Increase budget cap', 'Reduce trip days', 'Keep budget flexible']
  }

  if (question.includes('reduce the number of stops') || question.includes('shorten the trip duration')) {
    return ['Reduce stops', 'Shorten trip', 'Do both']
  }

  if (missing.has('destination')) {
    return ['Tokyo, Japan', 'Las Vegas, NV', 'Other']
  }

  if (missing.has('origin')) {
    return ['Phoenix, AZ', 'New York City', 'Other']
  }

  if (missing.has('trip_planning_intent')) {
    return ['Full itinerary plan', 'Quick travel answer']
  }

  return []
}
