import { NextResponse } from 'next/server'

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1'

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_CONVAI_AGENT_ID

  if (!apiKey || !agentId) {
    return NextResponse.json(
      { detail: 'Signed URL configuration is incomplete.' },
      { status: 501 }
    )
  }

  try {
    const response = await fetch(
      `${ELEVENLABS_BASE_URL}/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
        cache: 'no-store',
      }
    )

    const body = (await response.json().catch(() => ({}))) as {
      signed_url?: string
      detail?: string
    }

    if (!response.ok || !body.signed_url) {
      return NextResponse.json(
        { detail: body.detail || 'Unable to retrieve ElevenLabs signed URL.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ signed_url: body.signed_url })
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : 'Unable to retrieve ElevenLabs signed URL.'

    return NextResponse.json({ detail }, { status: 502 })
  }
}
