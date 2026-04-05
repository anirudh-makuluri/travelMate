'use client'

import { FormEvent, useState } from 'react'
import { ArrowRightIcon, CompassIcon } from './Icons'
import { useAuthStore } from '@/store/authStore'

export const AuthScreen = () => {
  const signIn = useAuthStore((state) => state.signIn)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const result = signIn(email, password)
    if (!result.success) {
      setError(result.error ?? 'Something went wrong.')
    }
  }

  const title = mode === 'signin' ? 'Welcome back to TripMind' : 'Create your TripMind account'
  const subtitle =
    mode === 'signin'
      ? 'Use any email and a 6+ character password to enter the mock auth flow.'
      : 'This is a temporary Auth0 placeholder so we can design the entry experience now.'

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,145,155,0.18),_transparent_38%),linear-gradient(180deg,_#fffbf7_0%,_#fafaf8_45%,_#f5f3f0_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/70 bg-white/85 shadow-xl backdrop-blur-sm lg:grid-cols-[1.1fr_0.9fr]">
          <section className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-ocean via-teal to-teal-light p-8 text-white sm:p-10 lg:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.2),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(255,251,247,0.25),_transparent_35%)]" />

            <div className="relative">
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium">
                <CompassIcon size={18} className="text-white" />
                <span>TripMind</span>
              </div>

              <div className="max-w-xl space-y-5">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/75">
                  Mock Auth
                </p>
                <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
                  Travel planning that remembers your style before the first prompt.
                </h1>
                <p className="max-w-lg text-base leading-7 text-white/82 sm:text-lg">
                  We&apos;re using a temporary email and password screen now so the product can feel
                  complete while we wire up Auth0 next.
                </p>
              </div>
            </div>

            <div className="relative mt-10 grid gap-4 sm:grid-cols-3">
              {[
                ['Personalized', 'Store travel DNA and start every trip with your real preferences.'],
                ['Companion-ready', 'Keep plans, reminders, and adaptive itinerary changes tied to one account.'],
                ['Auth0 next', 'Swap this shell for real identity once the product flow is locked in.'],
              ].map(([label, copy]) => (
                <div key={label} className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-lg">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="mt-2 text-sm leading-6 text-white/72">{copy}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white/90 p-6 sm:p-8 lg:p-12">
            <div className="mx-auto max-w-md">
              <div className="mb-8">
                <div className="inline-flex rounded-full border border-gray-200 bg-off-white p-1">
                  <button
                    type="button"
                    onClick={() => setMode('signin')}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                      mode === 'signin'
                        ? 'bg-white text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                      mode === 'signup'
                        ? 'bg-white text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Create account
                  </button>
                </div>

                <h2 className="mt-6 text-3xl font-bold tracking-tight text-text-primary">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-text-secondary">{subtitle}</p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-text-primary">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-full border border-gray-200 bg-warm-white px-4 py-3 text-sm text-text-primary outline-none transition-all placeholder:text-text-muted focus:border-teal focus:ring-4 focus:ring-teal/10"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium text-text-primary">
                      Password
                    </label>
                    <span className="text-xs text-text-muted">6+ characters for the mock flow</span>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter password"
                    className="w-full rounded-full border border-gray-200 bg-warm-white px-4 py-3 text-sm text-text-primary outline-none transition-all placeholder:text-text-muted focus:border-teal focus:ring-4 focus:ring-teal/10"
                  />
                </div>

                {error && (
                  <div className="rounded-2xl border border-error/15 bg-error-light px-4 py-3 text-sm text-error">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-teal px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-teal-light focus:outline-none focus:ring-4 focus:ring-teal/20"
                >
                  <span>{mode === 'signin' ? 'Enter TripMind' : 'Create demo account'}</span>
                  <ArrowRightIcon size={18} />
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-gray-100 bg-off-white/80 p-4">
                <p className="text-sm font-medium text-text-primary">Temporary implementation notes</p>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  This page accepts any valid-looking email and any password with at least 6
                  characters. The session is stored locally so refresh keeps you signed in until you
                  sign out.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
