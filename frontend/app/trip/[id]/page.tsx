import { EnhancedBlogPostPage } from '@/components/EnhancedBlogPostPage'
import { auth0 } from '@/lib/auth0'
import { getBlogById } from '@/lib/blogData'
import { redirect } from 'next/navigation'

export default async function TripPage({ params }: { params: { id: string } }) {
  const session = await auth0.getSession()

  if (!session) {
    redirect('/')
  }

  const blog = getBlogById(params.id)

  if (!blog) {
    redirect('/')
  }

  return <EnhancedBlogPostPage blog={blog} />
}
