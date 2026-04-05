import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { ensureAuth0UserMetadata, updateAuth0UserMetadata } from '@/lib/auth0Management'
import { normalizeTripMindMetadata, type TripMindUserMetadata } from '@/lib/tripmindMetadata'

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

export async function GET() {
  const session = await auth0.getSession()
  if (!session?.user?.sub) {
    return unauthorized()
  }

  try {
    const tripmind = await ensureAuth0UserMetadata(session.user.sub)
    return NextResponse.json({ tripmind })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load Auth0 metadata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await auth0.getSession()
  if (!session?.user?.sub) {
    return unauthorized()
  }

  try {
    const body = (await request.json()) as { tripmind?: Partial<TripMindUserMetadata> }
    const input = body.tripmind ?? {}
    const updated = await updateAuth0UserMetadata(session.user.sub, {
      preferences: input.preferences
        ? normalizeTripMindMetadata({ preferences: input.preferences }).preferences
        : undefined,
      profileInitializedAt: input.profileInitializedAt,
      profileVersion: input.profileVersion,
    })
    return NextResponse.json({ tripmind: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update Auth0 metadata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
