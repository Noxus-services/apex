import { useState, useEffect } from 'react'
import { useUserStore } from './store/userStore'
import { Onboarding } from './components/onboarding/Onboarding'
import { NavBar } from './components/NavBar'
import { Home } from './pages/Home'
import { WorkoutPage } from './pages/Workout'
import { HistoryPage } from './pages/History'
import { CoachPage } from './pages/Coach'
import { ProfilePage } from './pages/Profile'
import { MaJournee } from './pages/MaJournee'
import { StatsPage } from './pages/Stats'
import { SupplementsPage } from './pages/Supplements'
import { pushAthleteSnapshot } from './services/snapshotSync'

type Page = 'home' | 'workout' | 'history' | 'coach' | 'profile' | 'journee' | 'stats' | 'supplements'

export default function App() {
  const { isOnboarded, setOnboarded, profile } = useUserStore()
  const [currentPage, setCurrentPage] = useState<Page>('home')

  // Push a daily snapshot once the user is onboarded
  useEffect(() => {
    if (isOnboarded && profile) {
      pushAthleteSnapshot(profile)
    }
  }, [isOnboarded, profile])

  // Handle deep-link navigation from push notification clicks
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE' && event.data.url?.includes('journee')) {
        setCurrentPage('journee')
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage)
  }, [])

  // Onboarding overlays the full shell
  if (!isOnboarded) {
    return (
      <div className="onboarding-shell">
        <Onboarding onComplete={() => setOnboarded(true)} />
      </div>
    )
  }

  // Main app: flex column filling #root.
  // Each scrollable page is a direct flex child of #root and manages its own
  // scroll via page-container (flex:1, min-h-0, overflow-y:auto, overflow-x:hidden).
  // Workout is special: page-fixed gives it overflow:hidden + internal flex layout.
  return (
    <>
      {currentPage === 'home'        && <Home onNavigate={(page) => setCurrentPage(page as Page)} />}
      {currentPage === 'workout'     && (
        <div className="page-fixed">
          <WorkoutPage onNavigate={(page) => setCurrentPage(page as Page)} />
        </div>
      )}
      {currentPage === 'history'     && <HistoryPage />}
      {currentPage === 'coach'       && <CoachPage />}
      {currentPage === 'profile'     && <ProfilePage />}
      {currentPage === 'journee'     && <MaJournee />}
      {currentPage === 'stats'       && <StatsPage />}
      {currentPage === 'supplements' && <SupplementsPage />}
      <NavBar currentPage={currentPage} onNavigate={setCurrentPage} />
    </>
  )
}
