import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, Check, CheckCircle2, Phone, Siren, Sparkles } from 'lucide-react'
import { Button } from '../ui'
import { fillTemplate } from './assistantFormat'

const STAGES = ['assistant.stage.need', 'assistant.stage.doctor', 'assistant.stage.time', 'assistant.stage.confirm']

/** The four stages of a booking. The conversation fills it in as it goes. */
export const JourneyRibbon = ({ stage, t }) => (
  <ol aria-label={t('assistant.journeyLabel')} className='flex shrink-0 items-center gap-1 border-b border-line bg-surface px-4 py-2'>
    {STAGES.map((key, index) => {
      const done = stage > index
      const current = stage === index
      return (
        <li
          key={key}
          aria-current={current ? 'step' : undefined}
          className={`flex min-w-0 flex-1 flex-col gap-1 text-caption transition-colors duration-(--duration-slow) ${
            current ? 'font-semibold text-brand' : done ? 'text-ink-2' : 'text-ink-3'
          }`}
        >
          <span className='h-1 overflow-hidden rounded-full bg-surface-sunken'>
            <span
              className={`block h-full origin-left rounded-full bg-primary transition-transform duration-(--duration-slow) ease-standard rtl:origin-right ${
                done ? 'scale-x-100' : current ? 'scale-x-50' : 'scale-x-0'
              }`}
            />
          </span>
          <span className='truncate'>{t(key)}</span>
        </li>
      )
    })}
  </ol>
)

const THINKING_PHASES = ['assistant.thinking.read', 'assistant.thinking.match', 'assistant.thinking.slots']

/** Says what is happening rather than only blinking dots. */
export const ThinkingBubble = ({ t }) => {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setPhase((p) => Math.min(p + 1, THINKING_PHASES.length - 1)), 900)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className='flex animate-rise justify-start' role='status'>
      <div className='flex items-center gap-2 rounded-card rounded-es-control border border-line bg-surface px-3 py-2 text-body-sm text-ink-2 shadow-e1'>
        <span className='flex gap-1' aria-hidden='true'>
          {[0, 150, 300].map((delay) => (
            <span key={delay} style={{ animationDelay: `${delay}ms` }} className='size-1.5 animate-bounce rounded-full bg-primary' />
          ))}
        </span>
        <span>{t(THINKING_PHASES[phase])}</span>
      </div>
    </div>
  )
}

const REVEAL_STEP_MS = 28

/** Words arrive one at a time, as if being written. Screen readers get the whole sentence at once. */
export const RevealText = ({ text, animate, onProgress }) => {
  const words = useMemo(() => String(text).split(/(\s+)/), [text])
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [shown, setShown] = useState(animate && !reducedMotion ? 0 : words.length)

  useEffect(() => {
    if (shown >= words.length) return undefined
    const timer = setTimeout(() => {
      setShown((count) => count + 2)
      onProgress?.()
    }, REVEAL_STEP_MS)
    return () => clearTimeout(timer)
  }, [shown, words.length, onProgress])

  if (shown >= words.length) return text

  return (
    <>
      <span className='sr-only'>{text}</span>
      <span aria-hidden='true'>{words.slice(0, shown).join('')}</span>
    </>
  )
}

/** Shows the person what was taken from their sentence, so a misunderstanding is visible at once. */
export const UnderstoodChips = ({ chips, t }) => {
  if (!chips?.length) return null
  return (
    <div className='flex flex-wrap items-center gap-1.5 ps-1 pt-1'>
      <span className='inline-flex items-center gap-1 text-caption text-ink-3'>
        <Sparkles aria-hidden='true' className='size-3 text-brand' />
        {t('assistant.understoodLabel')}
      </span>
      {chips.map((chip, index) => (
        <span
          key={chip}
          style={{ animationDelay: `${index * 70}ms` }}
          className='assistant-chip rounded-full bg-primary-soft px-2 py-0.5 text-caption font-semibold text-brand'
        >
          {chip}
        </span>
      ))}
    </div>
  )
}

/** Comes before anything else on the screen, and nothing bookable shows until it is dismissed. */
export const EmergencyCard = ({ info, text, t, onContinue, canContinue }) => {
  const isCrisis = info?.category === 'suicide'
  const callNumber = info?.callNumber || '123'
  return (
    <section
      role='alert'
      className='assistant-emergency rounded-card border-2 border-danger bg-danger-soft p-4 text-danger-ink shadow-e2'
    >
      <h3 className='flex items-center gap-2 text-subtitle font-bold'>
        <Siren aria-hidden='true' className='size-5 shrink-0' />
        {t(isCrisis ? 'assistant.emergency.titleCrisis' : 'assistant.emergency.title')}
      </h3>
      <p className='mt-2 whitespace-pre-wrap text-body-sm'>{text}</p>
      <div className='mt-3 flex flex-col gap-2'>
        <Button as='a' href={`tel:${callNumber}`} variant='danger' size='lg' fullWidth leadingIcon={<Phone className='size-5' />}>
          <span dir='auto'>{fillTemplate(t('assistant.emergency.call'), { number: callNumber })}</span>
        </Button>
        {info?.crisisNumber && (
          <Button as='a' href={`tel:${info.crisisNumber}`} variant='secondary' fullWidth leadingIcon={<Phone className='size-4' />}>
            <span dir='auto'>{fillTemplate(t('assistant.emergency.crisis'), { number: info.crisisNumber })}</span>
          </Button>
        )}
        {canContinue && (
          <button
            type='button'
            onClick={onContinue}
            className='mt-1 min-h-9 cursor-pointer rounded-control text-caption font-medium text-danger-ink underline underline-offset-2'
          >
            {t('assistant.emergency.continue')}
          </button>
        )}
      </div>
    </section>
  )
}

const TicketRow = ({ label, value }) =>
  value ? (
    <div className='flex items-baseline justify-between gap-4 py-1'>
      <dt className='shrink-0 text-caption text-ink-3'>{label}</dt>
      <dd className='min-w-0 text-end text-body-sm font-medium text-ink'>{value}</dd>
    </div>
  ) : null

/**
 * The booking as a ticket: a summary awaiting confirmation, then the confirmed stub.
 * The total comes from the same pricing rules as the rest of the site, and the server recomputes it.
 */
export const AppointmentTicket = ({ rows, total, reservationNumber, confirmed, children, t }) => (
  <article className='assistant-chip overflow-hidden rounded-card rounded-se-signature border border-line-strong bg-surface shadow-e2'>
    <header className='flex items-center gap-2 px-4 pt-4'>
      {confirmed ? (
        <span className='flex size-8 shrink-0 items-center justify-center rounded-full bg-success text-on-status'>
          <svg viewBox='0 0 24 24' className='assistant-check size-5' fill='none' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
            <path d='M5 13l4 4L19 7' />
          </svg>
        </span>
      ) : (
        <CheckCircle2 aria-hidden='true' className='size-5 shrink-0 text-brand' />
      )}
      <h3 className='font-display text-title text-ink'>{t(confirmed ? 'assistant.successTitle' : 'assistant.ticket.title')}</h3>
    </header>
    <dl className='px-4 pb-3 pt-2'>
      {rows.map((row) => (
        <TicketRow key={row.label} label={row.label} value={row.value} />
      ))}
    </dl>
    <div className='assistant-ticket-tear flex items-end justify-between gap-4 px-4 pb-4 pt-3'>
      {reservationNumber ? (
        <div>
          <p className='text-caption text-ink-3'>{t('assistant.ticket.reservation')}</p>
          <p className='font-display text-title-lg text-brand'>{reservationNumber}</p>
        </div>
      ) : (
        <p className='text-caption text-ink-3'>{t('assistant.ticket.payment')}</p>
      )}
      <div className='text-end'>
        <p className='text-caption text-ink-3'>{t('assistant.ticket.total')}</p>
        <p className='text-subtitle font-bold text-ink'>{total}</p>
      </div>
    </div>
    {children && <div className='flex flex-col gap-2 px-4 pb-4'>{children}</div>}
  </article>
)

export const SuccessActions = ({ onCalendar, onNewBooking, onLeave, t }) => (
  <>
    <Button variant='primary' fullWidth leadingIcon={<CalendarPlus className='size-4' />} onClick={onCalendar}>
      {t('assistant.addCalendar')}
    </Button>
    <div className='grid grid-cols-2 gap-2'>
      <Button as={Link} to='/my-appointments' onClick={onLeave} variant='secondary' size='sm' leadingIcon={<Check className='size-4' />}>
        {t('assistant.viewAppointments')}
      </Button>
      <Button variant='ghost' size='sm' onClick={onNewBooking}>
        {t('assistant.newBooking')}
      </Button>
    </div>
  </>
)
