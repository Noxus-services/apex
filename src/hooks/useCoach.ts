import { useCoachStore } from '../store/coachStore'
import { useUserStore } from '../store/userStore'
import {
  streamResponse,
  buildPostWorkoutPrompt,
  buildWeeklyReviewPrompt,
  buildDailyCoachingPrompt,
} from '../api/gemini'
import { db } from '../db/database'
import type { WorkoutSession, ProgramDay, CoachMessage, WeeklyReview } from '../types'

export function useCoach() {
  const coachStore = useCoachStore()
  const { profile } = useUserStore()

  // ---------------------------------------------------------------------------
  // Build comprehensive context string for the coach
  // ---------------------------------------------------------------------------

  async function getContextForCoach(): Promise<string> {
    if (!profile) return ''

    // Last 5 sessions
    const recentSessions = await db.workoutSessions
      .orderBy('date')
      .reverse()
      .limit(5)
      .toArray()

    // Last 7 days wellness
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentWellness = await db.dailyWellness
      .where('date')
      .aboveOrEqual(sevenDaysAgo)
      .toArray()

    // Last 7 days sleep logs
    const recentSleepLogs = await db.sleepLogs
      .where('date')
      .aboveOrEqual(sevenDaysAgo)
      .toArray()

    // Active program
    const activeProgram =
      (await db.programs.filter(p => p.isActive === true).first()) ?? null

    // Supplement schedules
    const supplements = await db.supplementSchedules
      .filter(s => s.enabled)
      .toArray()

    return [
      '## CONTEXTE COMPLET ATHLÈTE',
      '',
      '### Profil',
      JSON.stringify(profile, null, 2),
      '',
      '### Dernières séances (5)',
      JSON.stringify(
        recentSessions.map(s => ({
          date: s.date,
          dayName: s.dayName,
          totalVolume: s.totalVolume,
          duration: s.duration,
          mood: s.mood,
          energy: s.energy,
          prsAchieved: s.prsAchieved,
          exercises: s.exercises.map(ex => ({
            name: ex.name,
            sets: ex.sets
              .filter(set => set.completed && !set.isWarmup)
              .map(set => ({ weight: set.weight, reps: set.reps, rpe: set.rpe })),
          })),
        })),
        null,
        2
      ),
      '',
      '### Données Wellness (7 derniers jours)',
      JSON.stringify(
        recentWellness.map(w => ({
          date: w.date,
          stress: w.stressLevel,
          soreness: w.soreness,
          motivation: w.motivation,
          hrv: w.hrv ?? null,
        })),
        null,
        2
      ),
      '',
      '### Données Sommeil (7 derniers jours)',
      JSON.stringify(
        recentSleepLogs.map(sl => ({
          date: sl.date,
          hoursSlept: sl.hoursSlept,
          quality: sl.quality,
        })),
        null,
        2
      ),
      '',
      '### Programme actif',
      activeProgram
        ? JSON.stringify(
            {
              name: activeProgram.name,
              weekNumber: activeProgram.weekNumber,
              aiRationale: activeProgram.aiRationale,
            },
            null,
            2
          )
        : 'Aucun programme actif',
      '',
      '### Suppléments déclarés (actifs)',
      supplements.length > 0
        ? supplements
            .map(s => `- ${s.supplement} à ${s.timeOfDay}${s.notes ? ` (${s.notes})` : ''}`)
            .join('\n')
        : 'Aucun supplément enregistré',
    ].join('\n')
  }

  // ---------------------------------------------------------------------------
  // Send a chat message (uses full context)
  // ---------------------------------------------------------------------------

  async function sendMessage(
    userMessage: string,
    context: CoachMessage['context'] = 'chat'
  ) {
    if (!profile) return

    const newUserMsg: CoachMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      context,
    }

    coachStore.addMessage(newUserMsg)
    await db.coachMessages.add(newUserMsg)

    // history already includes the new user message (added above via addMessage)
    const history = coachStore.messages.slice(-20)
    const messagesForApi: Array<{ role: 'user' | 'assistant'; content: string }> =
      history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // Build comprehensive context
    const systemExtra = await getContextForCoach()

    coachStore.setStreaming(true)

    let fullText = ''

    await streamResponse(
      messagesForApi,
      (chunk: string) => {
        fullText += chunk
        coachStore.appendStreamChunk(chunk)
      },
      async (_: string) => {
        coachStore.finalizeStream()
        coachStore.setSearching(false)

        const assistantMsg: CoachMessage = {
          role: 'assistant',
          content: fullText,
          timestamp: new Date(),
          context,
        }
        await db.coachMessages.add(assistantMsg)
      },
      (error: Error) => {
        coachStore.setStreaming(false)
        coachStore.setSearching(false)
        console.error('[useCoach] streamResponse error:', error)
      },
      systemExtra,
      () => coachStore.setSearching(true),
      () => coachStore.setSearching(false),
    )
  }

  // ---------------------------------------------------------------------------
  // Generate daily coaching message after wellness is saved
  // ---------------------------------------------------------------------------

  async function generateDailyCoaching(wellness: {
    sleep: number
    stress: number
    soreness: number
  }) {
    if (!profile) return

    // Load last 5 sessions
    const recentSessions = await db.workoutSessions
      .orderBy('date')
      .reverse()
      .limit(5)
      .toArray()

    // Load today's program day (best effort: match weekday to program day index)
    let todayProgramDay: import('../types').ProgramDay | null = null
    try {
      const activeProgram =
        (await db.programs.filter(p => p.isActive === true).first()) ?? null
      if (activeProgram && activeProgram.weeks.length > 0) {
        const weekIndex = Math.min(
          (activeProgram.weekNumber ?? 1) - 1,
          activeProgram.weeks.length - 1
        )
        const currentWeek = activeProgram.weeks[weekIndex]
        if (currentWeek) {
          // dayIndex 1=Mon ... 7=Sun, JS getDay() 0=Sun
          const jsDay = new Date().getDay()
          const dayIndex = jsDay === 0 ? 7 : jsDay
          todayProgramDay =
            currentWeek.days.find(d => d.dayIndex === dayIndex) ?? null
        }
      }
    } catch {
      // silently skip
    }

    const prompt = buildDailyCoachingPrompt(
      profile,
      wellness,
      recentSessions,
      todayProgramDay
    )

    // Send the result as a coach 'chat' message (assistant side only)
    coachStore.setStreaming(true)
    let fullText = ''

    await streamResponse(
      [{ role: 'user', content: prompt }],
      (chunk: string) => {
        fullText += chunk
        coachStore.appendStreamChunk(chunk)
      },
      async (_: string) => {
        coachStore.finalizeStream()
        const assistantMsg: CoachMessage = {
          role: 'assistant',
          content: fullText,
          timestamp: new Date(),
          context: 'chat',
        }
        await db.coachMessages.add(assistantMsg)
      },
      (error: Error) => {
        coachStore.setStreaming(false)
        console.error('[useCoach] generateDailyCoaching error:', error)
      }
    )
  }

  // ---------------------------------------------------------------------------
  // Analyze a completed workout
  // ---------------------------------------------------------------------------

  async function analyzeWorkout(
    session: WorkoutSession,
    plannedDay: ProgramDay | null
  ) {
    if (!profile) return

    const recentHistory = await db.workoutSessions
      .orderBy('date')
      .reverse()
      .limit(8)
      .toArray()

    const prompt = buildPostWorkoutPrompt(session, plannedDay, recentHistory)
    await sendMessage(prompt, 'post_workout')
  }

  // ---------------------------------------------------------------------------
  // Weekly review — now generates proper JSON metadata
  // ---------------------------------------------------------------------------

  async function checkWeeklyReview(force = false) {
    if (!profile) return

    const now = new Date()
    if (!force && (now.getDay() !== 0 || now.getHours() < 18)) return

    const lastReview = await db.weeklyReviews.orderBy('generatedAt').last()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    if (lastReview && new Date(lastReview.generatedAt) > weekAgo) return

    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))
    weekStart.setHours(0, 0, 0, 0)

    const weekSessions = await db.workoutSessions
      .where('date')
      .aboveOrEqual(weekStart)
      .toArray()

    const allHistory = await db.workoutSessions.orderBy('date').toArray()

    const activeProgram =
      (await db.programs.filter(p => p.isActive === true).first()) ?? null

    const prompt = buildWeeklyReviewPrompt(
      profile,
      weekSessions,
      allHistory,
      activeProgram
    )

    // Stream the review as a weekly_review context message
    coachStore.setStreaming(true)
    let fullText = ''

    await streamResponse(
      [{ role: 'user', content: prompt }],
      (chunk: string) => {
        fullText += chunk
        coachStore.appendStreamChunk(chunk)
      },
      async (_: string) => {
        coachStore.finalizeStream()

        const assistantMsg: CoachMessage = {
          role: 'assistant',
          content: fullText,
          timestamp: new Date(),
          context: 'weekly_review',
        }
        await db.coachMessages.add(assistantMsg)

        // Parse the JSON metadata if present
        try {
          const jsonSeparator = '--- JSON ---'
          const jsonIdx = fullText.indexOf(jsonSeparator)
          if (jsonIdx !== -1) {
            const jsonStr = fullText.slice(jsonIdx + jsonSeparator.length).trim()
            const meta = JSON.parse(jsonStr) as {
              progressScore: number
              keyInsights: string[]
            }

            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekStart.getDate() + 6)

            const review: WeeklyReview = {
              weekStart,
              weekEnd,
              generatedAt: new Date(),
              sessionsCount: weekSessions.length,
              totalVolume: weekSessions.reduce((acc, s) => acc + s.totalVolume, 0),
              analysis: fullText.slice(0, jsonIdx).trim(),
              nextWeekAdjustments: '',
              progressScore: meta.progressScore ?? 5,
              keyInsights: meta.keyInsights ?? [],
            }

            await db.weeklyReviews.add(review)
            coachStore.setWeeklyReview(review)
          }
        } catch {
          // JSON parsing failed — store a basic review anyway
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekStart.getDate() + 6)
          const review: WeeklyReview = {
            weekStart,
            weekEnd,
            generatedAt: new Date(),
            sessionsCount: weekSessions.length,
            totalVolume: weekSessions.reduce((acc, s) => acc + s.totalVolume, 0),
            analysis: fullText,
            nextWeekAdjustments: '',
            progressScore: 5,
            keyInsights: [],
          }
          await db.weeklyReviews.add(review)
          coachStore.setWeeklyReview(review)
        }
      },
      (error: Error) => {
        coachStore.setStreaming(false)
        console.error('[useCoach] checkWeeklyReview error:', error)
      }
    )
  }

  return {
    sendMessage,
    analyzeWorkout,
    checkWeeklyReview,
    generateDailyCoaching,
    getContextForCoach,
    messages: coachStore.messages,
    weeklyReview: coachStore.weeklyReview,
    isOpen: coachStore.isOpen,
    isStreaming: coachStore.isStreaming,
    streamingContent: coachStore.streamingContent,
    isChatOpen: coachStore.isChatOpen,
    setWeeklyReview: coachStore.setWeeklyReview,
    openChat: coachStore.openChat,
    closeChat: coachStore.closeChat,
    clearMessages: coachStore.clearMessages,
  }
}
