import { create } from 'zustand'

export interface Preference {
  key: string
  icon: string
  label: string
  value: string
  updated?: boolean
}

export interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  isTyping?: boolean
  options?: string[]
  showOtherOption?: boolean
}

export interface Itinerary {
  destination: string
  country: string
  startDate: string
  endDate: string
  flights: {
    airline: string
    departure: string
    arrival: string
    price: number
    date: string
  }
  hotel: {
    name: string
    rating: number
    price: number
    image: string
  }
  days: Array<{
    dayNumber: number
    date: string
    activities: Array<{
      time: string
      name: string
      location: string
      description?: string
    }>
  }>
  heroImage: string
  blogId?: string
}

export type FlowStep =
  | 'awaiting-destination'
  | 'awaiting-itinerary-request'
  | 'awaiting-preferences'
  | 'awaiting-preferences-custom'
  | 'awaiting-adventure-update'
  | 'awaiting-companion-mode'
  | 'in-trip'
  | 'completed'

export interface TripMemoryItem {
  id: string
  destination: string
  country: string
  date: string
  year: string
  status: 'Completed' | 'Ongoing'
  source: 'mine' | 'friends'
  summary: string
  image?: string
  friendName?: string
  friendAvatar?: string
}

interface WorkspaceState {
  preferences: Preference[]
  messages: Message[]
  itinerary: Itinerary | null
  isRecording: boolean
  flowStep: FlowStep
  itineraryInlineAfterMessageId: string | null
  tripMemories: TripMemoryItem[]
}

interface AppStore {
  workspaces: Record<string, WorkspaceState>
  ensureWorkspace: (userId: string) => void
  replacePreferences: (userId: string, values: Partial<Record<string, string>>) => void
  updatePreference: (userId: string, key: string, value: string) => void
  messagesForUser: (userId: string) => Message[]
  addMessage: (userId: string, message: Omit<Message, 'id'> & { id?: string }) => void
  setTypingStatus: (userId: string, isTyping: boolean) => void
  clearMessages: (userId: string) => void
  itineraryForUser: (userId: string) => Itinerary | null
  setItinerary: (userId: string, itinerary: Itinerary | null) => void
  isRecordingForUser: (userId: string) => boolean
  setRecording: (userId: string, recording: boolean) => void
  flowStepForUser: (userId: string) => FlowStep
  setFlowStep: (userId: string, flowStep: FlowStep) => void
  itineraryInlineAfterMessageIdForUser: (userId: string) => string | null
  setItineraryInlineAfterMessageId: (userId: string, messageId: string | null) => void
  tripMemoriesForUser: (userId: string) => TripMemoryItem[]
  upsertTripMemory: (userId: string, memory: TripMemoryItem) => void
  resetApp: (userId: string) => void
}

const initialPreferences: Preference[] = [
  { key: 'budget', icon: '💰', label: 'Budget', value: '$$ (Mid-range)' },
  { key: 'vibe', icon: '🎯', label: 'Vibe', value: 'Relaxed' },
  { key: 'pace', icon: '🚶', label: 'Pace', value: 'Slow explorer' },
  { key: 'dietary', icon: '🥗', label: 'Dietary', value: 'Vegetarian' },
  { key: 'stay', icon: '🏨', label: 'Stay', value: 'Boutique hotels' },
  { key: 'group', icon: '👤', label: 'Group', value: 'Solo' },
]

const baseTripMemories: TripMemoryItem[] = [
  {
    id: 'my-las-vegas',
    destination: 'Las Vegas',
    country: 'USA',
    image: '/images/posters/vegas.png',
    date: 'Mar 20 - Mar 24',
    year: '2024',
    status: 'Completed',
    source: 'mine',
    summary: 'A high-energy city break with nightlife, shows, and hotel-hopping.',
  },
  {
    id: 'my-vermont',
    destination: 'Vermont',
    country: 'USA',
    image: '/images/posters/vermount.png',
    date: 'Oct 10 - Oct 13',
    year: '2024',
    status: 'Completed',
    source: 'mine',
    summary: 'A slower foliage weekend with small towns, scenic drives, and cozy stays.',
  },
  {
    id: 'friend-tokyo-sarah',
    destination: 'Tokyo',
    country: 'Japan',
    image: '/images/posters/japan.png',
    date: 'Apr 1 - Apr 14',
    year: '2024',
    status: 'Completed',
    source: 'friends',
    summary: 'Sarah based the trip in Shibuya and used Hakone as an easy day escape.',
    friendName: 'Sarah',
    friendAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
  },
]

const createInitialWorkspace = (): WorkspaceState => ({
  preferences: initialPreferences.map((preference) => ({ ...preference, updated: false })),
  messages: [],
  itinerary: null,
  isRecording: false,
  flowStep: 'awaiting-destination',
  itineraryInlineAfterMessageId: null,
  tripMemories: [...baseTripMemories],
})

const getWorkspace = (state: AppStore, userId: string) =>
  state.workspaces[userId] ?? createInitialWorkspace()

const updateWorkspace = (
  state: AppStore,
  userId: string,
  updater: (workspace: WorkspaceState) => WorkspaceState
) => ({
  workspaces: {
    ...state.workspaces,
    [userId]: updater(getWorkspace(state, userId)),
  },
})

export const useAppStore = create<AppStore>((set, get) => ({
  workspaces: {},

  ensureWorkspace: (userId: string) =>
    set((state) => {
      if (state.workspaces[userId]) return state
      return updateWorkspace(state, userId, (workspace) => workspace)
    }),

  replacePreferences: (userId: string, values: Partial<Record<string, string>>) =>
    set((state) =>
      updateWorkspace(state, userId, (workspace) => ({
        ...workspace,
        preferences: workspace.preferences.map((pref) =>
          values[pref.key] ? { ...pref, value: values[pref.key]!, updated: false } : pref
        ),
      }))
    ),

  updatePreference: (userId: string, key: string, value: string) =>
    set((state) =>
      updateWorkspace(state, userId, (workspace) => ({
        ...workspace,
        preferences: workspace.preferences.map((pref) =>
          pref.key === key ? { ...pref, value, updated: true } : pref
        ),
      }))
    ),

  messagesForUser: (userId: string) => getWorkspace(get(), userId).messages,

  addMessage: (userId: string, message: Omit<Message, 'id'> & { id?: string }) =>
    set((state) =>
      updateWorkspace(state, userId, (workspace) => ({
        ...workspace,
        messages: [
          ...workspace.messages,
          {
            ...message,
            id: message.id ?? `msg-${Date.now()}`,
          },
        ],
      }))
    ),

  setTypingStatus: (userId: string, isTyping: boolean) =>
    set((state) =>
      updateWorkspace(state, userId, (workspace) => {
        if (isTyping) {
          return {
            ...workspace,
            messages: [
              ...workspace.messages,
              {
                id: `typing-${Date.now()}`,
                role: 'agent',
                content: 'Agent thinking',
                timestamp: new Date(),
                isTyping: true,
              },
            ],
          }
        }

        return {
          ...workspace,
          messages: workspace.messages.filter((message) => !message.isTyping),
        }
      })
    ),

  clearMessages: (userId: string) =>
    set((state) =>
      updateWorkspace(state, userId, (workspace) => ({
        ...workspace,
        messages: [],
      }))
    ),

  itineraryForUser: (userId: string) => getWorkspace(get(), userId).itinerary,

  setItinerary: (userId: string, itinerary: Itinerary | null) =>
    set((state) =>
      updateWorkspace(state, userId, (workspace) => ({
        ...workspace,
        itinerary,
      }))
    ),

  isRecordingForUser: (userId: string) => getWorkspace(get(), userId).isRecording,

  setRecording: (userId: string, recording: boolean) =>
    set((state) =>
      updateWorkspace(state, userId, (workspace) => ({
        ...workspace,
        isRecording: recording,
      }))
    ),

  flowStepForUser: (userId: string) => getWorkspace(get(), userId).flowStep,

  setFlowStep: (userId: string, flowStep: FlowStep) =>
    set((state) =>
      updateWorkspace(state, userId, (workspace) => ({
        ...workspace,
        flowStep,
      }))
    ),

  itineraryInlineAfterMessageIdForUser: (userId: string) =>
    getWorkspace(get(), userId).itineraryInlineAfterMessageId,

  setItineraryInlineAfterMessageId: (userId: string, messageId: string | null) =>
    set((state) =>
      updateWorkspace(state, userId, (workspace) => ({
        ...workspace,
        itineraryInlineAfterMessageId: messageId,
      }))
    ),

  tripMemoriesForUser: (userId: string) => getWorkspace(get(), userId).tripMemories,

  upsertTripMemory: (userId: string, memory: TripMemoryItem) =>
    set((state) =>
      updateWorkspace(state, userId, (workspace) => {
        const existingIndex = workspace.tripMemories.findIndex((item) => item.id === memory.id)
        const tripMemories =
          existingIndex === -1
            ? [memory, ...workspace.tripMemories]
            : workspace.tripMemories.map((item, index) => (index === existingIndex ? memory : item))

        return {
          ...workspace,
          tripMemories,
        }
      })
    ),

  resetApp: (userId: string) =>
    set((state) => ({
      workspaces: {
        ...state.workspaces,
        [userId]: createInitialWorkspace(),
      },
    })),
}))
