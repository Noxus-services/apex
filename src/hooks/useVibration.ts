export function useVibration() {
  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator
  return {
    tap: () => canVibrate && navigator.vibrate(10),
    success: () => canVibrate && navigator.vibrate([30, 20, 60]),
    pr: () => canVibrate && navigator.vibrate([60, 30, 60, 30, 120]),
    error: () => canVibrate && navigator.vibrate([100, 50, 100]),
    timerEnd: () => canVibrate && navigator.vibrate([200, 100, 50, 50, 50]),
  }
}
