import axios from 'axios'
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'
import { formatNotificationRelativeTime, formatPatientNotification } from '../utils/patientNotificationDisplay'

const REFRESH_EVENT = 'clinic:notifications-refresh'
const UNREAD_POLL_MS = 45000
const REMINDER_SYNC_MS = 5 * 60 * 1000

/** Where a notification leads. Account and reminder notices used to send everyone to appointments. */
const notificationTarget = (notification) => {
  switch (notification?.type) {
    case 'health_reminder':
      return '/my-profile?tab=reminders'
    case 'security':
    case 'account_status':
      return '/my-profile?tab=security'
    case 'profile_updated_admin':
      return '/my-profile?tab=profile'
    default:
      return '/my-appointments'
  }
}

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

  /* Reminders turn into notifications while the patient is here, as there is no server scheduler to send them. */
  const syncReminders = useCallback(async () => {
    if (!authHeaders || !backendUrl) return
    try {
      const response = await axios.post(
        `${backendUrl}/api/account/reminders/sync`,
        { tzOffsetMinutes: new Date().getTimezoneOffset() },
        { headers: authHeaders }
      )
      if (response?.data?.notified > 0) fetchUnread()
    } catch {
      /* ignore */
    }
  }, [authHeaders, backendUrl, fetchUnread])

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
    syncReminders()
    const unreadTimer = setInterval(fetchUnread, UNREAD_POLL_MS)
    const syncTimer = setInterval(syncReminders, REMINDER_SYNC_MS)
    const onRefresh = () => fetchUnread()
    window.addEventListener(REFRESH_EVENT, onRefresh)
    return () => {
      clearInterval(unreadTimer)
      clearInterval(syncTimer)
      window.removeEventListener(REFRESH_EVENT, onRefresh)
    }
  }, [authHeaders, fetchUnread, syncReminders])

  useEffect(() => {
    if (!open) return undefined
    fetchList()
    fetchUnread()
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
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
    navigate(notificationTarget(n))
  }

  /* A reminder's message is what the patient typed. Security notices are ours, so they can be translated. */
  const describe = (n) => {
    if (n.type === 'health_reminder') return { title: t('Time for your reminder'), message: n.message }
    if (n.type === 'security') return { title: t(n.title), message: t(n.message) }
    const { title, message } = formatPatientNotification(n, language)
    return { title: localizeDigits(title), message: localizeDigits(message) }
  }

  if (!authHeaders) return null

  return (
    <div className='relative' ref={wrapRef}>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        className='relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-brand shadow-e1 transition hover:bg-primary-soft'
        aria-label={t('Notifications')}
        aria-expanded={open}
      >
        <Bell className='h-5 w-5' strokeWidth={2} />
        {unread > 0 && (
          <span className='absolute -end-0.5 -top-0.5 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent ring-2 ring-surface'>
            {localizeDigits(unread > 99 ? '99+' : String(unread))}
          </span>
        )}
      </button>

      {open && (
        <div
          role='dialog'
          aria-label={t('Notifications')}
          className='absolute end-0 top-full z-[70] mt-2 w-[min(calc(100vw-1.5rem),22rem)] overflow-hidden rounded-card border border-line bg-surface-raised shadow-e3'
        >
          <div className='flex items-center justify-between border-b border-line px-4 py-3'>
            <p className='text-body-sm font-bold text-ink'>{t('Notifications')}</p>
            <button
              type='button'
              onClick={markAllRead}
              disabled={unread === 0}
              className='inline-flex min-h-9 items-center gap-1 rounded-control px-2 text-caption font-semibold text-brand transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40'
            >
              <CheckCheck className='h-3.5 w-3.5' />
              {t('Mark all read')}
            </button>
          </div>

          <div className='max-h-[min(60vh,22rem)] overflow-y-auto'>
            {loading ? (
              <div className='flex items-center justify-center gap-2 py-12 text-body-sm text-ink-2'>
                <Loader2 className='h-5 w-5 animate-spin' />
                {t('Loading...')}
              </div>
            ) : items.length === 0 ? (
              <p className='px-4 py-10 text-center text-body-sm text-ink-2'>{t('No notifications yet')}</p>
            ) : (
              <ul className='divide-y divide-line'>
                {items.map((n) => {
                  const { title, message } = describe(n)
                  return (
                    <li key={n._id}>
                      <button
                        type='button'
                        onClick={() => onRowClick(n)}
                        className={`flex w-full flex-col gap-1 px-4 py-3 text-start transition hover:bg-surface-sunken ${n.read ? '' : 'bg-primary-soft'}`}
                      >
                        <div className='flex items-start justify-between gap-2'>
                          <span className={`text-body-sm leading-snug ${n.read ? 'text-ink-2' : 'font-semibold text-ink'}`}>{title}</span>
                          {!n.read && <span className='mt-1 h-2 w-2 shrink-0 rounded-full bg-primary'><span className='sr-only'>{t('Unread')}</span></span>}
                        </div>
                        <p dir='auto' className='line-clamp-3 text-caption leading-relaxed text-ink-2'>{message}</p>
                        <span className='text-[11px] font-medium text-ink-3'>{formatNotificationRelativeTime(n.createdAt, language)}</span>
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
