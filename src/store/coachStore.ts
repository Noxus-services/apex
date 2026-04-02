import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CoachMessage, WeeklyReview } from '../types'

interface CoachState {
  // Persisted
  messages: CoachMessage[]
  weeklyReview: WeeklyReview | null

  // UI-only (not persisted)
  isOpen: boolean
  isStreaming: boolean
  isSearching: boolean   // Google Search grounding in progress
  streamingContent: string
  isChatOpen: boolean

  // Actions
  addMessage: (message: CoachMessage) => void
  setStreaming: (val: boolean) => void
  setSearching: (val: boolean) => void
  appendStreamChunk: (text: string) => void
  finalizeStream: () => void
  setWeeklyReview: (review: WeeklyReview) => void
  openChat: () => void
  closeChat: () => void
  clearMessages: () => void
}

export const useCoachStore = create<CoachState>()(
  persist(
    (set, get) => ({
      // Persisted state
      messages: [],
      weeklyReview: null,

      // UI state (defaults, not saved)
      isOpen: false,
      isStreaming: false,
      isSearching: false,
      streamingContent: '',
      isChatOpen: false,

      addMessage: (message: CoachMessage) => {
        set(state => ({ messages: [...state.messages, message].slice(-100) }))
      },

      setStreaming: (val: boolean) => {
        set({ isStreaming: val, streamingContent: val ? '' : get().streamingContent })
      },

      setSearching: (val: boolean) => {
        set({ isSearching: val })
      },

      appendStreamChunk: (text: string) => {
        set(state => ({ streamingContent: state.streamingContent + text }))
      },

      finalizeStream: () => {
        const { streamingContent, messages } = get()
        if (!streamingContent) return
        const assistantMessage: CoachMessage = {
          role: 'assistant',
          content: streamingContent,
          timestamp: new Date(),
          context: 'chat',
        }
        set({
          messages: [...messages, assistantMessage],
          isStreaming: false,
          streamingContent: '',
        })
      },

      setWeeklyReview: (review: WeeklyReview) => {
        set({ weeklyReview: review })
      },

      openChat: () => {
        set({ isChatOpen: true, isOpen: true })
      },

      closeChat: () => {
        set({ isChatOpen: false, isOpen: false })
      },

      clearMessages: () => {
        set({ messages: [] })
      },
    }),
    {
      name: 'apex-coach',
      // Only persist messages and weeklyReview, not UI state
      partialize: (state) => ({
        messages: state.messages,
        weeklyReview: state.weeklyReview,
      }),
    }
  )
)
