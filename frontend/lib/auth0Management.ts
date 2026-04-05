import { normalizeTripMindMetadata, type TripMindUserMetadata } from '@/lib/tripmindMetadata'

interface Auth0UserProfile {
  user_metadata?: {
    tripmind?: Partial<TripMindUserMetadata>
    [key: string]: unknown
  }
}

const getManagementApiAudience = () => {
  const domain = process.env.AUTH0_DOMAIN
  if (!domain) {
    throw new Error('Missing AUTH0_DOMAIN')
  }

  return process.env.AUTH0_MANAGEMENT_API_AUDIENCE ?? `https://${domain}/api/v2/`
}

export const getManagementToken = async () => {
  const domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_MANAGEMENT_CLIENT_ID ?? process.env.AUTH0_CLIENT_ID
  const clientSecret = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET ?? process.env.AUTH0_CLIENT_SECRET

  if (!domain || !clientId || !clientSecret) {
    throw new Error('Missing Auth0 management API credentials')
  }

  const response = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      audience: getManagementApiAudience(),
      grant_type: 'client_credentials',
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to get Auth0 management token: ${response.status}`)
  }

  const payload = (await response.json()) as { access_token: string }
  return payload.access_token
}

const getAuth0UserProfile = async (userId: string) => {
  const domain = process.env.AUTH0_DOMAIN
  if (!domain) {
    throw new Error('Missing AUTH0_DOMAIN')
  }

  const token = await getManagementToken()
  const response = await fetch(`https://${domain}/api/v2/users/${encodeURIComponent(userId)}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Auth0 user: ${response.status}`)
  }

  return (await response.json()) as Auth0UserProfile
}

export const getAuth0UserMetadata = async (userId: string) => {
  const user = await getAuth0UserProfile(userId)
  return normalizeTripMindMetadata(user.user_metadata?.tripmind)
}

export const ensureAuth0UserMetadata = async (userId: string) => {
  const user = await getAuth0UserProfile(userId)
  const current = user.user_metadata?.tripmind
  const normalized = normalizeTripMindMetadata(current)

  const isMissingDefaults =
    !current ||
    current.profileVersion === undefined ||
    !current.preferences ||
    Object.keys(normalized.preferences).some((key) => {
      const typedKey = key as keyof TripMindUserMetadata['preferences']
      return current.preferences?.[typedKey] === undefined
    })

  if (!isMissingDefaults) {
    return normalized
  }

  return updateAuth0UserMetadata(userId, normalized)
}

export const updateAuth0UserMetadata = async (
  userId: string,
  metadata: Partial<TripMindUserMetadata>
) => {
  const domain = process.env.AUTH0_DOMAIN
  if (!domain) {
    throw new Error('Missing AUTH0_DOMAIN')
  }

  const current = await getAuth0UserMetadata(userId)
  const next = normalizeTripMindMetadata({
    ...current,
    ...metadata,
    preferences: {
      ...current.preferences,
      ...metadata.preferences,
    },
  })

  const token = await getManagementToken()
  const response = await fetch(`https://${domain}/api/v2/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      user_metadata: {
        tripmind: next,
      },
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to update Auth0 user metadata: ${response.status}`)
  }

  return next
}
