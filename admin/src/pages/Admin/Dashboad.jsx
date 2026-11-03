import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarCheck2,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Lightbulb,
  LineChart,
  Minus,
  RefreshCw,
  Search,
  ShieldAlert,
  Stethoscope,
  UserPlus,
  Video,
  Wallet,
  XCircle
} from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, notify, Skeleton, SkeletonGroup, Tab, TabList, TabPanel, Tabs } from '../../components/ui'
import { ExportButton } from '../../components/admin/AdminPage'
import { openCommandPalette } from '../../components/admin/CommandPalette'
import { BusyHeatmap, DailyBars, ShareRows, Sparkline } from '../../components/admin/commandCenterCharts'
import { downloadCsv } from '../../utils/csvExport'
import { actionLabels } from './AuditLogs'

const REFRESH_MS = 60_000

const fill = (template, vars = {}) =>
  Object.entries(vars).reduce((text, [key, value]) => text.split(`{{${key}}}`).join(String(value)), String(template))

const ATTENTION_LABELS = {
  staleAppointments: 'Past visits still open',
  unpaidVisits: 'Finished visits not marked paid',
  refundProblems: 'Refunds pending or failed',
  insuranceReviews: 'Insurance waiting for review',
  doctorsNotBookable: 'Doctors patients cannot book',
  doctorsWithoutClinic: 'Doctors with no clinic',
  failedLogins: 'Failed sign-ins in the last 24 hours',
  pendingTranslations: 'Translations waiting',
  adminMfaOff: 'Your account has no MFA'
}

const INSIGHT_TEXT = {
  bookingsUp: 'Bookings are up {{pct}}% on last week: {{count}} against {{previous}}.',
  bookingsDown: 'Bookings are down {{pct}}% on last week: {{count}} against {{previous}}.',
  revenueUp: 'Collected revenue is up {{pct}}% on last week.',
  revenueDown: 'Collected revenue is down {{pct}}% on last week.',
  cancellationsHigh: '{{pct}}% of this week’s bookings were cancelled ({{count}}).',
  busiestSlot: 'Busiest time in the last 90 days: {{weekday}} at {{hour}}, with {{count}} visits.',
  doctorLead: '{{name}} took {{pct}}% of bookings in the last 30 days.',
  doctorCancellations: '{{pct}}% of bookings with {{name}} were cancelled in the last 30 days.',
  remoteShare: '{{pct}}% of visits are voice or video calls.'
}

const TONE_ICON = { success: ArrowUpRight, warning: AlertTriangle, danger: ShieldAlert, info: Lightbulb }
const TONE_CLASS = {
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink'
}

const STATUS_TONE = { Booked: 'neutral', 'Checked In': 'info', 'In Progress': 'brand', Finished: 'success', Cancelled: 'danger' }

const useFormatters = () => {
  const { language, localizeDigits } = useLanguage()
  const { currency } = useContext(AppContext)
  const number = useCallback((value) => localizeDigits(Number(value || 0).toLocaleString('en-US')), [localizeDigits])
  const money = useCallback((value) => `${currency}${number(value)}`, [currency, number])
  const weekday = useCallback(
    (value) => new Date(2024, 0, 7 + value).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long' }),
    [language]
  )
  const hour = useCallback(
    (value) => new Date(2024, 0, 1, value).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-GB', { hour: 'numeric', hour12: true }),
    [language]
  )
  const when = useCallback(
    (value) => new Date(value).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }),
    [language]
  )
  return { number, money, weekday, hour, when, language }
}

/** A figure, its change on the week before, and its last 30 days. A rise is not always good news. */
const Pulse = ({ label, measure, format, series, icon: Icon, upIsBad = false }) => {
  const { t, localizeDigits } = useLanguage()
  const { change, current, previous } = measure
  const flat = change === 0
  const isNew = change === null
  const rising = change > 0
  const DeltaIcon = flat ? Minus : isNew || rising ? ArrowUpRight : ArrowDownRight
  const good = flat ? null : isNew ? !upIsBad : rising !== upIsBad
  const toneClass = good === null ? 'text-ink-3' : good ? 'text-success-ink' : 'text-danger-ink'

  return (
    <Card variant='flat' className='p-4'>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-caption font-medium text-ink-3'>{label}</p>
        <Icon aria-hidden='true' className='size-4 text-ink-3' />
      </div>
      <p className='mt-1 whitespace-nowrap font-display text-title-lg tabular-nums text-ink'>{format(current)}</p>
      <div className='mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1'>
        <p className={`flex items-center gap-1 whitespace-nowrap text-caption font-medium ${toneClass}`}>
          <DeltaIcon aria-hidden='true' className='size-3.5 shrink-0' />
          {isNew ? t('New this week') : flat ? t('Same as last week') : `${localizeDigits(Math.abs(change))}% ${t('vs last week')}`}
          <span className='sr-only'>{`${t('Last week')}: ${format(previous)}`}</span>
        </p>
        <Sparkline values={series} label={`${label}, ${t('Last 30 days')}`} />
      </div>
    </Card>
  )
}

const TodayCard = ({ today, slotDateFormat }) => {
  const { t, tc, localizeDigits } = useLanguage()
  const { number, money } = useFormatters()
  const open = today.booked + today.checkedIn + today.inProgress
  const active = open + today.finished
  const donePercent = active ? Math.round((today.finished / active) * 100) : 0

  return (
    <Card variant='signature' className='overflow-hidden'>
      <div className='grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]'>
        <div className='border-b border-line p-5 sm:p-6 lg:border-b-0 lg:border-e'>
          <p className='text-caption font-semibold text-brand'>{t('Today')}</p>
          <p className='mt-1 font-display text-display-xl tabular-nums text-ink'>{number(active)}</p>
          <p className='text-body-sm text-ink-3'>{localizeDigits(slotDateFormat(today.date.split('-').reverse().map(Number).join('_')))}</p>

          <div
            role='progressbar'
            aria-valuenow={donePercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('Visits finished today')}
            className='mt-4 h-2 overflow-hidden rounded-full bg-surface-sunken'
          >
            <div className='h-full rounded-full bg-primary transition-all duration-(--duration-slow) ease-standard' style={{ width: `${donePercent}%` }} />
          </div>

          <dl className='mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-body-sm sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2'>
            {[
              [t('Waiting to start'), today.booked],
              [t('Checked in'), today.checkedIn],
              [t('With the doctor'), today.inProgress],
              [t('Finished'), today.finished],
              [t('Cancelled'), today.cancelled]
            ].map(([label, value]) => (
              <div key={label} className='flex justify-between gap-2'>
                <dt className='text-ink-3'>{label}</dt>
                <dd className='font-semibold tabular-nums text-ink'>{number(value)}</dd>
              </div>
            ))}
            <div className='flex justify-between gap-2'>
              <dt className='text-ink-3'>{t('Collected today')}</dt>
              <dd className='whitespace-nowrap font-semibold tabular-nums text-ink'>{money(today.collectedRevenue)}</dd>
            </div>
          </dl>
          <p className='mt-2 text-caption text-ink-3'>{`${t('Expected from today’s visits')}: ${money(today.expectedRevenue)}`}</p>
        </div>

        <div className='p-5 sm:p-6'>
          <div className='mb-3 flex items-center justify-between gap-2'>
            <h2 className='text-subtitle font-semibold text-ink'>{t('Up next')}</h2>
            <Link to='/actual-appointments' className='flex items-center gap-1 text-caption font-semibold text-brand hover:underline'>
              {t('All appointments')}
              <ChevronRight aria-hidden='true' className='size-3.5 rtl:-scale-x-100' />
            </Link>
          </div>
          {today.next.length === 0 ? (
            <p className='rounded-control bg-surface-sunken px-3 py-8 text-center text-body-sm text-ink-3'>{t('No more visits today.')}</p>
          ) : (
            <ul className='space-y-1.5'>
              {today.next.map((visit) => (
                <li key={visit._id} className='flex items-center gap-3 rounded-control px-2 py-1.5 hover:bg-surface-sunken'>
                  <span dir='ltr' className='w-14 shrink-0 text-body-sm font-semibold tabular-nums text-ink'>{localizeDigits(visit.slotTime)}</span>
                  {visit.doctorImage ? (
                    <img src={visit.doctorImage} alt='' className='size-8 shrink-0 rounded-full bg-surface-sunken object-cover' />
                  ) : (
                    <span aria-hidden='true' className='size-8 shrink-0 rounded-full bg-primary-soft' />
                  )}
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate text-body-sm font-medium text-ink'>{visit.patientName || t('Unknown')}</span>
                    <span className='block truncate text-caption text-ink-3'>{tc(visit.doctorNameI18n) || visit.doctorName}</span>
                  </span>
                  {visit.type !== 'Clinic' && <Video aria-label={t(visit.type)} className='size-4 shrink-0 text-ink-3' />}
                  <Badge tone={STATUS_TONE[visit.status] || 'neutral'}>{t(visit.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  )
}

const Dashboard = () => {
  const navigate = useNavigate()
  const { aToken, getCommandCenter, getDashData, dashData, adminNavSummary } = useContext(AdminContext)
  const { slotDateFormat } = useContext(AppContext)
  const { t, tc } = useLanguage()
  const { number, money, weekday, hour, when } = useFormatters()
  const [center, setCenter] = useState(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const next = await getCommandCenter()
      if (next) {
        setCenter(next)
        setFailed(false)
      } else {
        setFailed(true)
      }
    } catch {
      setFailed(true)
    }
    // Context methods are recreated on render in this app; the token is what changes them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  useEffect(() => {
    if (!aToken) return undefined
    load()
    getDashData()
    const timer = setInterval(() => {
      if (!document.hidden) load()
    }, REFRESH_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken, load])

  const refresh = async () => {
    setRefreshing(true)
    await Promise.all([load(), getDashData()])
    setRefreshing(false)
    notify.success(t('Figures are up to date'))
  }

  const seriesOf = useCallback((field) => (center?.series || []).map((day) => day[field]), [center])

  const insightText = useCallback(
    (insight) => {
      const vars = { ...insight.vars }
      if (vars.nameI18n !== undefined) vars.name = tc(vars.nameI18n) || vars.name
      if (vars.weekday !== undefined) vars.weekday = weekday(vars.weekday)
      if (vars.hour !== undefined) vars.hour = hour(vars.hour)
      ;['pct', 'count', 'previous'].forEach((key) => {
        if (vars[key] !== undefined) vars[key] = number(vars[key])
      })
      return fill(t(INSIGHT_TEXT[insight.key]), vars)
    },
    [t, tc, weekday, hour, number]
  )

  const clinicRows = useMemo(() => dashData?.clinicStats || [], [dashData])

  const exportSummary = () => {
    if (!center) return
    downloadCsv(
      'daily-figures',
      [
        { label: t('Date'), value: (row) => row.date },
        { label: t('Bookings'), value: (row) => row.bookings },
        { label: t('Cancelled'), value: (row) => row.cancelled },
        { label: t('Revenue'), value: (row) => row.revenue }
      ],
      center.series
    )
  }

  if (!center) {
    return (
      <div className='min-h-full bg-canvas px-gutter py-6'>
        <div className='mx-auto max-w-7xl'>
          {failed ? (
            <EmptyState
              icon={<XCircle aria-hidden='true' />}
              title={t('Could not load the figures')}
              description={t('Check the connection and try again.')}
              action={<Button onClick={load}>{t('Try again')}</Button>}
            />
          ) : (
            <SkeletonGroup className='space-y-4'>
              <Skeleton className='h-10 w-64' />
              <Skeleton className='h-64 w-full rounded-card' />
              <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
                {[0, 1, 2, 3].map((key) => <Skeleton key={key} className='h-32 rounded-card' />)}
              </div>
              <Skeleton className='h-72 w-full rounded-card' />
            </SkeletonGroup>
          )}
        </div>
      </div>
    )
  }

  const { today, pulse, attention, insights, doctors, mix, activity, heatmap, series, totals, generatedAt } = center

  return (
    <div className='min-h-full bg-canvas px-gutter py-5 sm:py-6'>
      <div className='mx-auto max-w-7xl space-y-5'>
        <header className='flex flex-wrap items-end justify-between gap-3'>
          <div className='min-w-0'>
            <h1 className='font-display text-display text-ink'>{t('Clinic overview')}</h1>
            <p className='mt-1 flex flex-wrap items-center gap-x-2 text-body-sm text-ink-3'>
              <span aria-hidden='true' className={`inline-block size-2 rounded-full ${failed ? 'bg-danger' : 'bg-success'}`} />
              {failed ? t('Showing the last figures we could load') : `${t('Updated')} ${when(generatedAt)}`}
              {adminNavSummary?.name && <span className='hidden sm:inline'>{`· ${adminNavSummary.name}`}</span>}
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='secondary' size='sm' onClick={openCommandPalette} leadingIcon={<Search aria-hidden='true' className='size-4' />}>
              {t('Search everything')}
            </Button>
            <ExportButton onExport={exportSummary} />
            <Button variant='secondary' size='sm' onClick={refresh} disabled={refreshing} leadingIcon={<RefreshCw aria-hidden='true' className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />}>
              {t('Refresh')}
            </Button>
          </div>
        </header>

        <div className='grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]'>
          <TodayCard today={today} slotDateFormat={slotDateFormat} />

          <Card variant='flat' className='flex flex-col'>
            <CardHeader
              title={
                <span className='flex items-center gap-2'>
                  <AlertTriangle aria-hidden='true' className='size-5 text-accent-ink' />
                  {t('Needs attention')}
                </span>
              }
            />
            <CardBody className='flex-1 pt-0'>
              {attention.length === 0 ? (
                <p className='flex items-center gap-2 rounded-control bg-success-soft px-3 py-4 text-body-sm text-success-ink'>
                  <Check aria-hidden='true' className='size-4' />
                  {t('Nothing is waiting on you.')}
                </p>
              ) : (
                <ul className='space-y-1'>
                  {attention.map((item) => (
                    <li key={item.key}>
                      <button
                        type='button'
                        onClick={() => navigate(item.path)}
                        className='flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-control px-2 py-1.5 text-start transition duration-(--duration-fast) ease-standard hover:bg-surface-sunken'
                      >
                        <span className={`flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-1.5 text-caption font-bold tabular-nums ${TONE_CLASS[item.tone]}`}>
                          {number(item.count)}
                        </span>
                        <span className='min-w-0 flex-1 text-body-sm text-ink'>{t(ATTENTION_LABELS[item.key])}</span>
                        <ChevronRight aria-hidden='true' className='size-4 shrink-0 text-ink-3 rtl:-scale-x-100' />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <section aria-label={t('This week')} className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          <Pulse label={t('Bookings this week')} measure={pulse.bookings} format={number} series={seriesOf('bookings')} icon={CalendarCheck2} />
          <Pulse label={t('Collected this week')} measure={pulse.revenue} format={money} series={seriesOf('revenue')} icon={Wallet} />
          <Pulse label={t('New patients this week')} measure={pulse.newPatients} format={number} series={[]} icon={UserPlus} />
          <Pulse label={t('Cancelled this week')} measure={pulse.cancellations} format={number} series={seriesOf('cancelled')} icon={XCircle} upIsBad />
        </section>

        {insights.length > 0 && (
          <section aria-label={t('What the numbers say')} className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'>
            {insights.map((insight) => {
              const Icon = TONE_ICON[insight.tone] || Lightbulb
              return (
                <div key={insight.key} className='flex items-start gap-3 rounded-card border border-line bg-surface p-4'>
                  <span aria-hidden='true' className={`flex size-8 shrink-0 items-center justify-center rounded-control ${TONE_CLASS[insight.tone]}`}>
                    <Icon className='size-4' />
                  </span>
                  <p className='text-body-sm text-ink'>{insightText(insight)}</p>
                </div>
              )
            })}
          </section>
        )}

        <div className='grid grid-cols-1 gap-5 lg:grid-cols-2'>
          <Card variant='flat'>
            <CardHeader
              title={
                <span className='flex items-center gap-2'>
                  <LineChart aria-hidden='true' className='size-5 text-brand' />
                  {t('Last 30 days')}
                </span>
              }
            />
            <CardBody className='pt-0'>
              <Tabs defaultValue='bookings'>
                <TabList label={t('Choose a measure')}>
                  <Tab value='bookings'>{t('Bookings')}</Tab>
                  <Tab value='revenue'>{t('Revenue')}</Tab>
                  <Tab value='cancelled'>{t('Cancelled')}</Tab>
                </TabList>
                <div className='mt-4'>
                  <TabPanel value='bookings'><DailyBars series={series} field='bookings' formatValue={number} label={t('Bookings')} /></TabPanel>
                  <TabPanel value='revenue'><DailyBars series={series} field='revenue' formatValue={money} label={t('Revenue')} /></TabPanel>
                  <TabPanel value='cancelled'><DailyBars series={series} field='cancelled' formatValue={number} label={t('Cancelled')} /></TabPanel>
                </div>
              </Tabs>
            </CardBody>
          </Card>

          <Card variant='flat'>
            <CardHeader
              title={
                <span className='flex items-center gap-2'>
                  <Clock aria-hidden='true' className='size-5 text-brand' />
                  {t('When the clinic is busy')}
                </span>
              }
            />
            <CardBody className='pt-0'>
              {heatmap.length ? (
                <BusyHeatmap cells={heatmap} label={t('When the clinic is busy')} />
              ) : (
                <p className='py-10 text-center text-body-sm text-ink-3'>{t('Not enough visits yet to show a pattern.')}</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className='grid grid-cols-1 gap-5 lg:grid-cols-3'>
          <Card variant='flat' className='lg:col-span-2'>
            <CardHeader
              title={
                <span className='flex items-center gap-2'>
                  <Stethoscope aria-hidden='true' className='size-5 text-brand' />
                  {t('Busiest doctors, last 30 days')}
                </span>
              }
              action={<Link to='/admin-financial-analytics' className='text-caption font-semibold text-brand hover:underline'>{t('Financial Analytics')}</Link>}
            />
            <CardBody className='pt-0'>
              {doctors.length === 0 ? (
                <p className='py-8 text-center text-body-sm text-ink-3'>{t('No bookings in the last 30 days.')}</p>
              ) : (
                <ul className='divide-y divide-line'>
                  {doctors.map((doctor) => (
                    <li key={doctor.docId}>
                      <button
                        type='button'
                        onClick={() => navigate('/doctor-list', { state: { openDoctorId: doctor.docId } })}
                        className='flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-start hover:bg-surface-sunken'
                      >
                        <span className='flex min-w-0 flex-1 basis-44 items-center gap-3'>
                          {doctor.image ? <img src={doctor.image} alt='' className='size-9 shrink-0 rounded-full bg-surface-sunken object-cover' /> : <span aria-hidden='true' className='size-9 shrink-0 rounded-full bg-primary-soft' />}
                          <span className='min-w-0'>
                            <span className='block truncate text-body-sm font-semibold text-ink'>{tc(doctor.nameI18n) || doctor.name}</span>
                            <span className='block truncate text-caption text-ink-3'>{tc(doctor.specialityI18n) || t(doctor.speciality)}</span>
                          </span>
                        </span>
                        <span className='text-body-sm tabular-nums text-ink'>{`${number(doctor.visits)} ${t('bookings')}`}</span>
                        <span className='w-24 text-body-sm font-semibold tabular-nums text-ink'>{money(doctor.revenue)}</span>
                        <span className={`w-20 text-caption tabular-nums ${doctor.cancelRate >= 30 ? 'font-semibold text-danger-ink' : 'text-ink-3'}`}>{`${number(doctor.cancelRate)}% ${t('cancelled')}`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card variant='flat'>
            <CardHeader title={t('How visits happen')} />
            <CardBody className='space-y-5 pt-0'>
              {mix.types.length ? <ShareRows rows={mix.types} formatLabel={(key) => t(key)} /> : <p className='text-body-sm text-ink-3'>{t('No visits yet.')}</p>}
              {mix.payments.length > 0 && (
                <div>
                  <p className='mb-2 text-caption font-semibold text-ink-3'>{t('How patients paid')}</p>
                  <ShareRows rows={mix.payments} formatLabel={(key) => t(key)} />
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className='grid grid-cols-1 gap-5 lg:grid-cols-3'>
          <Card variant='flat' className='overflow-hidden lg:col-span-2'>
            <CardHeader
              title={
                <span className='flex items-center gap-2'>
                  <Building2 aria-hidden='true' className='size-5 text-brand' />
                  {t('Clinic Statistics')}
                </span>
              }
              action={<Link to='/clinics' className='text-caption font-semibold text-brand hover:underline'>{t('Clinics')}</Link>}
            />
            <div className='overflow-x-auto'>
              <table className='w-full min-w-[34rem] text-body-sm'>
                <thead>
                  <tr className='border-y border-line bg-surface-sunken text-caption text-ink-3'>
                    {[t('Clinic'), t('Doctors'), t('Patients'), t('Appointments'), t('Revenue')].map((label) => (
                      <th key={label} scope='col' className='px-4 py-2 text-start font-semibold'>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className='divide-y divide-line'>
                  {clinicRows.length === 0 ? (
                    <tr><td colSpan={5} className='px-4 py-8 text-center text-ink-3'>{t('No clinic statistics available.')}</td></tr>
                  ) : (
                    clinicRows.map((clinic) => (
                      <tr key={clinic.name}>
                        <th scope='row' className='px-4 py-2.5 text-start font-medium text-ink'>{tc(clinic.i18n?.name) || t(clinic.name)}</th>
                        <td className='px-4 py-2.5 tabular-nums text-ink-2'>{number(clinic.doctors)}</td>
                        <td className='px-4 py-2.5 tabular-nums text-ink-2'>{number(clinic.patients)}</td>
                        <td className='px-4 py-2.5 tabular-nums text-ink-2'>{number(clinic.appointments)}</td>
                        <td className='px-4 py-2.5 font-semibold tabular-nums text-ink'>{money(clinic.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className='border-t border-line px-4 py-2.5 text-caption text-ink-3'>
              {`${t('All time')}: ${number(totals.appointments)} ${t('appointments')} · ${money(totals.revenue)} · ${number(totals.activePatients)} ${t('active patients')} · ${number(totals.doctorsAvailable)}/${number(totals.doctors)} ${t('doctors available')}`}
            </p>
          </Card>

          <Card variant='flat'>
            <CardHeader
              title={
                <span className='flex items-center gap-2'>
                  <Activity aria-hidden='true' className='size-5 text-brand' />
                  {t('Latest activity')}
                </span>
              }
              action={<Link to='/audit-logs' className='text-caption font-semibold text-brand hover:underline'>{t('Audit Logs')}</Link>}
            />
            <CardBody className='pt-0'>
              {activity.length === 0 ? (
                <p className='py-8 text-center text-body-sm text-ink-3'>{t('Nothing recorded yet.')}</p>
              ) : (
                <ul className='max-h-80 space-y-2.5 overflow-y-auto'>
                  {activity.map((entry) => {
                    const subject = entry.metadata?.doctorName || entry.metadata?.patientName || entry.metadata?.userName || entry.metadata?.clinicName
                    return (
                      <li key={entry._id} className='flex items-start gap-2.5'>
                        <span aria-hidden='true' className={`mt-1.5 size-2 shrink-0 rounded-full ${entry.status === 'failed' ? 'bg-danger' : 'bg-primary'}`} />
                        <span className='min-w-0'>
                          <span className='block text-body-sm text-ink'>{actionLabels(t)[entry.action] || entry.action}{subject ? `: ${subject}` : ''}</span>
                          <span className='block text-caption text-ink-3'>{when(entry.createdAt)}{entry.status === 'failed' ? ` · ${t('Failed')}` : ''}</span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <p className='flex items-center justify-center gap-1.5 pb-2 text-caption text-ink-3'>
          <CalendarDays aria-hidden='true' className='size-3.5' />
          {t('Every figure here is worked out from your records. Refunded visits are not counted as revenue.')}
        </p>
      </div>
    </div>
  )
}

export default Dashboard
