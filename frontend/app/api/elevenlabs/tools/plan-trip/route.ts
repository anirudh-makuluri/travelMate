import { NextRequest, NextResponse } from 'next/server'
import {
  getPlannerReferenceContextForMessage,
  getPlannerReferencedBlogPostsForMessage,
} from '@/lib/blogData'
import {
  authorizeElevenLabsToolRequest,
  getPlannerApiUrl,
  inferTransportPreference,
  unauthorizedToolResponse,
} from '../_lib'

type PlannerToolRequest = {
  prompt?: string
  language_code?: string
  region_code?: string
  currency_code?: string
  session_id?: string
}

export async function POST(request: NextRequest) {
  if (!authorizeElevenLabsToolRequest(request)) {
    return unauthorizedToolResponse()
  }

  const plannerApiUrl = getPlannerApiUrl()
  if (!plannerApiUrl) {
    return NextResponse.json(
      { error: 'Planner API URL is not configured.' },
      { status: 500 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as PlannerToolRequest
  const prompt = body.prompt?.trim()

  if (!prompt) {
    return NextResponse.json(
      { error: 'A prompt is required.' },
      { status: 400 }
    )
  }

  const referencedBlogPosts = getPlannerReferencedBlogPostsForMessage(prompt)
  const referenceContext = getPlannerReferenceContextForMessage(prompt)
  const enrichedPrompt = referenceContext
    ? [
        prompt,
        'Use this trip memory as inspiration and grounding context when relevant.',
        'Do not copy it exactly unless the user asks for a similar trip.',
        referenceContext,
      ].join('\n\n')
    : prompt

  try {
    const plannerResponse = await fetch(`${plannerApiUrl}/api/v1/planner/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: enrichedPrompt,
        language_code: body.language_code || 'en',
        region_code: body.region_code || 'US',
        currency_code: body.currency_code || 'USD',
        transport_preference: inferTransportPreference(prompt),
        session_id: body.session_id || 'elevenlabs-agent',
        referenced_blog_posts: referencedBlogPosts,
      }),
      cache: 'no-store',
    })

    const data = (await plannerResponse.json().catch(() => ({}))) as {
      explanation?: string
      follow_up_question?: string | null
      itinerary?: Array<{
        day_number: number
        theme: string
        stops: Array<{ place: { name: string } }>
      }>
      budget?: {
        estimated_total?: number | null
        currency_code?: string
        confidence?: string
      }
      referenced_blog_posts?: string[]
      detail?: string
    }

    if (!plannerResponse.ok) {
      return NextResponse.json(
        { error: data.detail || 'Planner tool request failed.' },
        { status: 502 }
      )
    }

    const itinerarySummary = (data.itinerary || []).slice(0, 2).map((day) => ({
      day_number: day.day_number,
      theme: day.theme,
      stops: day.stops.slice(0, 4).map((stop) => stop.place.name),
    }))

    return NextResponse.json({
      success: true,
      referenced_blog_posts: data.referenced_blog_posts || referencedBlogPosts,
      follow_up_question: data.follow_up_question || null,
      explanation: data.explanation || '',
      itinerary_summary: itinerarySummary,
      budget: data.budget || null,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Planner tool request failed.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
