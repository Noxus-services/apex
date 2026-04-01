import { useState, useRef, useCallback, useEffect } from 'react'
import { useVibration } from './useVibration'

export function useTimer() {
  const [seconds, setSeconds] = useState<number | null>(null)
  const [totalSeconds, setTotalSeconds] = useState<number>(90)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<number | null>(null)
  const vibration = useVibration()

  const clear = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
  }, [])

  const start = useCallback(
    (duration: number) => {
      clear()
      setTotalSeconds(duration)
      setSeconds(duration)
      setIsRunning(true)
      intervalRef.current = window.setInterval(() => {
        setSeconds(prev => {
          if (prev === null || prev <= 1) {
            clear()
            setIsRunning(false)
            vibration.timerEnd()
            return 0
          }
          if (prev === 4) vibration.tap()
          return prev - 1
        })
      }, 1000)
    },
    [clear, vibration]
  )

  const stop = useCallback(() => {
    clear()
    setIsRunning(false)
    setSeconds(null)
  }, [clear])

  const addTime = useCallback((delta: number) => {
    setSeconds(prev => (prev !== null ? Math.max(0, prev + delta) : null))
  }, [])

  useEffect(() => () => clear(), [clear])

  return { seconds, totalSeconds, isRunning, start, stop, addTime }
}
