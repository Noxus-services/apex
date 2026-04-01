import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile } from '../types'

interface UserState {
  profile: UserProfile | null
  isOnboarded: boolean
  setProfile: (profile: UserProfile) => void
  updateProfile: (updates: Partial<UserProfile>) => void
  setOnboarded: (value: boolean) => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: null,
      isOnboarded: false,

      setProfile: (profile: UserProfile) => {
        set({ profile })
      },

      updateProfile: (updates: Partial<UserProfile>) => {
        const current = get().profile
        if (!current) return
        set({
          profile: {
            ...current,
            ...updates,
            updatedAt: new Date(),
          },
        })
      },

      setOnboarded: (value: boolean) => {
        set({ isOnboarded: value })
      },
    }),
    {
      name: 'apex-user',
    }
  )
)
