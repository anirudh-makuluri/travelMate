'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/appStore'

interface Auth0MetadataSyncProps {
  userId: string
}

export const Auth0MetadataSync = ({ userId }: Auth0MetadataSyncProps) => {
  const ensureWorkspace = useAppStore((state) => state.ensureWorkspace)
  const replacePreferences = useAppStore((state) => state.replacePreferences)
  const preferences = useAppStore((state) => state.workspaces[userId]?.preferences ?? [])

  const hydratedRef = useRef(false)

  useEffect(() => {
    ensureWorkspace(userId)
  }, [ensureWorkspace, userId])

  useEffect(() => {
    let cancelled = false

    const loadMetadata = async () => {
      const response = await fetch('/api/user-metadata', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        return
      }

      const payload = (await response.json()) as {
        tripmind?: {
          preferences?: Partial<Record<string, string>>
        }
      }

      if (cancelled || !payload.tripmind?.preferences) {
        return
      }

      replacePreferences(userId, payload.tripmind.preferences)
      hydratedRef.current = true
    }

    void loadMetadata()

    return () => {
      cancelled = true
    }
  }, [replacePreferences, userId])

  useEffect(() => {
    if (!hydratedRef.current || preferences.length === 0) {
      return
    }

    const timeout = setTimeout(() => {
      const nextPreferences = Object.fromEntries(
        preferences.map((preference) => [preference.key, preference.value])
      )

      void fetch('/api/user-metadata', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          tripmind: {
            preferences: nextPreferences,
          },
        }),
      })
    }, 500)

    return () => {
      clearTimeout(timeout)
    }
  }, [preferences])

  return null
}
