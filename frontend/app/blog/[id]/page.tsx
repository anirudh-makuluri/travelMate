'use client'

import { notFound } from 'next/navigation'
import { EnhancedBlogPostPage } from '@/components/EnhancedBlogPostPage'
import { getBlogById } from '@/lib/blogData'

interface BlogPageProps {
  params: {
    id: string
  }
}

export default function BlogPage({ params }: BlogPageProps) {
  const blog = getBlogById(params.id)

  if (!blog) {
    notFound()
  }

  return <EnhancedBlogPostPage blog={blog} />
}
