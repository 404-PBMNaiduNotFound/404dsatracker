'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/integrations/firebase/client'
import { PlanProvider } from '@/hooks/usePlan'
import { SettingsProvider, useSettings } from '@/hooks/useSettings'
import { ReminderRunner } from '@/components/ReminderRunner'
import { AppShell } from '@/components/AppShell'
import { hasExistingPlan, seedPlan, claimUsername } from '@/lib/db'
import { saveSettings } from '@/lib/settings'
import { QuoteLoader } from '@/components/QuoteLoader'
import { OnboardingModal } from '@/components/OnboardingModal'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import type { DailyCounts } from '@/lib/plan'


export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Auto-logout only after 7 days of no visits at all. A normal user who
  // just keeps clicking "logout" manually (or never does) is unaffected.
  useInactivityLogout(!!user)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
      } else {
        router.push('/auth?next=/today')
      }
      setLoading(false)
    })

    return () => unsub()
  }, [router])

  if (loading) {
    return <QuoteLoader fullScreen />
  }

  if (!user) {
    return null
  }

  return (
    <SettingsProvider userId={user.uid}>
      <PlanBoundary email={user.email ?? ''} userId={user.uid}>
        {children}
      </PlanBoundary>
    </SettingsProvider>
  )
}

function PlanBoundary({
  email,
  userId,
  children,
}: {
  email: string
  userId: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const { settings, update: updateSettings } = useSettings()
  const [checkingPlan, setCheckingPlan] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [planReady, setPlanReady] = useState(false)

  useEffect(() => {
    hasExistingPlan(userId).then((exists) => {
      if (!exists) {
        // New user — show onboarding modal instead of redirecting to settings
        setShowOnboarding(true)
        setCheckingPlan(false)
      } else {
        setPlanReady(true)
        setCheckingPlan(false)
      }
    })
  }, [userId])

  const handleOnboardingComplete = async (startDate: string, counts: DailyCounts, username: string) => {
    // Claim their unique username first — checked for duplicates live in the
    // modal, but claimUsername() re-checks atomically here before it's saved.
    await claimUsername(userId, username)
    // Save their chosen settings
    await updateSettings({ counts })
    await saveSettings(userId, { counts })
    // Seed the plan with their chosen start date and pace counts
    await seedPlan(userId, startDate, counts)
    // Show the app — land on their Profile page first, then they can
    // navigate anywhere else from there.
    setShowOnboarding(false)
    setPlanReady(true)
    router.push('/profile')
  }

  if (checkingPlan) {
    return <QuoteLoader fullScreen />
  }

  // Show onboarding modal — render a minimal shell behind it so app is ready
  if (showOnboarding) {
    return (
      <>
        <OnboardingModal open={true} onComplete={handleOnboardingComplete} />
        {/* Faded background while onboarding */}
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40" />
      </>
    )
  }

  if (!planReady) {
    return <QuoteLoader fullScreen />
  }

  return (
    <PlanProvider userId={userId} paused={settings.paused}>
      <AppShell email={email}>
        <ReminderRunner />
        {children}
      </AppShell>
    </PlanProvider>
  )
}