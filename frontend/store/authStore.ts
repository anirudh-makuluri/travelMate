import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface MockUser {
  email: string
  name: string
}

interface AuthState {
  user: MockUser | null
  isAuthenticated: boolean
  isHydrated: boolean
  signIn: (email: string, password: string) => { success: boolean; error?: string }
  signOut: () => void
  setHydrated: (hydrated: boolean) => void
}

const getDisplayName = (email: string) => {
  const [localPart] = email.split('@')
  return localPart
    .split(/[.\-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isHydrated: false,

      signIn: (email, password) => {
        const normalizedEmail = email.trim().toLowerCase()

        if (!normalizedEmail || !normalizedEmail.includes('@')) {
          return { success: false, error: 'Enter a valid email address.' }
        }

        if (password.trim().length < 6) {
          return { success: false, error: 'Password must be at least 6 characters.' }
        }

        set({
          user: {
            email: normalizedEmail,
            name: getDisplayName(normalizedEmail) || 'Traveler',
          },
          isAuthenticated: true,
        })

        return { success: true }
      },

      signOut: () =>
        set({
          user: null,
          isAuthenticated: false,
        }),

      setHydrated: (hydrated) => set({ isHydrated: hydrated }),
    }),
    {
      name: 'tripmind-mock-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    }
  )
)
