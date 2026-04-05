'use client'

import { AuthScreen } from './AuthScreen'
import { CenterPanel } from './CenterPanel'
import { LeftPanel } from './LeftPanel'
import { RightPanel } from './RightPanel'
import { useAuthStore } from '@/store/authStore'

const AuthLoadingScreen = () => (
  <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#fffbf7_0%,_#fafaf8_55%,_#f5f3f0_100%)] px-4">
    <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/80 p-8 text-center shadow-xl backdrop-blur-sm">
      <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-gradient-to-br from-teal to-ocean" />
      <h1 className="text-xl font-semibold text-text-primary">Preparing your travel workspace</h1>
      <p className="mt-2 text-sm leading-6 text-text-secondary">
        Restoring your mock session and preferences.
      </p>
    </div>
  </main>
)

export const AuthGate = () => {
  const isHydrated = useAuthStore((state) => state.isHydrated)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isHydrated) {
    return <AuthLoadingScreen />
  }

  if (!isAuthenticated) {
    return <AuthScreen />
  }

  return (
    <main className="h-screen w-full overflow-hidden bg-warm-white">
      <LeftPanel />
      <CenterPanel />
      <RightPanel />
    </main>
  )
}
