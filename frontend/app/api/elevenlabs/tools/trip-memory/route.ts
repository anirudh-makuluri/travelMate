import { NextRequest, NextResponse } from 'next/server'
import {
  getPlannerReferenceContextForMessage,
  getPlannerReferencedBlogPostsForMessage,
} from '@/lib/blogData'
import {
  authorizeElevenLabsToolRequest,
  unauthorizedToolResponse,
} from '../_lib'

type TripMemoryRequest = {
  query?: string
}

export async function POST(request: NextRequest) {
  if (!authorizeElevenLabsToolRequest(request)) {
    return unauthorizedToolResponse()
  }

  const body = (await request.json().catch(() => ({}))) as TripMemoryRequest
  const query = body.query?.trim() || ''
  const referencedBlogPosts = getPlannerReferencedBlogPostsForMessage(query)
  const memoryContext = getPlannerReferenceContextForMessage(query)

  return NextResponse.json({
    success: true,
    referenced_blog_posts: referencedBlogPosts,
    memory_context: memoryContext,
  })
}
