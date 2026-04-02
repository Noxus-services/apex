/**
 * Centralized localStorage key constants.
 * Always use these instead of magic strings to prevent typos.
 */

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export const STORAGE_KEYS = {
  /** Daily supplement taken IDs: array of number */
  supplementTaken: (date = todayStr()) => `apex_taken_${date}`,
  /** Daily protein intake: number (grams) */
  protein: (date = todayStr()) => `apex_protein_${date}`,
  /** Daily morning brief from apexBrain */
  morningBrief: (date = todayStr()) => `apex_brain_${date}_brief`,
  /** Interview context JSON from onboarding */
  interviewContext: 'apex_interview_context',
} as const
