export const SUPPLEMENT_TIMINGS: Record<string, { offset: number; anchor: 'morning' | 'pre' | 'post' | 'evening'; label: string }> = {
  'Créatine': { offset: 0, anchor: 'post', label: 'Post-séance ou matin' },
  'Protéines Whey': { offset: 30, anchor: 'post', label: '30 min post-séance' },
  'Caféine / Pré-workout': { offset: -45, anchor: 'pre', label: '45 min avant séance' },
  'Oméga-3': { offset: 0, anchor: 'morning', label: 'Avec le repas principal' },
  'Vitamine D': { offset: 0, anchor: 'morning', label: 'Le matin avec repas gras' },
  'Magnésium': { offset: 0, anchor: 'evening', label: 'Le soir avant de dormir' },
  'BCAA': { offset: 0, anchor: 'pre', label: 'Pendant la séance' },
  'ZMA': { offset: 0, anchor: 'evening', label: '30-60 min avant de dormir' },
}

export function calculateSupplementTime(
  supplement: string,
  trainingTimeStr: string,
  isTrainingDay: boolean
): string {
  const timing = SUPPLEMENT_TIMINGS[supplement]
  if (!timing) return '08:00'

  const [h, m] = trainingTimeStr.split(':').map(Number)
  const trainingMinutes = h * 60 + m
  let targetMinutes: number

  if (timing.anchor === 'morning') {
    targetMinutes = 8 * 60
  } else if (timing.anchor === 'evening') {
    targetMinutes = 21 * 60
  } else if (timing.anchor === 'pre' && isTrainingDay) {
    targetMinutes = trainingMinutes + timing.offset
  } else if (timing.anchor === 'post' && isTrainingDay) {
    targetMinutes = trainingMinutes + 60 + timing.offset
  } else {
    targetMinutes = 8 * 60 // rest day fallback
  }

  targetMinutes = Math.max(0, Math.min(1439, targetMinutes))
  const hh = Math.floor(targetMinutes / 60).toString().padStart(2, '0')
  const mm = (targetMinutes % 60).toString().padStart(2, '0')
  return `${hh}:${mm}`
}
