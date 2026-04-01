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
import { pushAthleteSnapshot } from './services/snapshotSync'

type Page = 'home' | 'workout' | 'history' | 'coach' | 'profile' | 'journee'

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

  // Main app: flex column filling #root
  // page-scroll pages scroll internally; page-fixed pages don't
  return (
    <>
      {currentPage === 'home' && (
        <div className="page-scroll">
          <Home onNavigate={(page) => setCurrentPage(page as Page)} />
        </div>
      )}
      {currentPage === 'workout' && (
        <div className="page-fixed">
          <WorkoutPage onNavigate={(page) => setCurrentPage(page as Page)} />
        </div>
      )}
      {currentPage === 'history' && (
        <div className="page-scroll">
          <HistoryPage />
        </div>
      )}
      {currentPage === 'coach' && (
        <div className="page-scroll">
          <CoachPage />
        </div>
      )}
      {currentPage === 'profile' && (
        <div className="page-scroll">
          <ProfilePage />
        </div>
      )}
      {currentPage === 'journee' && (
        <div className="page-scroll">
          <MaJournee />
        </div>
      )}
      <NavBar currentPage={currentPage} onNavigate={setCurrentPage} />
    </>
  )
}
