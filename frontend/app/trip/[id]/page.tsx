import { BlogPostPage } from '@/components/BlogPostPage'
import { auth0 } from '@/lib/auth0'
import { redirect } from 'next/navigation'

export default async function TripPage({ params }: { params: { id: string } }) {
  const session = await auth0.getSession()

  if (!session) {
    redirect('/')
  }

  return <BlogPostPage params={params} />
}
