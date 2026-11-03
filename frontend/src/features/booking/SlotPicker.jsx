import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, Sparkles, Zap } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { Button, EmptyState, Skeleton, SkeletonGroup, cx } from '../../components/ui'
import { availabilityLevel, fill, formatDayLong, formatRelativeDay, formatSlotTime, groupSlotsByPart, localTimeIfAbroad } from './bookingFormat'

const LEVEL_STYLES = {
  open: 'bg-success',
  few: 'bg-warning',
  full: 'bg-danger',
  closed: 'bg-transparent'
}

const PART_LABELS = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }

const DayChip = ({ day, selected, onSelect, language, localizeDigits, t }) => {
  const level = availabilityLevel(day)
  const closed = level === 'closed'
  const anchorTime = day.slots[0]?.startsAt ?? Date.parse(`${day.dateKey}T12:00:00Z`)
  const parts = new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
    .formatToParts(new Date(Date.parse(`${day.dateKey}T12:00:00Z`)))
  const weekday = parts.find((part) => part.type === 'weekday')?.value
  const dayNumber = parts.find((part) => part.type === 'day')?.value
  const countLabel = closed
    ? t('Closed')
    : level === 'full'
      ? t('Full')
      : localizeDigits(fill(t('{{count}} open'), { count: day.availableCount }))

  return (
    <button
      type='button'
      disabled={closed}
      aria-pressed={selected}
      aria-label={`${formatDayLong(anchorTime, language)}: ${countLabel}`}
      data-day={day.slotDate}
      onClick={() => onSelect(day.slotDate)}
      className={cx(
        'flex w-[4.6rem] shrink-0 flex-col items-center gap-0.5 rounded-control border px-1 py-2.5 transition-colors duration-(--duration-fast)',
        closed && 'cursor-not-allowed border-transparent bg-surface-sunken text-ink-3 opacity-60',
        !closed && !selected && 'border-line bg-surface text-ink hover:border-primary',
        selected && 'border-primary bg-primary text-on-primary shadow-brand'
      )}
    >
      <span className='text-caption'>{weekday}</span>
      <span className='text-title font-semibold leading-none'>{dayNumber}</span>
      <span className='mt-0.5 flex items-center gap-1 text-[0.6875rem] leading-tight'>
        {!closed && !selected && <span aria-hidden='true' className={cx('h-1.5 w-1.5 rounded-full', LEVEL_STYLES[level])} />}
        {countLabel}
      </span>
    </button>
  )
}

const TimeButton = ({ slot, selected, reservedForMe, onSelect, language, localizeDigits, t }) => {
  const taken = !slot.available
  return (
    <button
      type='button'
      disabled={taken}
      aria-pressed={selected}
      title={taken ? t('Taken') : undefined}
      onClick={() => onSelect(slot)}
      className={cx(
        'relative rounded-control border px-2 py-2.5 text-body-sm font-semibold transition-colors duration-(--duration-fast)',
        taken && 'cursor-not-allowed border-transparent bg-surface-sunken text-ink-3 line-through',
        !taken && !selected && 'border-field bg-surface text-ink hover:border-primary hover:bg-primary-soft',
        selected && 'border-primary bg-primary text-on-primary',
        reservedForMe && !selected && 'border-accent bg-accent-soft text-accent-ink'
      )}
    >
      {formatSlotTime(slot.time, language, localizeDigits)}
    </button>
  )
}

/**
 * The calendar and times, driven by the server's availability. Used for booking and rescheduling.
 * `reservedSlot` is a waitlist offer: open for this patient even though the server shows it taken.
 */
const SlotPicker = ({
  availability,
  loading,
  failed,
  onRetry,
  selection,
  onSelect,
  reservedSlot = null,
  onJoinWaitlist,
  waitlistEntry = null,
  joiningWaitlist = false,
  headingId
}) => {
  const { t, language, localizeDigits } = useLanguage()
  const [pickedDate, setPickedDate] = useState('')
  const railRef = useRef(null)

  const days = useMemo(() => {
    const rows = availability?.days || []
    if (!reservedSlot) return rows
    return rows.map((day) => {
      if (day.slotDate !== reservedSlot.slotDate) return day
      const slots = day.slots.map((slot) => (slot.time === reservedSlot.slotTime ? { ...slot, available: true, status: 'available' } : slot))
      return { ...day, slots, availableCount: slots.filter((slot) => slot.available).length }
    })
  }, [availability, reservedSlot])

  const nextAvailable = reservedSlot
    ? { ...reservedSlot, startsAt: days.find((day) => day.slotDate === reservedSlot.slotDate)?.slots.find((slot) => slot.time === reservedSlot.slotTime)?.startsAt }
    : availability?.nextAvailable

  const pickedDayIsOpen = days.some((day) => day.slotDate === pickedDate && availabilityLevel(day) !== 'closed')
  const activeDate = (pickedDayIsOpen && pickedDate)
    || selection?.slotDate
    || nextAvailable?.slotDate
    || days.find((day) => availabilityLevel(day) !== 'closed')?.slotDate
    || ''

  const chooseSlot = (slot) => {
    setPickedDate(slot.slotDate)
    onSelect(slot)
  }

  useEffect(() => {
    const chip = railRef.current?.querySelector(`[data-day="${activeDate}"]`)
    chip?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [activeDate])

  const activeDay = days.find((day) => day.slotDate === activeDate)
  const groups = useMemo(() => groupSlotsByPart(activeDay?.slots.filter((slot) => slot.status !== 'past') || []), [activeDay])
  const totalOpen = days.reduce((sum, day) => sum + day.availableCount, 0)
  const abroadTime = selection?.startsAt ? localTimeIfAbroad(selection.startsAt, language, availability?.timeZone) : null

  if (loading && !availability) {
    return (
      <SkeletonGroup label={t('Loading available times')}>
        <div className='flex gap-2 overflow-hidden'>
          {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className='h-20 w-[4.6rem] shrink-0 rounded-control' />)}
        </div>
        <div className='mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4'>
          {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className='h-11 rounded-control' />)}
        </div>
      </SkeletonGroup>
    )
  }

  if (failed && !availability) {
    return (
      <EmptyState
        icon={<CalendarClock aria-hidden='true' />}
        title={t('Could not load available times')}
        description={t('Check your connection and try again.')}
        action={<Button variant='secondary' onClick={onRetry}>{t('Try again')}</Button>}
      />
    )
  }

  if (availability?.needsBranchChoice) {
    return <p className='rounded-control bg-surface-sunken p-4 text-body-sm text-ink-2'>{t('Choose a branch above to see its times.')}</p>
  }

  return (
    <div className='min-w-0'>
      {nextAvailable?.startsAt && totalOpen > 0 && (
        <button
          type='button'
          onClick={() => chooseSlot({ slotDate: nextAvailable.slotDate, slotTime: nextAvailable.slotTime, startsAt: nextAvailable.startsAt })}
          className='mb-4 flex w-full items-center gap-3 rounded-control border border-primary bg-primary-soft p-3 text-start transition-colors duration-(--duration-fast) hover:bg-primary hover:text-on-primary group'
        >
          <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary group-hover:bg-surface group-hover:text-brand'>
            {reservedSlot ? <Sparkles className='h-4 w-4' aria-hidden='true' /> : <Zap className='h-4 w-4' aria-hidden='true' />}
          </span>
          <span className='min-w-0 flex-1'>
            <span className='block text-caption text-brand group-hover:text-on-primary'>{reservedSlot ? t('Reserved for you') : t('Soonest open time')}</span>
            <span className='block text-body-sm font-semibold'>
              {formatRelativeDay(nextAvailable.startsAt, language, undefined, availability?.timeZone)} · {formatSlotTime(nextAvailable.slotTime, language, localizeDigits)}
            </span>
          </span>
          <span className='shrink-0 text-body-sm font-semibold'>{t('Take it')}</span>
        </button>
      )}

      <div ref={railRef} role='group' aria-labelledby={headingId} className='-mx-1 flex gap-2 overflow-x-auto px-1 pb-2'>
        {days.map((day) => (
          <DayChip
            key={day.slotDate}
            day={day}
            selected={day.slotDate === activeDate}
            onSelect={setPickedDate}
            language={language}
            localizeDigits={localizeDigits}
            t={t}
          />
        ))}
      </div>

      {totalOpen === 0 && !activeDay?.slots.length && (
        <div className='mt-3'>
          <EmptyState
            icon={<CalendarClock aria-hidden='true' />}
            title={t('No open times right now')}
            description={t('Join the waitlist and we will hold the next opening for you.')}
          />
        </div>
      )}

      {activeDay && groups.length > 0 && (
        <div className='mt-4 space-y-4' aria-live='polite'>
          {groups.map((group) => (
            <div key={group.part}>
              <p className='mb-2 text-caption font-semibold text-ink-3'>{t(PART_LABELS[group.part])}</p>
              <div className='grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5'>
                {group.slots.map((slot) => (
                  <TimeButton
                    key={slot.time}
                    slot={slot}
                    selected={selection?.slotDate === activeDay.slotDate && selection?.slotTime === slot.time}
                    reservedForMe={reservedSlot?.slotDate === activeDay.slotDate && reservedSlot?.slotTime === slot.time}
                    onSelect={(picked) => chooseSlot({ slotDate: activeDay.slotDate, slotTime: picked.time, startsAt: picked.startsAt })}
                    language={language}
                    localizeDigits={localizeDigits}
                    t={t}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {onJoinWaitlist && activeDay && availabilityLevel(activeDay) === 'full' && (
        <div className='mt-4 rounded-control border border-line bg-surface-sunken p-4'>
          {waitlistEntry ? (
            <p className='text-body-sm text-ink-2'>
              {localizeDigits(fill(t('You are number {{position}} on the waitlist for this doctor. We will reserve the next opening for you.'), { position: waitlistEntry.position || 1 }))}
            </p>
          ) : (
            <>
              <p className='text-body-sm font-semibold text-ink'>{t('This day is full')}</p>
              <p className='mt-1 text-caption text-ink-2'>{t('Join the waitlist. If a time opens up, it is reserved for you for 15 minutes.')}</p>
              <div className='mt-3 flex flex-wrap gap-2'>
                <Button size='sm' loading={joiningWaitlist} onClick={() => onJoinWaitlist(activeDay.slotDate, 0)}>{t('Wait for this day')}</Button>
                <Button size='sm' variant='secondary' disabled={joiningWaitlist} onClick={() => onJoinWaitlist(activeDay.slotDate, 6)}>{t('Any day this week')}</Button>
              </div>
            </>
          )}
        </div>
      )}

      {onJoinWaitlist && totalOpen === 0 && !activeDay?.slots.length && !waitlistEntry && (
        <div className='mt-3 flex justify-center'>
          <Button size='sm' loading={joiningWaitlist} onClick={() => onJoinWaitlist(days[0]?.slotDate, 13)}>{t('Join the waitlist')}</Button>
        </div>
      )}

      <p className='mt-4 text-caption text-ink-3'>
        {t('Times are in Cairo time.')}
        {abroadTime && <> {fill(t('That is {{time}} where you are.'), { time: abroadTime })}</>}
      </p>
    </div>
  )
}

export default SlotPicker
