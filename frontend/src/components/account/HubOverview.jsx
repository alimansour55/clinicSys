import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, CalendarPlus, CheckCircle2, ClipboardList, CreditCard, Activity, MapPin, Stethoscope } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, notify } from '../ui'
import { useAccountApi, useServerText } from './accountApi'
import { buildAttention, dueReminders, formatIsoDate, laterToday, nextUpcomingVisit, vitalSeries } from './hubLogic'
import { TrendLine } from './TrendLine'

const TONES = { accent: 'accent', danger: 'danger', warning: 'warning', neutral: 'neutral' }

const VITAL_TILES = [
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'systolic', label: 'Blood pressure', unit: 'mmHg', pair: 'diastolic' },
  { key: 'glucose', label: 'Blood sugar', unit: 'mg/dL' },
  { key: 'heartRate', label: 'Heart rate', unit: 'bpm' }
]

const NextVisitCard = ({ visit }) => {
  const { t, language, localizeDigits } = useLanguage()
  if (!visit) {
    return (
      <Card variant='signature' className='flex flex-col justify-between'>
        <CardBody className='p-6'>
          <p className='text-caption font-semibold text-ink-3'>{t('Your next visit')}</p>
          <p className='mt-2 font-display text-title-lg text-ink'>{t('Nothing booked right now')}</p>
          <p className='mt-1 text-body-sm text-ink-2'>{t('When you feel it is time, your doctors are a few taps away.')}</p>
          <Button as={Link} to='/doctors' className='mt-5' leadingIcon={<CalendarPlus className='size-4' />}>{t('Find a doctor')}</Button>
        </CardBody>
      </Card>
    )
  }
  return (
    <Card variant='signature'>
      <CardBody className='p-6'>
        <p className='text-caption font-semibold text-ink-3'>{t('Your next visit')}</p>
        <p className='mt-2 font-display text-title-lg text-ink'>{formatIsoDate(visit.date, language, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <p className='mt-1 text-body text-ink-2'>{localizeDigits(visit.time || '')}</p>
        <div className='mt-4 space-y-1.5 text-body-sm text-ink-2'>
          <p className='flex items-center gap-2'><Stethoscope className='size-4 shrink-0 text-brand' aria-hidden='true' /> {visit.doctorName}{visit.speciality ? ` · ${t(visit.speciality)}` : ''}</p>
          {visit.location && <p className='flex items-center gap-2'><MapPin className='size-4 shrink-0 text-brand' aria-hidden='true' /> {visit.location}</p>}
        </div>
        <Button as={Link} to='/my-appointments' variant='secondary' size='sm' className='mt-5'>{t('Manage this visit')}</Button>
      </CardBody>
    </Card>
  )
}

const TodayReminders = ({ reminders, onChanged, onOpenTab }) => {
  const { t, language, localizeDigits } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const [busy, setBusy] = useState('')
  const due = dueReminders(reminders)
  const later = laterToday(reminders)

  const respond = async (reminder, action) => {
    setBusy(reminder._id)
    const data = await api('post', `/api/account/reminders/${reminder._id}/respond`, { action })
    setBusy('')
    if (!data.success) return notify.error(say(data.message))
    notify.success(action === 'taken' ? t('Well done. Marked as taken.') : t('Skipped for now.'))
    onChanged()
  }

  const timeOf = (ms) => localizeDigits(new Date(ms).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' }))

  return (
    <Card>
      <CardHeader title={t('Today')} action={<Button variant='ghost' size='sm' onClick={() => onOpenTab('reminders')}>{t('All reminders')}</Button>} />
      <CardBody>
        {!due.length && !later.length ? (
          <EmptyState icon={<BellRing className='size-6' />} title={t('Nothing to remember today')} description={t('Add your medicines and we will keep track with you.')} action={<Button variant='secondary' size='sm' onClick={() => onOpenTab('reminders')}>{t('Add a reminder')}</Button>} headingLevel={3} />
        ) : (
          <ul className='space-y-2'>
            {due.map((reminder) => (
              <li key={reminder._id} className='rounded-control bg-accent-soft p-3 text-accent-ink'>
                <p dir='auto' className='text-body-sm font-semibold'>{reminder.title}</p>
                <p className='text-caption'>{t('Due at')} {timeOf(reminder.nextDueAt)}</p>
                <div className='mt-2 flex flex-wrap gap-2'>
                  <Button size='sm' loading={busy === reminder._id} onClick={() => respond(reminder, 'taken')}>{t('Taken')}</Button>
                  <Button size='sm' variant='ghost' disabled={busy === reminder._id} onClick={() => respond(reminder, 'skipped')}>{t('Skip')}</Button>
                </div>
              </li>
            ))}
            {later.map((reminder) => (
              <li key={reminder._id} className='flex items-center justify-between gap-3 rounded-control bg-surface-sunken px-3 py-2.5'>
                <span dir='auto' className='min-w-0 truncate text-body-sm text-ink'>{reminder.title}</span>
                <span className='shrink-0 text-caption text-ink-3'>{timeOf(reminder.nextDueAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

const Attention = ({ items, onOpenTab }) => {
  const { t } = useLanguage()
  if (!items.length) {
    return (
      <Card variant='flat'>
        <CardBody className='flex items-center gap-3'>
          <CheckCircle2 className='size-6 shrink-0 text-success-ink' aria-hidden='true' />
          <p className='text-body-sm text-ink-2'>{t('You are all caught up. Nothing needs you right now.')}</p>
        </CardBody>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader title={t('Worth a moment')} />
      <CardBody>
        <ul className='divide-y divide-line'>
          {items.slice(0, 5).map((item) => {
            const inner = (
              <>
                <span className='min-w-0 flex-1'>
                  <span className='flex flex-wrap items-center gap-2 text-body-sm font-semibold text-ink'>
                    {t(item.title)}
                    {item.tone === 'danger' && <Badge tone={TONES.danger}>{t('Important')}</Badge>}
                  </span>
                  <span className='mt-0.5 block text-caption text-ink-2'>{t(item.description)}</span>
                </span>
                <span className='flex shrink-0 items-center gap-1 text-body-sm font-medium text-brand'>
                  {t(item.action)}
                  <ArrowRight className='size-4 rtl:-scale-x-100' aria-hidden='true' />
                </span>
              </>
            )
            const row = 'flex min-h-11 w-full flex-col items-start gap-1 py-3 text-start sm:flex-row sm:items-center sm:justify-between sm:gap-4'
            return (
              <li key={item.key}>
                {item.to
                  ? <Link to={item.to} className={row}>{inner}</Link>
                  : <button type='button' onClick={() => onOpenTab(item.tab)} className={row}>{inner}</button>}
              </li>
            )
          })}
        </ul>
      </CardBody>
    </Card>
  )
}

const VitalTiles = ({ entries, onOpenTab }) => {
  const { t, localizeDigits } = useLanguage()
  const tiles = VITAL_TILES.map((tile) => ({ ...tile, series: vitalSeries(entries, tile.key) })).filter((tile) => tile.series.points.length)
  if (!tiles.length) {
    return (
      <Card variant='flat'>
        <CardBody className='flex flex-wrap items-center justify-between gap-3'>
          <span className='flex items-center gap-3'>
            <Activity className='size-5 text-brand' aria-hidden='true' />
            <span className='text-body-sm text-ink-2'>{t('Record your weight, blood pressure or sugar and watch the trend here.')}</span>
          </span>
          <Button size='sm' variant='secondary' onClick={() => onOpenTab('timeline')}>{t('Add a reading')}</Button>
        </CardBody>
      </Card>
    )
  }
  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
      {tiles.map((tile) => {
        const pair = tile.pair ? vitalSeries(entries, tile.pair).latest : null
        const value = pair !== null && tile.pair ? `${tile.series.latest}/${pair}` : tile.series.latest
        return (
          <Card key={tile.key} variant='flat'>
            <CardBody>
              <p className='text-caption text-ink-2'>{t(tile.label)}</p>
              <p className='mt-1 text-title-lg font-semibold text-ink tabular-nums'>
                {localizeDigits(String(value))} <span className='text-caption font-normal text-ink-3'>{t(tile.unit)}</span>
              </p>
              <TrendLine points={tile.series.points} label={t(tile.label)} unit={t(tile.unit)} />
            </CardBody>
          </Card>
        )
      })}
    </div>
  )
}

const HubOverview = ({ userData, hub, reload, onOpenTab, onOpenGuide }) => {
  const { t } = useLanguage()
  const attention = useMemo(() => buildAttention({ userData, hub }), [userData, hub])
  const nextVisit = useMemo(() => nextUpcomingVisit(hub.events), [hub.events])
  const unfinishedGuide = !hub.onboarding?.completedAt

  return (
    <div className='space-y-5'>
      {unfinishedGuide && (
        <Card variant='flat'>
          <CardBody className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <p className='text-body-sm font-semibold text-ink'>{t('Finish setting up your health space')}</p>
              <p className='text-caption text-ink-2'>{t('Four short steps. Every one can wait.')}</p>
            </div>
            <Button size='sm' onClick={onOpenGuide}>{t('Continue setup')}</Button>
          </CardBody>
        </Card>
      )}

      <div className='grid grid-cols-1 gap-5 lg:grid-cols-2'>
        <NextVisitCard visit={nextVisit} />
        <TodayReminders reminders={hub.reminders} onChanged={reload} onOpenTab={onOpenTab} />
      </div>

      <Attention items={attention} onOpenTab={onOpenTab} />
      <VitalTiles entries={hub.vitals} onOpenTab={onOpenTab} />

      <nav aria-label={t('Your records')} className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <Link to='/medical-history' className='flex min-h-11 items-center gap-3 rounded-card border border-line bg-surface p-4 transition hover:border-primary'>
          <ClipboardList className='size-5 text-brand' aria-hidden='true' />
          <span className='text-body-sm font-semibold text-ink'>{t('Medical history')}</span>
        </Link>
        <Link to='/insurance' className='flex min-h-11 items-center gap-3 rounded-card border border-line bg-surface p-4 transition hover:border-primary'>
          <CreditCard className='size-5 text-brand' aria-hidden='true' />
          <span className='text-body-sm font-semibold text-ink'>{t('Insurance')}</span>
        </Link>
      </nav>
    </div>
  )
}

export default HubOverview
