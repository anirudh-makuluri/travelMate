import { NextRequest, NextResponse } from 'next/server'

export const getPlannerApiUrl = () =>
  process.env.PLANNER_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim()

export const unauthorizedToolResponse = () =>
  NextResponse.json({ error: 'Unauthorized tool request.' }, { status: 401 })

export const authorizeElevenLabsToolRequest = (request: NextRequest) => {
  const configuredSecret = process.env.ELEVENLABS_TOOL_SECRET?.trim()
  if (!configuredSecret) {
    return true
  }

  const providedSecret = request.headers.get('x-travelmate-tool-secret')?.trim()
  return providedSecret === configuredSecret
}

export const inferTransportPreference = (prompt: string) => {
  const lower = prompt.toLowerCase()
  if (
    lower.includes('public transport') ||
    lower.includes('transit') ||
    lower.includes('bus') ||
    lower.includes('metro') ||
    lower.includes('subway') ||
    lower.includes('train')
  ) {
    return 'public_transport'
  }
  if (
    lower.includes('car') ||
    lower.includes('drive') ||
    lower.includes('driving') ||
    lower.includes('own transport')
  ) {
    return 'own_transport'
  }
  if (
    lower.includes('cheapest') ||
    lower.includes('cheap') ||
    lower.includes('budget') ||
    lower.includes('save money')
  ) {
    return 'optimize_for_money'
  }
  return 'optimize_for_time'
}
