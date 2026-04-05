import { ArrowRightIcon, CompassIcon } from './Icons'

export const AuthScreen = () => {
  return (
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(20,145,155,0.18),_transparent_38%),linear-gradient(180deg,_#fffbf7_0%,_#fafaf8_45%,_#f5f3f0_100%)] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-center">
        <div className="grid max-h-full w-full overflow-hidden rounded-[28px] border border-white/70 bg-white/85 shadow-xl backdrop-blur-sm lg:grid-cols-[1.1fr_0.9fr]">
          <section className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-ocean via-teal to-teal-light p-8 text-white sm:p-10 lg:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.2),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(255,251,247,0.25),_transparent_35%)]" />

            <div className="relative">
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium">
                <CompassIcon size={18} className="text-white" />
                <span>TripMind</span>
              </div>

              <div className="max-w-xl space-y-5">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/75">
                  Intelligent travel companion
                </p>
                <h1 className="font-serif text-3xl leading-tight">
                  Plan better trips with memory, taste, and live trip context in one workspace.
                </h1>
                <p className="max-w-lg text-base leading-7 text-white/82 sm:text-lg">
                  TripMind turns your past travel patterns, destination preferences, and in-trip
                  updates into a planning experience that feels personal from the very first message.
                </p>
              </div>
            </div>

            <div className="relative mt-10 grid gap-4 sm:grid-cols-3">
              {[
                ['Personalized planning', 'Save your travel style so every itinerary starts closer to your taste.'],
                ['Shared memory', 'Keep favorite trips, inspiration, and future plans connected in one account.'],
                ['Adaptive trips', 'Get a companion that can react when weather, pace, or plans change.'],
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
                <h2 className="mt-6 text-3xl font-bold tracking-tight text-text-primary">
                  Access your travel workspace
                </h2>
                <p className="mt-3 text-sm leading-6 text-text-secondary">
                  Sign in to continue planning, revisit saved itineraries, and keep your travel DNA
                  synced across future trips.
                </p>
              </div>

              <div className="space-y-4">
                <a
                  href="/auth/login"
                  className="group flex w-full items-center justify-center gap-2 rounded-full bg-teal px-5 py-3 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.01] hover:bg-teal-light focus:outline-none focus:ring-4 focus:ring-teal/20"
                >
                  <span>Sign in</span>
                  <ArrowRightIcon size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
                </a>

                <a
                  href="/auth/login?screen_hint=signup"
                  className="group flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-text-primary transition-all duration-300 hover:scale-[1.01] hover:border-teal hover:text-teal focus:outline-none focus:ring-4 focus:ring-teal/10"
                >
                  <span>Create account</span>
                  <ArrowRightIcon size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
                </a>
              </div>

              <div className="mt-6 rounded-2xl border border-gray-100 bg-off-white/80 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-text-primary">What you&apos;ll unlock</p>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                      Save trip preferences, resume planning sessions, and build toward a persistent
                      library of itineraries and travel memories.
                    </p>
                  </div>
                  <span className="whitespace-nowrap rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Secured by Auth0
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
