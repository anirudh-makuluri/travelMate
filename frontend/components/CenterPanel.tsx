'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import type { Message } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { CompassIcon, LogOutIcon, MicIcon, SendIcon, UserIcon } from './Icons'
import { ItineraryCard } from './ItineraryCard'
import { cn } from '@/lib/utils'

type FlowStep =
  | 'awaiting-destination'
  | 'awaiting-itinerary-request'
  | 'awaiting-preferences'
  | 'awaiting-preferences-custom'
  | 'awaiting-adventure-update'
  | 'awaiting-companion-mode'
  | 'in-trip'
  | 'completed'

export const CenterPanel = () => {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [flowStep, setFlowStep] = useState<FlowStep>('awaiting-destination')
  const [revealedCharsByMessageId, setRevealedCharsByMessageId] = useState<Record<string, number>>({})
  const [itineraryInlineAfterMessageId, setItineraryInlineAfterMessageId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasSeededInitialMessageRef = useRef(false)
  const revealIntervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  const hasStartedCompanionFlowRef = useRef(false)

  const messages = useAppStore((state) => state.messages)
  const itinerary = useAppStore((state) => state.itinerary)
  const addMessage = useAppStore((state) => state.addMessage)
  const setTypingStatus = useAppStore((state) => state.setTypingStatus)
  const updatePreference = useAppStore((state) => state.updatePreference)
  const setItinerary = useAppStore((state) => state.setItinerary)
  const isRecording = useAppStore((state) => state.isRecording)
  const setRecording = useAppStore((state) => state.setRecording)
  const resetApp = useAppStore((state) => state.resetApp)
  const user = useAuthStore((state) => state.user)
  const signOut = useAuthStore((state) => state.signOut)

  const sleep = (ms: number) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms)
    })

  useEffect(() => {
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

    if (useAppStore.getState().messages.length === 0) {
      addMessage({
        role: 'agent',
        content:
          "Hi! I can look at your past trips and your friends' travel memories to craft your next plan.\n\nWhere are you thinking of traveling next?",
        timestamp: new Date(),
      })
      setInput('I want to go to Tokyo')
    }
  }, [addMessage])

  const createRelaxedItinerary = () => ({
    destination: 'Tokyo',
    country: 'Japan',
    startDate: '2026-10-12',
    endDate: '2026-10-16',
    flights: {
      airline: 'ANA Airways',
      departure: 'SFO',
      arrival: 'NRT',
      price: 780,
      date: '2026-10-12',
    },
    hotel: {
      name: 'Trunk Hotel Shibuya',
      rating: 5,
      price: 390,
      image:
        'https://images.unsplash.com/photo-1631049307038-da0ec9d70304?w=400&h=300&fit=crop',
    },
    days: [
      {
        dayNumber: 1,
        date: '2026-10-12',
        activities: [
          {
            time: '14:30',
            name: 'Airport Transfer by Narita Express',
            location: 'NRT to Shibuya',
            description: 'Reserved train transfer and hotel check-in.',
          },
          {
            time: '19:00',
            name: 'Omakase Dinner',
            location: 'Ebisu',
            description: 'Curated sushi course at a quiet local spot.',
          },
        ],
      },
      {
        dayNumber: 2,
        date: '2026-10-13',
        activities: [
          {
            time: '09:00',
            name: 'Meiji Shrine + Yoyogi Walk',
            location: 'Harajuku',
            description: 'Slow morning walk through the forest shrine.',
          },
          {
            time: '13:00',
            name: 'Lunch: Vegetarian Kaiseki',
            location: 'Omotesando',
            description: 'Seasonal multi-course vegetarian tasting.',
          },
          {
            time: '17:30',
            name: 'Sunset River Cruise',
            location: 'Asakusa',
            description: 'Relaxed evening cruise with skyline views.',
          },
        ],
      },
      {
        dayNumber: 3,
        date: '2026-10-14',
        activities: [
          {
            time: '08:30',
            name: 'Bullet Train Day Trip',
            location: 'Tokyo to Hakone',
            description: 'Round-trip transport with scenic viewpoints.',
          },
          {
            time: '12:30',
            name: 'Lakeside Lunch',
            location: 'Hakone',
            description: 'Set lunch with Mt. Fuji weather permitting.',
          },
          {
            time: '19:30',
            name: 'Rooftop Izakaya',
            location: 'Shinjuku',
            description: 'Casual dinner and city night views.',
          },
        ],
      },
    ],
    heroImage:
      'https://images.unsplash.com/photo-1540959375944-7049f642e9d4?w=1600&h=1000&fit=crop',
  })

  const createAdventureItinerary = () => ({
    destination: 'Tokyo',
    country: 'Japan',
    startDate: '2026-10-12',
    endDate: '2026-10-16',
    flights: {
      airline: 'Japan Airlines',
      departure: 'SFO',
      arrival: 'HND',
      price: 860,
      date: '2026-10-12',
    },
    hotel: {
      name: 'Shibuya Stream Hotel',
      rating: 4,
      price: 320,
      image:
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=300&fit=crop',
    },
    days: [
      {
        dayNumber: 1,
        date: '2026-10-12',
        activities: [
          {
            time: '15:00',
            name: 'Airport Limousine Bus + Gear Drop',
            location: 'HND to Shibuya',
            description: 'Fast transfer, quick check-in, head out immediately.',
          },
          {
            time: '20:00',
            name: 'Night Food Crawl',
            location: 'Shinjuku Omoide Yokocho',
            description: 'Street-style food circuit across 5 local spots.',
          },
        ],
      },
      {
        dayNumber: 2,
        date: '2026-10-13',
        activities: [
          {
            time: '07:00',
            name: 'Trail Run + Temple Steps',
            location: 'Mount Takao',
            description: 'Half-day active climb with summit breakfast.',
          },
          {
            time: '14:00',
            name: 'Go-Kart City Route',
            location: 'Akihabara',
            description: 'Guided urban route through key city districts.',
          },
          {
            time: '19:30',
            name: 'Ramen Challenge',
            location: 'Ikebukuro',
            description: 'Three-shop tasting sprint with local guide.',
          },
        ],
      },
      {
        dayNumber: 3,
        date: '2026-10-14',
        activities: [
          {
            time: '06:30',
            name: 'Shinkansen to Surf Session',
            location: 'Tokyo to Shonan Coast',
            description: 'Board rental and instructor-led morning surf.',
          },
          {
            time: '13:30',
            name: 'Beachside Seafood Lunch',
            location: 'Enoshima',
            description: 'Fresh catch set menu at harbor market.',
          },
          {
            time: '21:00',
            name: 'Late-night Neon Photo Walk',
            location: 'Shibuya + Shinjuku',
            description: 'Guided street photography route and hidden alleys.',
          },
        ],
      },
    ],
    heroImage:
      'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=1600&h=1000&fit=crop',
  })

  const createWeatherAdjustedItinerary = () => ({
    destination: 'Tokyo',
    country: 'Japan',
    startDate: '2026-10-12',
    endDate: '2026-10-16',
    flights: {
      airline: 'Japan Airlines',
      departure: 'SFO',
      arrival: 'HND',
      price: 860,
      date: '2026-10-12',
    },
    hotel: {
      name: 'Shibuya Stream Hotel',
      rating: 4,
      price: 320,
      image:
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=300&fit=crop',
    },
    days: [
      {
        dayNumber: 1,
        date: '2026-10-12',
        activities: [
          {
            time: '15:00',
            name: 'Airport Limousine Bus + Gear Drop',
            location: 'HND to Shibuya',
            description: 'Fast transfer, quick check-in, head out immediately.',
          },
          {
            time: '20:00',
            name: 'Night Food Crawl',
            location: 'Shinjuku Omoide Yokocho',
            description: 'Street-style food circuit across 5 local spots.',
          },
        ],
      },
      {
        dayNumber: 2,
        date: '2026-10-13',
        activities: [
          {
            time: '06:45',
            name: 'Early Surf Session',
            location: 'Shonan Coast',
            description: 'Moved earlier to beat the incoming rain band.',
          },
          {
            time: '13:30',
            name: 'teamLab Planets + Indoor Art Route',
            location: 'Toyosu',
            description: 'Weather-safe immersive experience replacing the outdoor city route.',
          },
          {
            time: '19:00',
            name: 'Ramen and Retro Arcade Crawl',
            location: 'Akihabara',
            description: 'Indoor evening plan with food stops and games.',
          },
        ],
      },
      {
        dayNumber: 3,
        date: '2026-10-14',
        activities: [
          {
            time: '09:00',
            name: 'Mount Takao Trail Window',
            location: 'Tokyo West',
            description: 'Moved to the clearer weather day for better visibility.',
          },
          {
            time: '14:00',
            name: 'Go-Kart City Route',
            location: 'Akihabara',
            description: 'Shifted here from Day 2 once the streets dry out.',
          },
          {
            time: '21:00',
            name: 'Late-night Neon Photo Walk',
            location: 'Shibuya + Shinjuku',
            description: 'Guided street photography route and hidden alleys.',
          },
        ],
      },
    ],
    heroImage:
      'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=1600&h=1000&fit=crop',
  })

  const runAgentResponse = async (
    content: string,
    waitMs = 2200,
    options?: string[],
    showOtherOption?: boolean,
    nextQuestion?: string,
    suggestedInput?: string
  ) => {
    setTypingStatus(true)
    await sleep(waitMs)
    setTypingStatus(false)

    const contentWithQuestion = `${content}\n\n${nextQuestion ?? 'How would you like to continue?'}`

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    addMessage({
      id: messageId,
      role: 'agent',
      content: contentWithQuestion,
      timestamp: new Date(),
      options,
      showOtherOption,
    })

    if (suggestedInput) {
      setInput(suggestedInput)
    }

    return messageId
  }

  const startCompanionFlow = async () => {
    if (hasStartedCompanionFlowRef.current) return
    hasStartedCompanionFlowRef.current = true

    await sleep(2600)

    await runAgentResponse(
      'Great. I will remind you about your flight details, create a Google Calendar event for the trip, and stay active with you while you travel.',
      2400,
      undefined,
      undefined,
      'I will keep monitoring the trip in the background and jump in when something changes.'
    )

    await sleep(3800)

    const proactiveMessageId = await runAgentResponse(
      'Weather update: heavy rain is expected tomorrow afternoon in Tokyo. I already adjusted your plan by moving the surf session earlier, swapping the outdoor route for teamLab Planets, and shifting the go-kart ride to the clearer day.',
      2600,
      undefined,
      undefined,
      'Want to review the updated in-trip itinerary?'
    )

    setItinerary(createWeatherAdjustedItinerary())
    setItineraryInlineAfterMessageId(proactiveMessageId)
    setFlowStep('completed')
  }

  const applyPresetPreferences = (preset: 'balanced' | 'luxury' | 'budget') => {
    if (preset === 'balanced') {
      updatePreference('budget', '$$ (Mid-range)')
      updatePreference('vibe', 'Relaxed')
      updatePreference('pace', 'Balanced')
      updatePreference('dietary', 'Vegetarian friendly')
      updatePreference('stay', 'Boutique hotels')
      return
    }

    if (preset === 'luxury') {
      updatePreference('budget', '$$$ (Luxury)')
      updatePreference('vibe', 'Calm premium')
      updatePreference('pace', 'Relaxed')
      updatePreference('dietary', 'Fine dining')
      updatePreference('stay', 'Luxury hotels')
      return
    }

    updatePreference('budget', '$ (Budget)')
    updatePreference('vibe', 'Flexible')
    updatePreference('pace', 'Fast-paced')
    updatePreference('dietary', 'Street-food friendly')
    updatePreference('stay', 'Hostels')
  }

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

  const handleUserMessage = async (rawMessage: string) => {
    const userMessage = rawMessage.trim()
    if (!userMessage || isLoading) return

    const userMessageLower = userMessage.toLowerCase()

    addMessage({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    })

    setInput('')
    setIsLoading(true)

    try {
      if (flowStep === 'awaiting-destination') {
        await runAgentResponse(
          "I am checking your previous trips and your friends' memory feed... I found one strong match: Sarah's Tokyo trip from last month with a Shibuya base and a Hakone day escape. I can build this with your own style layered on top.",
          3000,
          undefined,
          undefined,
          'Should I build a full itinerary from this trip memory?',
          'ok create iternary'
        )
        setFlowStep('awaiting-itinerary-request')
        return
      }

      if (
        flowStep === 'awaiting-itinerary-request' &&
        (userMessageLower.includes('ok create iternary') ||
          userMessageLower.includes('ok create itinerary') ||
          userMessageLower.includes('create iternary') ||
          userMessageLower.includes('create itinerary'))
      ) {
        await runAgentResponse(
          'Great. Quick setup before I generate the plan. Choose one preference pack, or pick Other.',
          2200,
          [
            '$$ Mid-range | Boutique stays | Balanced pace',
            '$$$ Luxury | Premium hotel | Relaxed pace',
            '$ Budget | Hostel stays | Fast pace',
          ],
          true,
          'Which preference pack should I use for your first draft?',
          '$$ Mid-range | Boutique stays | Balanced pace'
        )
        setFlowStep('awaiting-preferences')
        return
      }

      if (flowStep === 'awaiting-preferences') {
        if (userMessageLower === 'other') {
          await runAgentResponse(
            'Perfect. Share budget, stay style, dietary needs, and preferred pace in one message.',
            2000,
            undefined,
            undefined,
            'Can you share your preferences in one line so I can personalize the plan?',
            'Budget: $$, Stay: boutique, Dietary: vegetarian, Pace: balanced'
          )
          setFlowStep('awaiting-preferences-custom')
          return
        }

        if (userMessageLower.includes('mid-range')) {
          applyPresetPreferences('balanced')
        } else if (userMessageLower.includes('luxury')) {
          applyPresetPreferences('luxury')
        } else {
          applyPresetPreferences('budget')
        }

        const itineraryMessageId = await runAgentResponse(
          'Building your itinerary with transport, hotel, and food now...',
          3000,
          undefined,
          undefined,
          'Want me to switch this to a more adventurous version?',
          'i want this trip to be adventurous',
        )
        setItinerary(createRelaxedItinerary())
        setItineraryInlineAfterMessageId(itineraryMessageId)
        await runAgentResponse(
          "Done. Here is your full itinerary. If you want a higher-energy plan, say: i want this trip to be adventurous.",
          1800,
          undefined,
          undefined,
          'Should I rework this into an adventurous itinerary?',
          'i want this trip to be adventurous'
        )
        setFlowStep('awaiting-adventure-update')
        return
      }

      if (flowStep === 'awaiting-preferences-custom') {
        const customText = userMessageLower

        if (customText.includes('luxury')) {
          applyPresetPreferences('luxury')
        } else if (customText.includes('budget')) {
          applyPresetPreferences('budget')
        } else {
          applyPresetPreferences('balanced')
        }

        if (customText.includes('adventurous') || customText.includes('adventure')) {
          updatePreference('vibe', 'Adventurous')
          updatePreference('pace', 'Fast-paced')
          setItinerary(createAdventureItinerary())
        } else {
          setItinerary(createRelaxedItinerary())
        }

        const itineraryMessageId = await runAgentResponse(
          'Thanks. I generated your itinerary based on your custom inputs.',
          2600,
          undefined,
          undefined,
          'Would you like me to make this more adventurous?',
          'i want this trip to be adventurous',
        )
        setItineraryInlineAfterMessageId(itineraryMessageId)
        await runAgentResponse(
          "If you want me to shift it further, tell me. For the guided flow, next say: i want this trip to be adventurous.",
          1500,
          undefined,
          undefined,
          'Do you want me to regenerate this with an adventurous style?',
          'i want this trip to be adventurous'
        )
        setFlowStep('awaiting-adventure-update')
        return
      }

      if (
        flowStep === 'awaiting-adventure-update' &&
        userMessageLower.includes('i want this trip to be adventurous')
      ) {
        const itineraryMessageId = await runAgentResponse(
          'Understood. I am re-optimizing your travel DNA for adventure and rebuilding the whole plan...',
          3200,
          undefined,
          undefined,
          'If this looks right, do you want me to stay with you throughout the trip and keep adjusting things in real time?',
          'yes, stay with me on the trip',
        )
        updatePreference('vibe', 'Adventurous')
        updatePreference('pace', 'Fast-paced')
        updatePreference('group', 'Solo explorer')
        setItinerary(createAdventureItinerary())
        setItineraryInlineAfterMessageId(itineraryMessageId)
        await runAgentResponse(
          'Updated adventurous itinerary is ready. Is this final plan okay?',
          1800,
          undefined,
          undefined,
          'Should I stay active during the trip and proactively help as things change?',
          'yes, stay with me on the trip'
        )
        setFlowStep('awaiting-companion-mode')
        return
      }

      if (
        flowStep === 'awaiting-companion-mode' &&
        (userMessageLower.includes('stay with me on the trip') ||
          userMessageLower.includes('stay with me') ||
          userMessageLower.includes('yes'))
      ) {
        setFlowStep('in-trip')
        void startCompanionFlow()
        return
      }

      await runAgentResponse(
        "I am following the guided flow. Next valid inputs are: 'ok create iternary', 'i want this trip to be adventurous', and 'yes, stay with me on the trip'.",
        1500,
        undefined,
        undefined,
        'Would you like to continue with the guided flow now?',
        'yes, stay with me on the trip'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    await handleUserMessage(input)
  }

  const handleOptionClick = async (option: string) => {
    await handleUserMessage(option)
  }

  const handleMicToggle = () => {
    setRecording(!isRecording)
  }

  const handleSignOut = () => {
    resetApp()
    signOut()
  }

  return (
    <div className="fixed left-[220px] right-[280px] top-0 h-screen bg-gradient-to-b from-cream to-warm-white flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-white/50 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-teal to-ocean rounded-lg flex items-center justify-center">
            <CompassIcon size={18} className="text-white" />
          </div>
          <h1 className="text-lg font-bold text-text-primary">TripMind</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-3 rounded-full border border-gray-100 bg-white px-3 py-2 shadow-sm sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal/10 text-teal">
              <UserIcon size={16} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-text-primary">
                {user?.name ?? 'Traveler'}
              </p>
              <p className="truncate text-xs text-text-muted">{user?.email ?? 'demo@tripmind.app'}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-teal hover:text-teal"
          >
            <LogOutIcon size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('flex gap-3 message-enter', message.role === 'user' && 'justify-end')}
          >
            {message.role === 'agent' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal to-ocean flex-shrink-0 flex items-center justify-center">
                <CompassIcon size={16} className="text-white" />
              </div>
            )}

            <div className="max-w-md">
              <div
                className={cn(
                  'rounded-lg px-4 py-3 transition-all duration-300',
                  message.role === 'user'
                    ? 'bg-teal text-white rounded-br-sm'
                    : 'bg-white text-text-primary rounded-bl-sm border border-gray-100 shadow-sm'
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

              {message.role === 'agent' &&
                !message.isTyping &&
                isAgentMessageFullyRevealed(message) &&
                message.options &&
                message.options.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.options.map((option) => (
                      <button
                        key={option}
                        onClick={() => handleOptionClick(option)}
                        disabled={isLoading}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-full text-xs text-text-primary hover:border-teal hover:text-teal transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {option}
                      </button>
                    ))}
                    {message.showOtherOption && (
                      <button
                        onClick={() => handleOptionClick('Other')}
                        disabled={isLoading}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-full text-xs text-text-primary hover:border-teal hover:text-teal transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Other
                      </button>
                    )}
                  </div>
                )}

              {itinerary &&
                message.role === 'agent' &&
                itineraryInlineAfterMessageId === message.id && (
                  <div className="mt-3">
                    <ItineraryCard itinerary={itinerary} />
                  </div>
                )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="px-6 py-4 bg-white border-t border-gray-100">
        <div className="flex items-center gap-3 bg-warm-white rounded-full px-4 py-3 border border-gray-100 focus-within:border-teal focus-within:shadow-md transition-all duration-300">
          <button
            onClick={handleMicToggle}
            className={cn(
              'p-2 rounded-full transition-all duration-300 flex-shrink-0',
              isRecording ? 'bg-teal/20 text-teal' : 'text-text-muted hover:text-teal'
            )}
          >
            <MicIcon size={20} isActive={isRecording} />
          </button>

          <input
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
            className="p-2 text-teal hover:bg-teal/10 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SendIcon size={20} />
          </button>
        </div>

        <p className="text-xs text-text-muted text-center mt-3">
          Chat feels live: longer thinking, streaming text, and quick-reply choices.
        </p>
      </div>
    </div>
  )
}
