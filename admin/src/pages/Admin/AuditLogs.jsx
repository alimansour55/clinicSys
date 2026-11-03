import { useContext, useEffect, useId, useMemo, useState } from 'react'
import axios from 'axios'
import { AlertCircle, Calendar, CheckCircle2, Clock3, Filter, History, RefreshCw, Search, ShieldCheck, Trash2, XCircle } from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import { AdminPage, ExportButton, StatCard } from '../../components/admin/AdminPage'
import { Badge, Button, EmptyState, Field, Input, Select, Skeleton, SkeletonGroup, notify } from '../../components/ui'
import { downloadCsv } from '../../utils/csvExport'

const initialFilters = {
  action: '',
  actorUserId: '',
  entityType: '',
  status: '',
  startDate: '',
  endDate: ''
}

const FIRST_LIMIT = 200
const MAX_LIMIT = 1000
const DAY_MS = 24 * 60 * 60 * 1000
/* The server matches `action` by partial text, so this catches login_success and login_failed */
const SIGN_IN_ACTION = 'login'

/* Written out with t() so the missing-keys test can see every label */
export const actionLabels = (t) => ({
  login_success: t('Successful sign-in'),
  login_failed: t('Failed sign-in'),
  unauthorized_access: t('Unauthorized access attempt'),
  doctor_create: t('Doctor added'),
  doctor_update: t('Doctor updated'),
  user_create: t('User created'),
  user_update: t('User updated'),
  user_delete: t('User deleted'),
  user_password_reset: t('User password reset'),
  user_mfa_reset: t('User two-step verification reset'),
  user_mfa_requirement_update: t('Two-step verification requirement changed'),
  patient_status_update: t('Patient status changed'),
  patient_delete: t('Patient deleted'),
  profile_delete: t('Profile deleted'),
  receptionist_create: t('Receptionist added'),
  receptionist_update: t('Receptionist updated'),
  clinic_create: t('Clinic added'),
  clinic_update: t('Clinic updated'),
  clinic_delete: t('Clinic deleted'),
  clinic_doctors_assign: t('Doctors assigned to clinic'),
  appointment_cancel: t('Appointment cancelled'),
  medical_history_delete: t('Medical history deleted'),
  site_home_hero_update: t('Home page hero updated'),
  site_home_banner_update: t('Home page banner updated'),
  site_home_service_cards_update: t('Home page service cards updated'),
  site_footer_update: t('Site footer updated'),
  site_branding_update: t('Site branding updated'),
  security_settings_update: t('Security settings changed'),
  insurance_providers_update: t('Insurance providers updated'),
  global_visit_fees_update: t('Visit fees updated'),
  home_visit_pricing_update: t('Home visit prices changed'),
  language_policies_update: t('Language policies updated'),
  admin_profile_update: t('Admin profile updated'),
  mfa_enable: t('Two-step verification turned on'),
  mfa_disable: t('Two-step verification turned off'),
  doctor_availability_bulk_update: t('Doctor availability updated in bulk'),
  user_status_bulk_update: t('User status updated in bulk'),
  user_mfa_requirement_bulk_update: t('Two-step verification requirement updated in bulk'),
  user_mfa_bulk_reset: t('Two-step verification reset in bulk')
})

const entityLabels = (t) => ({
  admin: t('Admin'),
  appointment: t('Appointment'),
  clinic: t('Clinic'),
  doctor: t('Doctor'),
  patient: t('Patient'),
  prescription: t('Prescription'),
  rating: t('Rating'),
  receptionist: t('Receptionist'),
  site_settings: t('Site settings'),
  user: t('User')
})

const statusLabel = (status, t) => {
  if (status === 'success') return t('Success')
  if (status === 'failed') return t('Failed')
  return status ? t(status) : '—'
}

const localDay = (time) => {
  const date = new Date(time)
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

const isoDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

const locationText = (log) => [log.location?.city, log.location?.region, log.location?.country].filter(Boolean).join(', ')

const AuditRow = ({ log, actions, entities, formatDate, fill }) => {
  const { t } = useLanguage()
  const label = actions[log.action] || log.action
  const who = log.metadata?.username || log.metadata?.email || log.metadata?.loginId
  const role = log.actorRole ? entities[log.actorRole] || t(log.actorRole) : ''
  const actor = [role, who && (role ? `(${who})` : who)].filter(Boolean).join(' ')
  const entity = log.entityType ? entities[log.entityType] || t(log.entityType) : ''
  const place = locationText(log)
  const failed = log.status === 'failed'

  return (
    <li className='flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5'>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <p className='min-w-0 break-words font-semibold text-ink'>
            {actor ? fill('{{action}} by {{actor}}', { action: label, actor }) : label}
          </p>
          <Badge tone={failed ? 'danger' : log.status === 'success' ? 'success' : 'neutral'}>
            {failed ? <XCircle aria-hidden='true' className='size-3' /> : <CheckCircle2 aria-hidden='true' className='size-3' />}
            {statusLabel(log.status, t)}
          </Badge>
        </div>
        {log.reason && <p className='mt-1 break-words text-body-sm text-ink-2'>{`${t('Reason')}: ${t(log.reason)}`}</p>}
        <p className='mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-caption text-ink-3'>
          {entity && <span>{`${t('Record')}: ${entity}`}</span>}
          {log.ipAddress ? <bdi dir='ltr'>{log.ipAddress}</bdi> : <span>{t('No IP')}</span>}
          {place && <span>{place}</span>}
        </p>
        <details className='mt-2 text-caption'>
          <summary className='cursor-pointer font-medium text-brand'>{t('Full record')}</summary>
          <pre dir='ltr' className='mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-control bg-surface-sunken p-3 text-start text-ink-2'>
            {JSON.stringify(log, null, 2)}
          </pre>
        </details>
      </div>
      <p className='inline-flex shrink-0 items-center gap-1 text-caption text-ink-3'>
        <Calendar aria-hidden='true' className='size-3' />
        <time dateTime={isoDate(log.createdAt) || undefined}>{formatDate(log.createdAt)}</time>
      </p>
    </li>
  )
}

const AuditLogs = () => {
  const { aToken, backendUrl } = useContext(AdminContext)
  const { t, language } = useLanguage()
  const actionListId = useId()
  const [filters, setFilters] = useState(initialFilters)
  /* What the rows on screen were asked for. `filters` is only the form until Apply is pressed. */
  const [query, setQuery] = useState({ filters: initialFilters, last24: false, limit: FIRST_LIMIT })
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(null)
  const [cutoff, setCutoff] = useState(null)
  const [seen, setSeen] = useState({ actions: [], entities: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [auditPolicy, setAuditPolicy] = useState({ enabled: true, retentionDays: null, purgedAuditLogs: 0 })

  const locale = language === 'ar' ? 'ar-EG' : 'en-US'
  const actions = useMemo(() => actionLabels(t), [t])
  const entities = useMemo(() => entityLabels(t), [t])

  useEffect(() => {
    if (!aToken) return undefined
    let stale = false

    const load = async () => {
      setLoading(true)
      const since = Date.now() - DAY_MS
      const params = { limit: query.limit }
      Object.entries(query.filters).forEach(([key, value]) => {
        if (value) params[key] = value
      })
      /*
       * The server only filters by whole days, in its own time zone. Ask for a day more than
       * needed and trim to the exact 24 hours here.
       */
      if (query.last24) params.startDate = localDay(since - DAY_MS)

      try {
        let response
        try {
          response = await axios.get(`${backendUrl}/api/admin/audit-logs`, { headers: { aToken }, params })
        } catch (error) {
          if (error.response?.status !== 404) throw error
          response = await axios.get(`${backendUrl}/api/audit-logs`, { headers: { aToken }, params })
        }
        if (stale) return

        const { data } = response
        if (!data.success) {
          setLoadError({ message: data.message })
          return
        }
        const rows = data.logs || []
        setLogs(rows)
        setTotal(Number.isFinite(data.total) ? data.total : rows.length)
        setCutoff(query.last24 ? since : null)
        setLoadError(null)
        setSeen((prev) => ({
          actions: [...new Set([...prev.actions, ...rows.map((row) => row.action).filter(Boolean)])],
          entities: [...new Set([...prev.entities, ...rows.map((row) => row.entityType).filter(Boolean)])]
        }))
        setAuditPolicy({
          enabled: data.auditLogsEnabled !== false,
          retentionDays: data.retentionDays || null,
          purgedAuditLogs: data.purgedAuditLogs || 0
        })
      } catch (error) {
        if (!stale) setLoadError({ message: error.response?.data?.message })
      } finally {
        if (!stale) setLoading(false)
      }
    }

    load()
    return () => {
      stale = true
    }
  }, [aToken, backendUrl, query])

  const fill = (key, vars = {}) => {
    let text = String(t(key))
    Object.entries(vars).forEach(([name, value]) => {
      text = text.split(`{{${name}}}`).join(String(value))
    })
    return text
  }
  const formatNumber = (value) => Number(value).toLocaleString(locale)
  const formatDate = (value) => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
  }

  const rows = useMemo(
    () => (cutoff ? logs.filter((log) => new Date(log.createdAt).getTime() >= cutoff) : logs),
    [logs, cutoff]
  )
  const moreOnServer = (total ?? logs.length) > logs.length
  /* Rows arrive newest first, so one older than the cutoff means the 24 hours are all here */
  const reachedCutoff = Boolean(cutoff) && rows.length < logs.length
  const hasMore = moreOnServer && !reachedCutoff
  const matching = cutoff ? (hasMore ? null : rows.length) : total ?? rows.length
  const successCount = rows.filter((log) => log.status === 'success').length
  const failedCount = rows.filter((log) => log.status === 'failed').length

  const actionOptions = useMemo(
    () => [...new Set([...Object.keys(actions), ...seen.actions])].sort(),
    [actions, seen.actions]
  )
  const entityOptions = useMemo(
    () => [...new Set([...Object.keys(entities), ...seen.entities, ...(filters.entityType ? [filters.entityType] : [])])].sort(),
    [entities, seen.entities, filters.entityType]
  )

  const hasFilters = query.last24 || Object.values(filters).some(Boolean) || Object.values(query.filters).some(Boolean)
  const failedOnly = query.filters.status === 'failed'
  const signInsOnly = query.filters.action === SIGN_IN_ACTION

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const run = (nextFilters, last24) => {
    setFilters(nextFilters)
    setQuery({ filters: nextFilters, last24, limit: FIRST_LIMIT })
  }

  const applyFilters = (event) => {
    event?.preventDefault()
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      notify.warning(t('The start date must be before the end date'))
      return
    }
    run(filters, query.last24 && !filters.startDate && !filters.endDate)
  }

  const clearFilters = () => run(initialFilters, false)
  const refresh = () => setQuery((prev) => ({ ...prev }))
  const loadMore = () => setQuery((prev) => ({ ...prev, limit: MAX_LIMIT }))

  const toggleFailed = () => run({ ...filters, status: failedOnly ? '' : 'failed' }, query.last24)
  const toggleSignIns = () => run({ ...filters, action: signInsOnly ? '' : SIGN_IN_ACTION }, query.last24)
  const toggleLast24 = () => run({ ...filters, startDate: '', endDate: '' }, !query.last24)

  const exportRows = () => {
    downloadCsv(
      'audit-logs',
      [
        { label: t('Date'), value: (log) => isoDate(log.createdAt) },
        { label: t('Event'), value: (log) => actions[log.action] || log.action },
        { label: t('Action code'), value: (log) => log.action },
        { label: t('Status'), value: (log) => statusLabel(log.status, t) },
        { label: t('Actor role'), value: (log) => (log.actorRole ? entities[log.actorRole] || t(log.actorRole) : '') },
        { label: t('Actor user ID'), value: (log) => log.actorUserId },
        { label: t('Entity type'), value: (log) => (log.entityType ? entities[log.entityType] || t(log.entityType) : '') },
        { label: t('Entity ID'), value: (log) => log.entityId },
        { label: t('Target user ID'), value: (log) => log.targetUserId },
        { label: t('Reason'), value: (log) => (log.reason ? t(log.reason) : '') },
        { label: t('IP address'), value: (log) => log.ipAddress },
        { label: t('Location'), value: locationText }
      ],
      rows
    )
  }

  const chips = [
    { key: 'failed', label: t('Failed only'), icon: <XCircle aria-hidden='true' className='size-4' />, pressed: failedOnly, onClick: toggleFailed },
    { key: 'signins', label: t('Sign-ins'), icon: <ShieldCheck aria-hidden='true' className='size-4' />, pressed: signInsOnly, onClick: toggleSignIns },
    { key: 'last24', label: t('Last 24 hours'), icon: <Clock3 aria-hidden='true' className='size-4' />, pressed: query.last24, onClick: toggleLast24 }
  ]

  const showingText =
    matching === null
      ? fill('Showing {{shown}} so far. Load more to see the rest of the last 24 hours.', { shown: formatNumber(rows.length) })
      : fill('Showing {{shown}} of {{total}}', { shown: formatNumber(rows.length), total: formatNumber(matching) })

  return (
    <AdminPage
      title={t('Audit logs')}
      description={t('Review security, payment, profile, and medical-record activity')}
      icon={ShieldCheck}
      actions={
        <>
          <ExportButton onExport={exportRows} disabled={!rows.length} />
          <Button
            variant='secondary'
            size='sm'
            loading={loading}
            onClick={refresh}
            leadingIcon={<RefreshCw aria-hidden='true' className='size-4' />}
          >
            {t('Refresh')}
          </Button>
        </>
      }
    >
      {!auditPolicy.enabled && (
        <p role='status' className='mb-4 flex items-start gap-2 rounded-card bg-warning-soft p-4 text-body-sm text-warning-ink'>
          <AlertCircle aria-hidden='true' className='mt-0.5 size-4 shrink-0' />
          {t('Audit logging is turned off, so new activity is not being recorded.')}
        </p>
      )}

      <form onSubmit={applyFilters} className='mb-4 rounded-card border border-line bg-surface p-4 shadow-e1 sm:mb-5'>
        <div className='mb-3 flex items-center gap-2 text-body-sm font-semibold text-ink'>
          <Filter aria-hidden='true' className='size-4 text-ink-3' />
          {t('Filters')}
        </div>

        <div className='mb-4 flex flex-wrap gap-2'>
          {chips.map(({ key, label, icon, pressed, onClick }) => (
            <button
              key={key}
              type='button'
              aria-pressed={pressed}
              onClick={onClick}
              className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-body-sm font-medium transition duration-(--duration-fast) ease-standard ${
                pressed
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-line-strong bg-surface text-ink-2 hover:border-primary hover:bg-primary-soft'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
          <Field label={t('Action')}>
            <Input
              list={actionListId}
              dir='ltr'
              value={filters.action}
              onChange={(e) => updateFilter('action', e.target.value)}
              placeholder={t('For example: login')}
              className='text-start rtl:text-end'
            />
          </Field>
          <datalist id={actionListId}>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {actions[action] || action}
              </option>
            ))}
          </datalist>
          <Field label={t('Actor user ID')}>
            <Input
              dir='ltr'
              value={filters.actorUserId}
              onChange={(e) => updateFilter('actorUserId', e.target.value)}
              className='text-start rtl:text-end'
            />
          </Field>
          <Field label={t('Entity type')}>
            <Select value={filters.entityType} onChange={(e) => updateFilter('entityType', e.target.value)}>
              <option value=''>{t('All types')}</option>
              {entityOptions.map((type) => (
                <option key={type} value={type}>
                  {entities[type] || t(type)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('Status')}>
            <Select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
              <option value=''>{t('All statuses')}</option>
              <option value='success'>{t('Success')}</option>
              <option value='failed'>{t('Failed')}</option>
            </Select>
          </Field>
          <Field label={t('From date')}>
            <Input type='date' value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} />
          </Field>
          <Field label={t('To date')}>
            <Input type='date' value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} />
          </Field>
        </div>

        <div className='mt-4 flex flex-wrap gap-2'>
          <Button type='submit' size='sm' leadingIcon={<Search aria-hidden='true' className='size-4' />}>
            {t('Apply')}
          </Button>
          {hasFilters && (
            <Button variant='ghost' size='sm' onClick={clearFilters} leadingIcon={<XCircle aria-hidden='true' className='size-4' />}>
              {t('Clear')}
            </Button>
          )}
        </div>
      </form>

      <div className='mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <StatCard
          label={t('Failed')}
          value={formatNumber(failedCount)}
          hint={t('In the rows shown')}
          icon={XCircle}
          tone='text-danger-ink'
        />
        <StatCard
          label={t('Success')}
          value={formatNumber(successCount)}
          hint={t('In the rows shown')}
          icon={CheckCircle2}
          tone='text-success-ink'
        />
        <StatCard
          label={t('Matching records')}
          value={matching === null ? '—' : formatNumber(matching)}
          icon={History}
        />
        <StatCard
          label={t('Retention')}
          value={auditPolicy.retentionDays ? fill('{{n}} days', { n: formatNumber(auditPolicy.retentionDays) }) : t('Policy default')}
          hint={auditPolicy.purgedAuditLogs > 0 ? fill('Expired records removed: {{n}}', { n: formatNumber(auditPolicy.purgedAuditLogs) }) : undefined}
          icon={Trash2}
          tone='text-ink-3'
        />
      </div>

      <section className='overflow-hidden rounded-card border border-line bg-surface shadow-e1'>
        <p role='status' className='border-b border-line bg-surface-sunken px-4 py-2.5 text-body-sm font-medium text-ink-2 sm:px-5'>
          {loading && !logs.length ? t('Loading audit logs…') : showingText}
        </p>

        {loadError ? (
          <EmptyState
            icon={<AlertCircle />}
            title={t('Could not load audit logs')}
            description={loadError.message ? t(loadError.message) : t('Check your connection and try again.')}
            action={
              <Button variant='secondary' loading={loading} onClick={refresh}>
                {t('Try again')}
              </Button>
            }
          />
        ) : loading && !logs.length ? (
          <SkeletonGroup label={t('Loading audit logs…')} className='space-y-4 p-5'>
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className='space-y-2'>
                <Skeleton className='h-4 w-2/3' />
                <Skeleton className='h-3 w-1/3' />
              </div>
            ))}
          </SkeletonGroup>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<AlertCircle />}
            title={t('No audit logs found')}
            description={t('Try refreshing or changing the filters.')}
            action={
              hasFilters ? (
                <Button variant='secondary' onClick={clearFilters}>
                  {t('Clear')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul aria-busy={loading} className={loading ? 'opacity-60' : undefined}>
            {rows.map((log) => (
              <AuditRow key={log._id} log={log} actions={actions} entities={entities} formatDate={formatDate} fill={fill} />
            ))}
          </ul>
        )}

        {!loadError && hasMore && (
          <div className='flex flex-col items-center gap-2 border-t border-line p-4 text-center'>
            {query.limit < MAX_LIMIT ? (
              <Button variant='secondary' size='sm' loading={loading} onClick={loadMore}>
                {fill('Load up to {{n}}', { n: formatNumber(MAX_LIMIT) })}
              </Button>
            ) : (
              <p className='text-caption text-ink-3'>
                {fill('Only the newest {{n}} records can be loaded. Narrow the filters to reach older ones.', { n: formatNumber(MAX_LIMIT) })}
              </p>
            )}
          </div>
        )}
      </section>
    </AdminPage>
  )
}

export default AuditLogs
