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
}

interface AppStore {
  // Preferences
  preferences: Preference[]
  updatePreference: (key: string, value: string) => void
  
  // Messages
  messages: Message[]
  addMessage: (message: Omit<Message, 'id'> & { id?: string }) => void
  setTypingStatus: (isTyping: boolean) => void
  clearMessages: () => void
  
  // Itinerary
  itinerary: Itinerary | null
  setItinerary: (itinerary: Itinerary) => void
  
  // UI State
  isRecording: boolean
  setRecording: (recording: boolean) => void
  resetApp: () => void
}

const initialPreferences: Preference[] = [
  { key: 'budget', icon: '💰', label: 'Budget', value: '$$ (Mid-range)' },
  { key: 'vibe', icon: '🎯', label: 'Vibe', value: 'Relaxed' },
  { key: 'pace', icon: '🚶', label: 'Pace', value: 'Slow explorer' },
  { key: 'dietary', icon: '🥗', label: 'Dietary', value: 'Vegetarian' },
  { key: 'stay', icon: '🏨', label: 'Stay', value: 'Boutique hotels' },
  { key: 'group', icon: '👤', label: 'Group', value: 'Solo' },
]

export const useAppStore = create<AppStore>((set) => ({
  preferences: initialPreferences,
  
  updatePreference: (key: string, value: string) =>
    set((state: AppStore) => ({
      preferences: state.preferences.map((pref: Preference) =>
        pref.key === key ? { ...pref, value, updated: true } : pref
      ),
    })),
  
  messages: [],
  
  addMessage: (message: Omit<Message, 'id'> & { id?: string }) =>
    set((state: AppStore) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: message.id ?? `msg-${Date.now()}`,
        },
      ],
    })),
  
  setTypingStatus: (isTyping: boolean) =>
    set((state: AppStore) => {
      if (isTyping) {
        return {
          messages: [
            ...state.messages,
            {
              id: `typing-${Date.now()}`,
              role: 'agent',
              content: 'Agent thinking',
              timestamp: new Date(),
              isTyping: true,
            },
          ],
        }
      } else {
        return {
          messages: state.messages.filter((m: Message) => !m.isTyping),
        }
      }
    }),
  
  clearMessages: () => set({ messages: [] }),
  
  itinerary: null,
  setItinerary: (itinerary: Itinerary) => set({ itinerary }),
  
  isRecording: false,
  setRecording: (recording: boolean) => set({ isRecording: recording }),

  resetApp: () =>
    set({
      preferences: initialPreferences.map((preference) => ({ ...preference, updated: false })),
      messages: [],
      itinerary: null,
      isRecording: false,
    }),
}))
