import { AuthScreen } from '@/components/AuthScreen'
import { Auth0MetadataSync } from '@/components/Auth0MetadataSync'
import { ElevenLabsConcierge } from '@/components/ElevenLabsConcierge'
import { LeftPanel } from '@/components/LeftPanel'
import { CenterPanel } from '@/components/CenterPanel'
import { RightPanel } from '@/components/RightPanel'
import { auth0 } from '@/lib/auth0'

export default async function Home() {
  const session = await auth0.getSession()

  if (!session) {
    return <AuthScreen />
  }

  const userId = session.user.sub ?? session.user.email ?? 'traveler'

  return (
    <main className="w-full h-screen overflow-hidden bg-warm-white">
      <Auth0MetadataSync userId={userId} />
      <ElevenLabsConcierge
        userId={userId}
        userEmail={session.user.email}
        userName={session.user.name}
      />
      <LeftPanel userId={userId} />
      <CenterPanel userId={userId} userEmail={session.user.email} userName={session.user.name} />
      <RightPanel userId={userId} />
    </main>
  )
}
