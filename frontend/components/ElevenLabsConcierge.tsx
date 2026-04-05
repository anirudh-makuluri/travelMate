'use client'

import { createElement, useEffect, useState } from 'react'
import Script from 'next/script'
import { useAppStore } from '@/store/appStore'

interface ElevenLabsConciergeProps {
  userId: string
  userName?: string
  userEmail?: string
}

const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_CONVAI_AGENT_ID

const buildPreferenceSummary = (
  preferences: Array<{ label: string; value: string }>
): string => {
  if (!preferences.length) {
    return 'No explicit preferences captured yet.'
  }

  return preferences.map((preference) => `${preference.label}: ${preference.value}`).join('; ')
}

const buildItinerarySummary = (
  itinerary:
    | {
        destination: string
        country: string
        days: Array<{
          dayNumber: number
          activities: Array<{ name: string }>
        }>
      }
    | null
): string => {
  if (!itinerary) {
    return 'No itinerary has been generated yet.'
  }

  const daySummary = itinerary.days
    .slice(0, 2)
    .map((day) => {
      const stops = day.activities.slice(0, 3).map((activity) => activity.name).join(', ')
      return `Day ${day.dayNumber}: ${stops || 'Flexible plan'}`
    })
    .join(' | ')

  return `${itinerary.destination}, ${itinerary.country}. ${daySummary}`.trim()
}

export const ElevenLabsConcierge = ({
  userId,
  userName,
  userEmail,
}: ElevenLabsConciergeProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const ensureWorkspace = useAppStore((state) => state.ensureWorkspace)
  const preferences = useAppStore((state) => state.workspaces[userId]?.preferences ?? [])
  const itinerary = useAppStore((state) => state.workspaces[userId]?.itinerary ?? null)

  useEffect(() => {
    ensureWorkspace(userId)
  }, [ensureWorkspace, userId])

  useEffect(() => {
    let cancelled = false

    const loadSignedUrl = async () => {
      try {
        const response = await fetch('/api/elevenlabs/conversation/signed-url', {
          cache: 'no-store',
        })
        if (!response.ok) {
          return
        }
        const body = (await response.json().catch(() => ({}))) as { signed_url?: string }
        if (!cancelled && body.signed_url) {
          setSignedUrl(body.signed_url)
        }
      } catch {
        // Fall back to agent-id mode when signed URL setup is not available.
      }
    }

    void loadSignedUrl()

    return () => {
      cancelled = true
    }
  }, [])

  if (!AGENT_ID) {
    return null
  }

  const dynamicVariables = JSON.stringify({
    user_name: userName ?? 'Traveler',
    user_email: userEmail ?? '',
    current_destination: itinerary?.destination ?? '',
    current_country: itinerary?.country ?? '',
    travel_preferences: buildPreferenceSummary(preferences),
    itinerary_summary: buildItinerarySummary(itinerary),
  })

  return (
    <>
      <Script
        src="https://unpkg.com/@elevenlabs/convai-widget-embed"
        async
        type="text/javascript"
        strategy="afterInteractive"
      />
      {createElement('elevenlabs-convai', {
        ...(signedUrl ? { 'signed-url': signedUrl } : { 'agent-id': AGENT_ID }),
        'dynamic-variables': dynamicVariables,
      })}
    </>
  )
}
