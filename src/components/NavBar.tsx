import { Home, Dumbbell, CalendarDays, MessageCircle, User } from 'lucide-react'

type Page = 'home' | 'workout' | 'history' | 'coach' | 'profile' | 'journee'

interface NavBarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const tabs: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'home',    label: 'Accueil',  icon: Home },
  { id: 'workout', label: 'Séance',   icon: Dumbbell },
  { id: 'journee', label: 'Journée',  icon: CalendarDays },
  { id: 'coach',   label: 'Coach',    icon: MessageCircle },
  { id: 'profile', label: 'Profil',   icon: User },
]

export function NavBar({ currentPage, onNavigate }: NavBarProps) {
  return (
    <nav className="bottom-nav">
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative select-none active:scale-90 transition-transform duration-100"
            >
              {active && (
                <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent-yellow" />
              )}
              <Icon
                size={22}
                className={active ? 'text-accent-yellow' : 'text-[rgba(240,237,230,0.35)]'}
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span
                className={`text-[10px] font-body font-medium leading-none ${
                  active ? 'text-accent-yellow' : 'text-[rgba(240,237,230,0.35)]'
                }`}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
