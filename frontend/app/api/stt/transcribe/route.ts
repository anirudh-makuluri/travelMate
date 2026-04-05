import { NextResponse } from 'next/server'

const getPlannerApiUrl = () =>
  process.env.PLANNER_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim()

export async function POST(request: Request) {
  const plannerApiUrl = getPlannerApiUrl()

  if (!plannerApiUrl) {
    return NextResponse.json(
      { detail: 'Planner API URL is not configured on the frontend server.' },
      { status: 500 }
    )
  }

  const body = await request.arrayBuffer()
  const contentType = request.headers.get('content-type') || 'audio/webm'

  try {
    const response = await fetch(`${plannerApiUrl}/api/v1/stt/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
      },
      body,
      cache: 'no-store',
    })

    const text = await response.text()
    const responseContentType = response.headers.get('content-type') || 'application/json'

    return new NextResponse(text, {
      status: response.status,
      headers: {
        'Content-Type': responseContentType,
      },
    })
  } catch (error) {
    const detail =
      error instanceof Error
        ? `Unable to reach STT backend at ${plannerApiUrl}. ${error.message}`
        : `Unable to reach STT backend at ${plannerApiUrl}.`

    return NextResponse.json({ detail }, { status: 502 })
  }
}
