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
  referenced_blog_posts?: string[]
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

interface MockForecast {
  condition: 'sunny' | 'cloudy' | 'rainy'
  emoji: string
  temperature: number
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
  referenced_blog_posts?: string[]
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

type MockDestinationKey = 'vegas' | 'japan'

const PLANNER_PROXY_PATH = '/api/planner/plan'

const DAY_ACTIVITY_TIMES = ['09:00', '11:30', '14:30', '17:30', '20:00']

const MOCK_DESTINATIONS: Record<
  MockDestinationKey,
  {
    destination: string
    country: string
    regionCode: string
    candidateNames: string[]
    itinerary: Array<{
      theme: string
      stops: Array<{ name: string; rationale: string; address: string }>
    }>
  }
> = {
  vegas: {
    destination: 'Las Vegas',
    country: 'USA',
    regionCode: 'US',
    candidateNames: ['Bellagio Fountains', 'The Venetian', 'AREA15', 'Fremont Street Experience'],
    itinerary: [
      {
        theme: 'Las Vegas Strip Highlights',
        stops: [
          {
            name: 'Bellagio Conservatory & Fountains',
            rationale: 'A polished first stop with classic Vegas energy and easy photo moments.',
            address: '3600 S Las Vegas Blvd, Las Vegas, NV',
          },
          {
            name: 'Eataly Las Vegas',
            rationale: 'A food-forward lunch stop that fits a presentation-friendly weekend itinerary.',
            address: '3770 S Las Vegas Blvd, Las Vegas, NV',
          },
          {
            name: 'The Venetian Grand Canal',
            rationale: 'Keeps the pace relaxed while still feeling iconic and high-energy.',
            address: '3355 S Las Vegas Blvd, Las Vegas, NV',
          },
        ],
      },
      {
        theme: 'Downtown and Entertainment',
        stops: [
          {
            name: 'Bouchon Bakery',
            rationale: 'An easy brunch start with a recognizable food stop.',
            address: '3355 S Las Vegas Blvd, Las Vegas, NV',
          },
          {
            name: 'AREA15',
            rationale: 'Adds a modern immersive venue to keep the plan visually exciting.',
            address: '3215 S Rancho Dr, Las Vegas, NV',
          },
          {
            name: 'Fremont Street Experience',
            rationale: 'Wraps the trip with a different side of Vegas and strong evening energy.',
            address: '425 Fremont St, Las Vegas, NV',
          },
        ],
      },
    ],
  },
  japan: {
    destination: 'Tokyo',
    country: 'Japan',
    regionCode: 'JP',
    candidateNames: ['Senso-ji Temple', 'Tsukiji Outer Market', 'Shibuya Crossing', 'Meiji Shrine'],
    itinerary: [
      {
        theme: 'Tokyo Classics',
        stops: [
          {
            name: 'Senso-ji Temple',
            rationale: 'A strong cultural anchor that makes the trip feel unmistakably Tokyo.',
            address: '2 Chome-3-1 Asakusa, Taito City, Tokyo',
          },
          {
            name: 'Tsukiji Outer Market',
            rationale: 'Gives the itinerary an easy food focus with crowd-pleasing variety.',
            address: '4 Chome-16-2 Tsukiji, Chuo City, Tokyo',
          },
          {
            name: 'Shibuya Crossing',
            rationale: 'Adds the high-energy city moment people expect from a Japan trip.',
            address: '2 Chome-2-1 Dogenzaka, Shibuya City, Tokyo',
          },
        ],
      },
      {
        theme: 'Shrines and Neighborhoods',
        stops: [
          {
            name: 'Meiji Shrine',
            rationale: 'Balances the trip with a calmer stop and a clear change of pace.',
            address: '1-1 Yoyogikamizonocho, Shibuya City, Tokyo',
          },
          {
            name: 'Harajuku Food Street',
            rationale: 'Keeps the food thread going with casual snacks and street energy.',
            address: '1 Chome Jingumae, Shibuya City, Tokyo',
          },
          {
            name: 'Tokyo Metropolitan Government Building',
            rationale: 'Ends with a simple skyline viewpoint that works well in a weekend draft.',
            address: '2 Chome-8-1 Nishishinjuku, Shinjuku City, Tokyo',
          },
        ],
      },
    ],
  },
}

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

const normalizeDestinationAndCountry = (destination: string, regionCode?: string) => {
  const fallbackCountry = getCountryLabel(regionCode)
  const segments = destination
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length < 2) {
    return {
      destination,
      country: fallbackCountry,
    }
  }

  const countryCandidate = segments[segments.length - 1]
  const normalizedCountryCandidate = countryCandidate.toLowerCase()

  if (normalizedCountryCandidate === 'usa' || normalizedCountryCandidate === 'united states') {
    return {
      destination,
      country: fallbackCountry,
    }
  }

  return {
    destination: segments.slice(0, -1).join(', '),
    country: countryCandidate,
  }
}

const getHeroImageForDestination = (destination: string, country?: string): string => {
  const normalizedDestination = destination.trim().toLowerCase()
  const normalizedCountry = (country || '').trim().toLowerCase()

  if (normalizedCountry.includes('japan') || normalizedDestination.includes('japan')) {
    return '/images/posters/japan.png'
  }
  if (normalizedDestination.includes('vegas') || normalizedDestination.includes('las vegas')) {
    return '/images/posters/vegas.png'
  }

  return 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1600&h=1000&fit=crop'
}

const addDays = (isoDate: string, daysToAdd: number): string => {
  const date = new Date(isoDate)
  date.setDate(date.getDate() + daysToAdd)
  return date.toISOString()
}

const inferRequestedDayCount = (prompt: string): number => {
  const lower = prompt.toLowerCase()
  const explicitMatch = lower.match(/\b(\d+)\s*-\s*day\b|\b(\d+)\s+days?\b/)
  const parsedExplicit = explicitMatch ? Number(explicitMatch[1] || explicitMatch[2]) : null

  if (parsedExplicit && !Number.isNaN(parsedExplicit)) {
    return Math.max(1, Math.min(parsedExplicit, 5))
  }
  if (lower.includes('weekend')) {
    return 2
  }
  return 2
}

const inferOriginFromPrompt = (prompt: string): string | null => {
  const match = prompt.match(
    /\bfrom\s+([A-Za-z][A-Za-z\s.,'-]+?)(?:\s+\b(?:to|in|for|with|under|within|on)\b|[.!?,]|$)/i
  )

  return match?.[1]?.trim() || null
}

const inferMockDestinationKey = (prompt: string): MockDestinationKey | null => {
  const lower = prompt.toLowerCase()

  if (
    ['tokyo', 'japan', 'kyoto', 'osaka', 'shibuya', 'hakone'].some((term) => lower.includes(term))
  ) {
    return 'japan'
  }

  if (['vegas', 'las vegas', 'nevada strip'].some((term) => lower.includes(term))) {
    return 'vegas'
  }

  return null
}

const buildFallbackPlanningState = (
  payload: TravelPlanningRequest,
  destinationKey: MockDestinationKey | null,
  origin: string | null,
  requestedDays: number
): PlanningState => {
  const destinationConfig = destinationKey ? MOCK_DESTINATIONS[destinationKey] : null

  return {
    destination: {
      value: destinationConfig?.destination || 'Unknown destination',
    },
    duration: {
      selected_days: destinationConfig ? requestedDays : null,
      min_days: destinationConfig ? requestedDays : null,
      max_days: destinationConfig ? requestedDays : null,
    },
    budget: {
      currency_code: payload.currency_code,
      level: payload.prompt.toLowerCase().includes('luxury')
        ? 'luxury'
        : payload.prompt.toLowerCase().includes('moderate')
          ? 'moderate'
          : payload.prompt.toLowerCase().includes('budget')
            ? 'low'
            : 'moderate',
      hard_cap: false,
    },
    party: {
      adults: 1,
      children: 0,
    },
    transport_preference: payload.transport_preference,
    unknowns: [
      ...(destinationConfig ? [] : ['destination']),
      ...(destinationConfig && !origin ? ['origin'] : []),
    ],
    assumptions: ['Using a presentation fallback while the live planner is unavailable.'],
    language_code: payload.language_code,
    region_code: destinationConfig?.regionCode || payload.region_code,
    currency_code: payload.currency_code,
  }
}

const buildMockDayPlan = (
  destinationKey: MockDestinationKey,
  requestedDays: number
): DayPlan[] => {
  const config = MOCK_DESTINATIONS[destinationKey]

  return Array.from({ length: requestedDays }, (_, index) => {
    const template = config.itinerary[index % config.itinerary.length]
    return {
      day_number: index + 1,
      theme: template.theme,
      stops: template.stops.map((stop, stopIndex) => ({
        order: stopIndex + 1,
        place: {
          name: stop.name,
          address: stop.address,
        },
        rationale: stop.rationale,
        travel_from_previous:
          stopIndex === 0
            ? null
            : {
                mode: destinationKey === 'japan' ? 'transit' : 'drive',
                duration_minutes: 20 + stopIndex * 10,
              },
      })),
    }
  })
}

const buildPresentationFallbackPlan = (payload: TravelPlanningRequest): TripPlanResponse => {
  const destinationKey = inferMockDestinationKey(payload.prompt)
  const origin = inferOriginFromPrompt(payload.prompt)
  const requestedDays = inferRequestedDayCount(payload.prompt)
  const planningState = buildFallbackPlanningState(payload, destinationKey, origin, requestedDays)

  if (!destinationKey) {
    return {
      session_id: payload.session_id,
      completeness: {
        status: 'incomplete',
        reason: 'Destination is missing. Share the city/region/country to plan for.',
        missing_information: ['destination'],
        follow_up_question: 'Destination is missing. Share the city/region/country to plan for.',
      },
      feasibility: {
        status: 'needs_more_info',
        reason: 'A destination is required before a mock itinerary can be drafted.',
        missing_information: ['destination'],
        follow_up_question: 'Destination is missing. Share the city/region/country to plan for.',
      },
      follow_up_question: 'Destination is missing. Share the city/region/country to plan for.',
      planning_state: planningState,
      explanation: 'Tell me the destination and I can keep the presentation moving with a quick draft.',
      warnings: ['Using a presentation fallback because the live planner is unavailable right now.'],
      referenced_blog_posts: payload.referenced_blog_posts ?? [],
      itinerary: [],
      candidates: [],
      budget: {
        estimated_total: null,
        currency_code: payload.currency_code,
        confidence: 'low',
      },
      metadata: {
        itinerary_generated_at: new Date().toISOString(),
      },
    }
  }

  if (!origin) {
    return {
      session_id: payload.session_id,
      completeness: {
        status: 'incomplete',
        reason: 'Origin is missing. Share where you will start your trip from.',
        missing_information: ['origin'],
        follow_up_question: 'Origin is missing. Share where you will start your trip from.',
      },
      feasibility: {
        status: 'needs_more_info',
        reason: 'An origin helps frame the route before we generate the mock itinerary.',
        missing_information: ['origin'],
        follow_up_question: 'Origin is missing. Share where you will start your trip from.',
      },
      follow_up_question: 'Origin is missing. Share where you will start your trip from.',
      planning_state: planningState,
      explanation: 'Once you share the starting point, I can draft the fallback itinerary.',
      warnings: ['Using a presentation fallback because the live planner is unavailable right now.'],
      referenced_blog_posts: payload.referenced_blog_posts ?? [],
      itinerary: [],
      candidates: MOCK_DESTINATIONS[destinationKey].candidateNames.map((name) => ({ name })),
      budget: {
        estimated_total: destinationKey === 'japan' ? 1800 : 420,
        currency_code: payload.currency_code,
        confidence: 'medium',
      },
      metadata: {
        itinerary_generated_at: new Date().toISOString(),
      },
    }
  }

  const destinationConfig = MOCK_DESTINATIONS[destinationKey]

  return {
    session_id: payload.session_id,
    completeness: {
      status: 'complete',
      reason: 'Using a presentation-safe fallback itinerary.',
      missing_information: [],
      follow_up_question: null,
    },
    feasibility: {
      status: 'feasible',
      reason: 'A mock itinerary was created from the available origin and destination.',
      missing_information: [],
      follow_up_question: null,
    },
    follow_up_question: null,
    planning_state: planningState,
    explanation: `I put together a quick ${requestedDays}-day fallback plan from ${origin} to ${destinationConfig.destination}.`,
    warnings: ['Using a presentation fallback because the live planner is unavailable right now.'],
    referenced_blog_posts: payload.referenced_blog_posts ?? [],
    itinerary: buildMockDayPlan(destinationKey, requestedDays),
    candidates: destinationConfig.candidateNames.map((name) => ({ name })),
    budget: {
      estimated_total: destinationKey === 'japan' ? 1800 + Math.max(requestedDays - 2, 0) * 300 : 420 + Math.max(requestedDays - 2, 0) * 120,
      currency_code: payload.currency_code,
      confidence: 'medium',
    },
    metadata: {
      itinerary_generated_at: new Date().toISOString(),
    },
  }
}

const WEATHER_OPTIONS: MockForecast[] = [
  { condition: 'sunny', emoji: '☀️', temperature: 78 },
  { condition: 'cloudy', emoji: '☁️', temperature: 68 },
  { condition: 'rainy', emoji: '🌧️', temperature: 64 },
]

const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min

const buildMockForecast = (dayCount: number): MockForecast[] => {
  if (dayCount <= 0) {
    return []
  }

  const forecast = Array.from({ length: dayCount }, () => {
    const template = WEATHER_OPTIONS[randomInt(0, WEATHER_OPTIONS.length - 1)]
    const temperatureVariance =
      template.condition === 'sunny' ? randomInt(-4, 8) : template.condition === 'cloudy' ? randomInt(-5, 5) : randomInt(-6, 3)

    return {
      ...template,
      temperature: template.temperature + temperatureVariance,
    }
  })

  if (!forecast.some((day) => day.condition === 'rainy')) {
    const rainyIndex = randomInt(0, forecast.length - 1)
    forecast[rainyIndex] = {
      condition: 'rainy',
      emoji: '🌧️',
      temperature: randomInt(58, 68),
    }
  }

  return forecast
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

  const rawDestination =
    plan.planning_state?.destination?.value?.trim() || plan.candidates[0]?.name || 'Planned trip'
  const { destination, country } = normalizeDestinationAndCountry(
    rawDestination,
    plan.planning_state?.region_code
  )
  const startDate = plan.metadata?.itinerary_generated_at || new Date().toISOString()
  const endDate = addDays(startDate, Math.max(plan.itinerary.length - 1, 0))
  const estimatedTotal = plan.budget.estimated_total ?? null
  const hotelNightlyEstimate =
    estimatedTotal !== null && plan.itinerary.length > 0
      ? Math.max(Math.round(estimatedTotal / Math.max(plan.itinerary.length, 1) / 2), 0)
      : null
  const mockForecast = buildMockForecast(plan.itinerary.length)

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
      weather: mockForecast[dayIndex] ?? {
        condition: 'cloudy',
        emoji: '☁️',
        temperature: 68,
      },
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
    heroImage: getHeroImageForDestination(destination, country),
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
  try {
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
      return buildPresentationFallbackPlan(payload)
    }

    return body as TripPlanResponse
  } catch {
    return buildPresentationFallbackPlan(payload)
  }
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

  if (plan.referenced_blog_posts?.length) {
    parts.push(`Referenced trip memory:\n- ${plan.referenced_blog_posts.join('\n- ')}`)
  }

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

  if (plan.itinerary.length > 0) {
    return ['Make it cheaper', 'Add food spots', 'Change the pace']
  }

  if (plan.candidates.length > 0) {
    return ['Build the itinerary', 'Show more options', 'Add a budget cap']
  }

  return ['Weekend trip ideas', 'Food-focused plan', 'Quick day trip']
}
