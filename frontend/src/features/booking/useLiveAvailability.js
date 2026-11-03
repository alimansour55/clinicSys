import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAvailability } from './bookingApi'

const REFRESH_MS = 20_000

/** Slot data from the server, kept fresh while the page is visible and on returning to the tab. */
export const useLiveAvailability = ({ backendUrl, docId, appointmentType, clinicLocation, enabled = true }) => {
  const [availability, setAvailability] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const latestRequest = useRef(0)

  const refresh = useCallback(async () => {
    if (!enabled || !docId) return null
    const request = ++latestRequest.current
    try {
      const data = await fetchAvailability(backendUrl, docId, { appointmentType, clinicLocation })
      if (request !== latestRequest.current) return null
      if (data.success) {
        setAvailability(data)
        setFailed(false)
        return data
      }
      setFailed(true)
    } catch {
      if (request === latestRequest.current) setFailed(true)
    } finally {
      if (request === latestRequest.current) setLoading(false)
    }
    return null
  }, [backendUrl, docId, appointmentType, clinicLocation, enabled])

  useEffect(() => {
    setLoading(true)
    setAvailability(null)
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!enabled) return undefined
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, enabled])

  return { availability, loading, failed, refresh }
}
