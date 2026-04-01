import { useState } from 'react'
import { useUserStore } from './store/userStore'
import { Onboarding } from './components/onboarding/Onboarding'
import { NavBar } from './components/NavBar'
import { Home } from './pages/Home'
import { WorkoutPage } from './pages/Workout'
import { HistoryPage } from './pages/History'
import { CoachPage } from './pages/Coach'
import { ProfilePage } from './pages/Profile'

type Page = 'home' | 'workout' | 'history' | 'coach' | 'profile'

export default function App() {
  const { isOnboarded, setOnboarded } = useUserStore()
  const [currentPage, setCurrentPage] = useState<Page>('home')

  if (!isOnboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />
  }

  return (
    <div className="min-h-screen bg-bg-base">
      <main>
        {currentPage === 'home' && (
          <Home onNavigate={(page) => setCurrentPage(page as Page)} />
        )}
        {currentPage === 'workout' && (
          <WorkoutPage onNavigate={(page) => setCurrentPage(page as Page)} />
        )}
        {currentPage === 'history' && <HistoryPage />}
        {currentPage === 'coach' && <CoachPage />}
        {currentPage === 'profile' && <ProfilePage />}
      </main>
      <NavBar currentPage={currentPage} onNavigate={setCurrentPage} />
    </div>
  )
}
