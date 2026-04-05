'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import type { Message, Preference } from '@/store/appStore'
import { CompassIcon, LogOutIcon, MicIcon, SendIcon, UserIcon } from './Icons'
import { ItineraryCard } from './ItineraryCard'
import { cn } from '@/lib/utils'
import {
  type CalendarExportResult,
  formatTripPlanForChat,
  getFollowUpOptions,
  inferTransportPreference,
  mapPlanningStateToPreferences,
  mapTripPlanToItinerary,
  planTrip,
} from '@/lib/plannerApi'

interface CenterPanelProps {
  userId: string
  userEmail?: string
  userName?: string
}

const STARTER_PROMPTS = [
  'Plan a weekend trip from Phoenix to Las Vegas with food spots and shows.',
  'Plan a weekend trip from Phoenix to Tokyo with great food and iconic sights.',
  'Build me a weekend food trip with a moderate budget.',
]

const PACE_OPTIONS = ['Slow explorer', 'Medium explorer', 'Fast explorer']

const formatPlannerPromptWithPreferences = (
  userMessage: string,
  preferences: Array<{ label: string; value: string }>
) => {
  if (!preferences.length) {
    return userMessage
  }

  const preferenceSummary = preferences.map((preference) => `${preference.label}: ${preference.value}`).join('; ')
  return `${userMessage}\n\nTraveler preferences: ${preferenceSummary}.`
}

const cyclePacePreference = (currentValue?: string) => {
  const normalizedCurrent = currentValue?.trim().toLowerCase()
  const currentIndex = PACE_OPTIONS.findIndex((option) => option.toLowerCase() === normalizedCurrent)

  if (currentIndex === -1) {
    return PACE_OPTIONS[1]
  }

  return PACE_OPTIONS[(currentIndex + 1) % PACE_OPTIONS.length]
}

const normalizePresentationPreferences = (
  nextPreferences: Preference[],
  currentPreferences: Preference[]
) =>
  nextPreferences.map((preference) => {
    if (preference.key !== 'pace') {
      return preference
    }

    const wordCount = preference.value.trim().split(/\s+/).filter(Boolean).length
    if (wordCount <= 2) {
      return preference
    }

    const currentPace = currentPreferences.find((item) => item.key === 'pace')?.value
    return {
      ...preference,
      value: cyclePacePreference(currentPace),
    }
  })

export const CenterPanel = ({ userId, userEmail, userName }: CenterPanelProps) => {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [revealedCharsByMessageId, setRevealedCharsByMessageId] = useState<Record<string, number>>({})
  const backendPlannerEnabled = true

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasSeededInitialMessageRef = useRef(false)
  const revealIntervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  const shouldAutoScrollRef = useRef(true)

  const ensureWorkspace = useAppStore((state) => state.ensureWorkspace)
  const preferences = useAppStore((state) => state.workspaces[userId]?.preferences ?? [])
  const messages = useAppStore((state) => state.workspaces[userId]?.messages ?? [])
  const itinerary = useAppStore((state) => state.workspaces[userId]?.itinerary ?? null)
  const itineraryInlineAfterMessageId = useAppStore(
    (state) => state.workspaces[userId]?.itineraryInlineAfterMessageId ?? null
  )
  const isRecording = useAppStore((state) => state.workspaces[userId]?.isRecording ?? false)
  const addMessage = useAppStore((state) => state.addMessage)
  const setPreferences = useAppStore((state) => state.setPreferences)
  const setTypingStatus = useAppStore((state) => state.setTypingStatus)
  const setItinerary = useAppStore((state) => state.setItinerary)
  const setRecording = useAppStore((state) => state.setRecording)
  const setItineraryInlineAfterMessageId = useAppStore((state) => state.setItineraryInlineAfterMessageId)

  const activeDestinationLabel = itinerary ? `${itinerary.destination}, ${itinerary.country}` : null
  const hasUserMessages = messages.some((message) => message.role === 'user')

  const isNearBottom = (element: HTMLDivElement) => {
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    return distanceFromBottom < 80
  }

  useEffect(() => {
    ensureWorkspace(userId)
  }, [ensureWorkspace, userId])

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return
    }

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, revealedCharsByMessageId])

  useEffect(() => {
    for (const message of messages) {
      if (message.role !== 'agent' || message.isTyping || !message.content) continue
      if (revealedCharsByMessageId[message.id] !== undefined) continue

      setRevealedCharsByMessageId((prev) => ({ ...prev, [message.id]: 0 }))

      const interval = setInterval(() => {
        setRevealedCharsByMessageId((prev) => {
          const current = prev[message.id] ?? 0
          const next = Math.min(current + 1, message.content.length)
          const updated = { ...prev, [message.id]: next }

          if (next >= message.content.length) {
            const activeInterval = revealIntervalsRef.current[message.id]
            if (activeInterval) {
              clearInterval(activeInterval)
              delete revealIntervalsRef.current[message.id]
            }
          }

          return updated
        })
      }, 26)

      revealIntervalsRef.current[message.id] = interval
    }
  }, [messages, revealedCharsByMessageId])

  useEffect(() => {
    const activeIntervals = revealIntervalsRef.current

    return () => {
      Object.values(activeIntervals).forEach((interval) => clearInterval(interval))
    }
  }, [])

  useEffect(() => {
    if (hasSeededInitialMessageRef.current) return
    hasSeededInitialMessageRef.current = true

    if (useAppStore.getState().messagesForUser(userId).length === 0) {
      addMessage(userId, {
        role: 'agent',
        content:
          "Hi! I am connected to the travel planner backend.\n\nTell me where you want to go, how long, and any preferences like food, pace, budget, and transport.",
        timestamp: new Date(),
      })
    }
  }, [addMessage, userId])

  const getVisibleAgentContent = (message: Message) => {
    if (message.role !== 'agent' || message.isTyping) return message.content
    const visibleChars = revealedCharsByMessageId[message.id]
    if (visibleChars === undefined) return ''
    return message.content.slice(0, visibleChars)
  }

  const isAgentMessageFullyRevealed = (message: Message) => {
    if (message.role !== 'agent' || message.isTyping) return true
    return (revealedCharsByMessageId[message.id] ?? 0) >= message.content.length
  }

  const activeOptionsMessage = [...messages].reverse().find((message, reverseIndex) => {
    if (
      message.role !== 'agent' ||
      message.isTyping ||
      !message.options?.length ||
      !isAgentMessageFullyRevealed(message)
    ) {
      return false
    }

    const originalIndex = messages.length - 1 - reverseIndex
    return !messages.slice(originalIndex + 1).some((laterMessage) => laterMessage.role === 'user')
  })

  const handleBackendPlannerMessage = async (userMessage: string) => {
    setTypingStatus(userId, true)
    try {
      const tripPlan = await planTrip({
        prompt: formatPlannerPromptWithPreferences(
          userMessage,
          preferences.map((preference) => ({
            label: preference.label,
            value: preference.value,
          }))
        ),
        language_code: 'en',
        region_code: 'US',
        currency_code: 'USD',
        transport_preference: inferTransportPreference(userMessage),
        session_id: `web-${userId}`,
      })

      const mappedItinerary = mapTripPlanToItinerary(tripPlan)
      const mappedPreferences = normalizePresentationPreferences(
        mapPlanningStateToPreferences(tripPlan.planning_state),
        preferences
      )
      const formattedContent = formatTripPlanForChat(tripPlan)
      const followUpOptions = getFollowUpOptions(tripPlan)
      const agentMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      addMessage(userId, {
        id: agentMessageId,
        role: 'agent',
        content: formattedContent || 'Your updated itinerary is ready.',
        timestamp: new Date(),
        options: followUpOptions.length ? followUpOptions : undefined,
      })

      if (mappedPreferences.length) {
        setPreferences(userId, mappedPreferences)
      }
      setItinerary(userId, mappedItinerary)
      setItineraryInlineAfterMessageId(userId, mappedItinerary ? agentMessageId : null)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Planner request failed due to an unknown error.'
      addMessage(userId, {
        role: 'agent',
        content:
          "I couldn't fetch a plan from the backend right now.\n\n" +
          `Error: ${errorMessage}\n\n` +
          'Check that the backend server is running and retry.',
        timestamp: new Date(),
      })
    } finally {
      setTypingStatus(userId, false)
    }
  }

  const handleUserMessage = async (rawMessage: string) => {
    const userMessage = rawMessage.trim()
    if (!userMessage || isLoading) return

    addMessage(userId, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    })

    setInput('')
    setIsLoading(true)

    try {
      await handleBackendPlannerMessage(userMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    await handleUserMessage(input)
  }

  const handleOptionClick = async (option: string) => {
    if (option === 'Other') {
      setInput('')
      setTimeout(() => inputRef.current?.focus(), 0)
      return
    }

    await handleUserMessage(option)
  }

  const handleStarterPromptClick = (prompt: string) => {
    setInput(prompt)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleMicToggle = () => {
    setRecording(userId, !isRecording)
  }

  const handleCalendarExportStarted = (result: CalendarExportResult) => {
    const totalEvents = result.exportableEvents.length
    const messageParts = [
      totalEvents > 0
        ? `I started the Google Calendar handoff for ${totalEvents} itinerary event${totalEvents === 1 ? '' : 's'}.`
        : 'I could not find any scheduled itinerary events ready for Google Calendar yet.',
    ]

    if (result.blockedEvents.length > 0) {
      messageParts.push(
        `${result.blockedEvents.length} event${result.blockedEvents.length === 1 ? '' : 's'} may have been blocked by your browser, so I left manual Google Calendar links in the itinerary card.`
      )
    }

    if (result.skippedEvents.length > 0) {
      messageParts.push(
        `${result.skippedEvents.length} item${result.skippedEvents.length === 1 ? '' : 's'} were skipped because they do not have a usable start time yet.`
      )
    }

    messageParts.push('Save the opened events in Google Calendar when you are ready.')

    addMessage(userId, {
      role: 'agent',
      content: messageParts.join('\n\n'),
      timestamp: new Date(),
    })
  }

  return (
    <div className="fixed left-[248px] right-[280px] top-0 h-screen bg-gradient-to-b from-cream to-warm-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/60 bg-white/55 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal to-ocean shadow-[0_10px_20px_rgba(13,115,119,0.2)]">
            <CompassIcon size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">TripMind</h1>
            {activeDestinationLabel && (
              <p className="mt-0.5 text-xs font-medium text-teal">{activeDestinationLabel}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-3 rounded-full border border-gray-100 bg-white px-3 py-2 shadow-sm sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal/10 text-teal">
              <UserIcon size={16} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-text-primary">
                {userName ?? 'Traveler'}
              </p>
              <p className="truncate text-xs text-text-muted">{userEmail ?? 'traveler@tripmind.app'}</p>
            </div>
          </div>
          <a
            href="/auth/logout"
            className="signout-button interactive-float flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-teal hover:text-teal"
          >
            <LogOutIcon size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </a>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden px-4 py-4">
        <div className="glass-panel relative z-10 h-full overflow-hidden rounded-[30px] border border-white/70 bg-white/48">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/60 via-white/42 to-white/58" />
          <div
            ref={scrollContainerRef}
            onScroll={(event) => {
              shouldAutoScrollRef.current = isNearBottom(event.currentTarget)
            }}
            className="relative z-10 h-full overflow-y-auto px-6 pb-40 pt-6 space-y-4"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn('flex gap-3 message-enter', message.role === 'user' && 'justify-end')}
              >
                {message.role === 'agent' && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal to-ocean shadow-[0_10px_18px_rgba(13,115,119,0.18)]">
                    <CompassIcon size={16} className="text-white" />
                  </div>
                )}

                <div className="max-w-md">
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 transition-all duration-300',
                      message.role === 'user'
                        ? 'rounded-br-sm bg-gradient-to-br from-teal to-[#1594a0] text-white shadow-[0_14px_24px_rgba(13,115,119,0.22)]'
                        : 'rounded-bl-sm border border-white/90 bg-white/94 text-text-primary shadow-[0_12px_22px_rgba(15,23,42,0.1)]'
                    )}
                  >
                    {message.isTyping ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-text-secondary agent-thinking-text">Agent thinking</span>
                        <div className="typing-dots">
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-line">{getVisibleAgentContent(message)}</p>
                    )}
                  </div>

                  {itinerary && message.role === 'agent' && itineraryInlineAfterMessageId === message.id && (
                    <div className="mt-4 max-w-2xl rounded-[30px] border border-white/85 bg-white/58 p-2 shadow-[0_18px_34px_rgba(15,23,42,0.1)] backdrop-blur-sm">
                      <ItineraryCard
                        itinerary={itinerary}
                        onCalendarExportStarted={handleCalendarExportStarted}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>
          <div className="absolute inset-x-0 bottom-0 z-20 p-6">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
              {!hasUserMessages && (
                <div className="flex flex-wrap gap-2 rounded-[26px] border border-white/85 bg-white/52 p-3 shadow-[0_14px_28px_rgba(15,23,42,0.08)] backdrop-blur-md">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleStarterPromptClick(prompt)}
                      disabled={isLoading}
                      className="rounded-full border border-white/95 bg-white/94 px-4 py-2.5 text-sm font-medium text-text-primary shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-teal/50 hover:bg-white hover:text-teal disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {activeOptionsMessage && (
                <div className="flex flex-wrap gap-2 rounded-[26px] border border-white/85 bg-white/52 p-3 shadow-[0_14px_28px_rgba(15,23,42,0.08)] backdrop-blur-md">
                  {activeOptionsMessage.options?.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleOptionClick(option)}
                      disabled={isLoading}
                      className="rounded-full border border-white/95 bg-white/94 px-4 py-2.5 text-sm font-medium text-text-primary shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-teal/50 hover:bg-white hover:text-teal disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}

              <div className="glass-panel flex items-center gap-3 rounded-full border border-white/90 bg-warm-white/92 px-4 py-3 shadow-[0_18px_34px_rgba(15,23,42,0.12)] transition-all duration-300 focus-within:border-teal focus-within:shadow-[0_16px_28px_rgba(13,115,119,0.14)]">
                <button
                  onClick={handleMicToggle}
                  className={cn(
                    'mic-button interactive-float p-2 rounded-full transition-all duration-300 flex-shrink-0',
                    isRecording && 'is-recording',
                    isRecording ? 'bg-teal/20 text-teal' : 'text-text-muted hover:text-teal'
                  )}
                >
                  <MicIcon size={20} isActive={isRecording} />
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage()
                  }}
                  placeholder="Where do you want to go?"
                  className="flex-1 bg-transparent outline-none text-sm placeholder-text-muted"
                />

                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading}
                  className="send-button interactive-float p-2 text-teal hover:bg-teal/10 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SendIcon size={20} />
                </button>
              </div>

              <p className="text-xs text-text-muted text-center mt-3">
                Chat feels live: longer thinking, streaming text, and backend-driven Travel DNA.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
