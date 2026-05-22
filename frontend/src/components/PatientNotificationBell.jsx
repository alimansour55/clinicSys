import axios from 'axios'
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'
import { formatNotificationRelativeTime, formatPatientNotification } from '../utils/patientNotificationDisplay'

const REFRESH_EVENT = 'clinic:notifications-refresh'

const PatientNotificationBell = () => {
  const { token, backendUrl } = useContext(AppContext)
  const { t, language, localizeDigits } = useLanguage()
  const navigate = useNavigate()

  const authHeaders = useMemo(() => (token ? { token } : null), [token])

  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef(null)

  const fetchUnread = useCallback(async () => {
    if (!authHeaders || !backendUrl) return
    try {
      const { data } = await axios.get(`${backendUrl}/api/notifications/unread-count`, { headers: authHeaders })
      if (data.success) setUnread(Number(data.unreadCount) || 0)
    } catch {
      /* ignore */
    }
  }, [authHeaders, backendUrl])

  const fetchList = useCallback(async () => {
    if (!authHeaders || !backendUrl) return
    setLoading(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/notifications?limit=40`, { headers: authHeaders })
      if (data.success) setItems(data.notifications || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [authHeaders, backendUrl])

  useEffect(() => {
    if (!authHeaders) return undefined
    fetchUnread()
    const id = setInterval(fetchUnread, 45000)
    const onRefresh = () => fetchUnread()
    window.addEventListener(REFRESH_EVENT, onRefresh)
    return () => {
      clearInterval(id)
      window.removeEventListener(REFRESH_EVENT, onRefresh)
    }
  }, [authHeaders, fetchUnread])

  useEffect(() => {
    if (!open) return undefined
    fetchList()
    fetchUnread()
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, fetchList, fetchUnread])

  const markRead = async (id) => {
    if (!authHeaders) return
    try {
      await axios.post(`${backendUrl}/api/notifications/${id}/read`, {}, { headers: authHeaders })
      setItems((prev) => prev.map((x) => (x._id === id ? { ...x, read: true, readAt: Date.now() } : x)))
      setUnread((u) => Math.max(0, u - 1))
    } catch {
      /* ignore */
    }
  }

  const markAllRead = async () => {
    if (!authHeaders) return
    try {
      await axios.post(`${backendUrl}/api/notifications/read-all`, {}, { headers: authHeaders })
      setItems((prev) => prev.map((x) => ({ ...x, read: true, readAt: Date.now() })))
      setUnread(0)
    } catch {
      /* ignore */
    }
  }

  const onRowClick = async (n) => {
    if (!n.read) await markRead(n._id)
    setOpen(false)
    navigate('/my-appointments')
  }

  if (!authHeaders) return null

  return (
    <div className='relative' ref={wrapRef}>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        className='relative flex h-10 w-10 items-center justify-center rounded-full border border-teal-100 bg-white text-primary shadow-sm transition hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-primary/25'
        aria-label={t('Notifications')}
        aria-expanded={open}
      >
        <Bell className='h-5 w-5' strokeWidth={2} />
            {unread > 0 && (
          <span className='absolute -right-0.5 -top-0.5 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white'>
            {localizeDigits(unread > 99 ? '99+' : String(unread))}
          </span>
        )}
      </button>

      {open && (
        <div
          role='dialog'
          aria-label={t('Notifications')}
          className='absolute right-0 top-full z-[70] mt-2 w-[min(calc(100vw-1.5rem),22rem)] overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-2xl ring-1 ring-black/5'
        >
          <div className='flex items-center justify-between border-b border-teal-50 bg-gradient-to-r from-teal-50/80 to-white px-4 py-3'>
            <p className='text-sm font-bold text-gray-900'>{t('Notifications')}</p>
            <button
              type='button'
              onClick={markAllRead}
              disabled={unread === 0}
              className='inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40'
            >
              <CheckCheck className='h-3.5 w-3.5' />
              {t('Mark all read')}
            </button>
          </div>

          <div className='max-h-[min(60vh,22rem)] overflow-y-auto'>
            {loading ? (
              <div className='flex items-center justify-center gap-2 py-12 text-sm text-gray-500'>
                <Loader2 className='h-5 w-5 animate-spin' />
                {t('Loading...')}
              </div>
            ) : items.length === 0 ? (
              <p className='px-4 py-10 text-center text-sm text-gray-500'>{t('No notifications yet')}</p>
            ) : (
              <ul className='divide-y divide-teal-50'>
                {items.map((n) => {
                  const { title: displayTitle, message: displayMessage } = formatPatientNotification(n, language)
                  const titleText = localizeDigits(displayTitle)
                  const messageText = localizeDigits(displayMessage)
                  return (
                  <li key={n._id}>
                    <button
                      type='button'
                      onClick={() => onRowClick(n)}
                      className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-teal-50/50 ${n.read ? 'opacity-75' : 'bg-teal-50/50'}`}
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <span className={`text-sm font-semibold leading-snug ${n.read ? 'text-gray-700' : 'text-gray-900'}`}>{titleText}</span>
                        {!n.read && <span className='mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary' />}
                      </div>
                      <p className='text-xs leading-relaxed text-gray-600 line-clamp-3'>{messageText}</p>
                      <span className='text-[11px] font-medium text-gray-400'>{formatNotificationRelativeTime(n.createdAt, language)}</span>
                    </button>
                  </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PatientNotificationBell
