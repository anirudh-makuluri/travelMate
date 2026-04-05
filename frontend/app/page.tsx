import { AuthScreen } from '@/components/AuthScreen'
import { LeftPanel } from '@/components/LeftPanel'
import { CenterPanel } from '@/components/CenterPanel'
import { RightPanel } from '@/components/RightPanel'
import { auth0 } from '@/lib/auth0'

export default async function Home() {
  const session = await auth0.getSession()

  if (!session) {
    return <AuthScreen />
  }

  return (
    <main className="w-full h-screen overflow-hidden bg-warm-white">
      <LeftPanel />
      <CenterPanel userEmail={session.user.email} userName={session.user.name} />
      <RightPanel />
    </main>
  )
}
