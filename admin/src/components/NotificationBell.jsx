import axios from 'axios'
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { AdminContext } from '../context/AdminContext'
import { DoctorContext } from '../context/DoctorContext'
import { ReceptionistContext } from '../context/ReceptionistContext'
import { useLanguage } from '../i18n'
import { resolveBackendUrl } from '../utils/resolveBackendUrl'

const REFRESH_EVENT = 'clinic:notifications-refresh'

const formatAgo = (iso) => {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const NotificationBell = () => {
  const { aToken } = useContext(AdminContext)
  const { dToken } = useContext(DoctorContext)
  const { rToken } = useContext(ReceptionistContext)
  const { t } = useLanguage()
  const navigate = useNavigate()

  const backendUrl = resolveBackendUrl()

  const authHeaders = useMemo(() => {
    if (aToken) return { atoken: aToken }
    if (dToken) return { dtoken: dToken }
    if (rToken) return { rtoken: rToken }
    return null
  }, [aToken, dToken, rToken])

  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef(null)

  const resolveRoute = useCallback(
    (n) => {
      const ty = n.type || ''
      if (aToken) {
        if (['appointment_booked', 'appointment_cancelled', 'appointment_status', 'payment_paid', 'visit_completed'].includes(ty)) {
          return '/actual-appointments'
        }
        if (ty === 'profile_updated_admin') return '/users'
        return '/admin-dashboard'
      }
      if (dToken) {
        if (ty === 'new_rating') return '/doctor-profile'
        return '/doctor-appointments'
      }
      if (rToken) return '/receptionist-appointments'
      return '/'
    },
    [aToken, dToken, rToken]
  )

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
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
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
    navigate(resolveRoute(n))
  }

  if (!authHeaders) return null

  return (
    <div className='relative' ref={wrapRef}>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        className='relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-primary/30 hover:bg-slate-50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/25'
        aria-label={t('Notifications')}
        aria-expanded={open}
      >
        <Bell className='h-5 w-5' strokeWidth={2} />
        {unread > 0 && (
          <span className='absolute -right-0.5 -top-0.5 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white'>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role='dialog'
          aria-label={t('Notifications')}
          className='absolute right-0 top-full z-[70] mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-black/5'
        >
          <div className='flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3'>
            <p className='text-sm font-bold text-slate-900'>{t('Notifications')}</p>
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
              <div className='flex items-center justify-center gap-2 py-12 text-sm text-slate-500'>
                <Loader2 className='h-5 w-5 animate-spin' />
                {t('Loading...')}
              </div>
            ) : items.length === 0 ? (
              <p className='px-4 py-10 text-center text-sm text-slate-500'>{t('No notifications yet')}</p>
            ) : (
              <ul className='divide-y divide-slate-100'>
                {items.map((n) => (
                  <li key={n._id}>
                    <button
                      type='button'
                      onClick={() => onRowClick(n)}
                      className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-slate-50 ${n.read ? 'opacity-75' : 'bg-indigo-50/40'}`}
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <span className={`text-sm font-semibold leading-snug ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</span>
                        {!n.read && <span className='mt-0.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500' />}
                      </div>
                      <p className='text-xs leading-relaxed text-slate-600 line-clamp-3'>{n.message}</p>
                      <span className='text-[11px] font-medium text-slate-400'>{formatAgo(n.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
