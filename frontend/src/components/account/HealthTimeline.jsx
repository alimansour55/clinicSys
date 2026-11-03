import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, BellPlus, CalendarCheck2, ChevronDown, ClipboardList, CreditCard, Pill, Plus, Stethoscope, Syringe, Thermometer, Trash2, TestTube2, NotebookPen } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { Badge, Button, EmptyState, Field, IconButton, Input, Modal, Select, Skeleton, SkeletonGroup, Textarea, notify } from '../ui'
import { useAccountApi, useServerText } from './accountUi'
import { formatIsoDate, reminderFromMedication, todayIso } from './hubLogic'
import ReminderModal from './ReminderModal'

const ENTRY_TYPES = [
  { value: 'vitals', label: 'A reading', icon: Activity },
  { value: 'symptom', label: 'A symptom', icon: Thermometer },
  { value: 'vaccine', label: 'A vaccine', icon: Syringe },
  { value: 'lab', label: 'A lab result', icon: TestTube2 },
  { value: 'note', label: 'A note', icon: NotebookPen }
]

const VITAL_FIELDS = [
  { key: 'systolic', label: 'Systolic pressure', unit: 'mmHg' },
  { key: 'diastolic', label: 'Diastolic pressure', unit: 'mmHg' },
  { key: 'glucose', label: 'Blood sugar', unit: 'mg/dL' },
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'heartRate', label: 'Heart rate', unit: 'bpm' },
  { key: 'temperature', label: 'Temperature', unit: '°C' }
]

const FILTERS = [
  { value: 'all', label: 'Everything' },
  { value: 'visit', label: 'Visits' },
  { value: 'prescription', label: 'Prescriptions' },
  { value: 'vitals', label: 'Readings' },
  { value: 'journal', label: 'Notes' }
]

const matchesFilter = (event, filter) => {
  if (filter === 'all') return true
  if (filter === 'visit') return event.type === 'visit'
  if (filter === 'prescription') return Boolean(event.prescription)
  if (filter === 'vitals') return event.type === 'vitals'
  if (filter === 'journal') return ['symptom', 'vaccine', 'lab', 'note'].includes(event.type)
  return true
}

const iconFor = (event) => {
  if (event.type === 'visit') return event.status === 'finished' ? CalendarCheck2 : Stethoscope
  if (event.type === 'history') return ClipboardList
  if (event.type === 'insurance') return CreditCard
  return ENTRY_TYPES.find((type) => type.value === event.type)?.icon || NotebookPen
}

const EntryModal = ({ open, onClose, onSaved, memberId }) => {
  const { t } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const [type, setType] = useState('vitals')
  const [date, setDate] = useState(todayIso())
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [vitals, setVitals] = useState({})
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const data = await api('post', '/api/account/entries', { type, date, title, note, vitals, memberId })
    setSaving(false)
    if (!data.success) return notify.error(say(data.message))
    notify.success(say(data.message))
    setTitle('')
    setNote('')
    setVitals({})
    onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Add to your timeline')}
      description={t('Only you can see what you write here, unless you share it with your doctor.')}
      footer={<Button loading={saving} onClick={save}>{t('Save')}</Button>}
    >
      <div className='space-y-4'>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <Field label={t('What is it?')}>
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              {ENTRY_TYPES.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
            </Select>
          </Field>
          <Field label={t('Date')}>
            <Input type='date' max={todayIso()} value={date} onChange={(event) => setDate(event.target.value)} className='date-field-input' />
          </Field>
        </div>
        {type === 'vitals' ? (
          <div className='grid grid-cols-2 gap-3'>
            {VITAL_FIELDS.map((field) => (
              <Field key={field.key} label={`${t(field.label)} (${t(field.unit)})`}>
                <Input dir='ltr' type='number' inputMode='decimal' step='any' value={vitals[field.key] ?? ''} onChange={(event) => setVitals((current) => ({ ...current, [field.key]: event.target.value }))} />
              </Field>
            ))}
          </div>
        ) : (
          <Field label={t('Title')}>
            <Input data-autofocus dir='auto' maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
        )}
        <Field label={t('Note')}>
          <Textarea dir='auto' rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

const VISIT_STATUS = {
  finished: { tone: 'success', label: 'Completed' },
  upcoming: { tone: 'brand', label: 'Upcoming' },
  cancelled: { tone: 'neutral', label: 'Cancelled' }
}

const Prescription = ({ prescription, onRemind }) => {
  const { t, localizeDigits } = useLanguage()
  const items = prescription.medicationItems || []
  return (
    <div className='mt-3 space-y-3 rounded-control bg-surface-sunken p-3 text-body-sm text-ink-2'>
      {prescription.diagnosis && <p><span className='font-semibold text-ink'>{t('Diagnosis')}: </span><span dir='auto'>{prescription.diagnosis}</span></p>}
      {items.length > 0 && (
        <ul className='space-y-2'>
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`} className='flex flex-wrap items-center justify-between gap-2 rounded-control bg-surface p-2.5'>
              <span className='min-w-0'>
                <span dir='auto' className='flex items-center gap-1.5 font-semibold text-ink'><Pill className='size-4 shrink-0 text-brand' aria-hidden='true' /> {item.name} {localizeDigits(item.dosage || '')}</span>
                <span dir='auto' className='block text-caption'>{[item.frequency, item.duration].filter(Boolean).map(localizeDigits).join(' · ')}</span>
              </span>
              <Button size='sm' variant='secondary' leadingIcon={<BellPlus className='size-4' />} onClick={() => onRemind(item)}>{t('Remind me')}</Button>
            </li>
          ))}
        </ul>
      )}
      {!items.length && prescription.medicines && <p dir='auto' className='whitespace-pre-line'>{prescription.medicines}</p>}
      {prescription.instructions && <p><span className='font-semibold text-ink'>{t('Instructions')}: </span><span dir='auto'>{prescription.instructions}</span></p>}
      {prescription.labTests && <p><span className='font-semibold text-ink'>{t('Lab tests')}: </span><span dir='auto'>{prescription.labTests}</span></p>}
      {prescription.nextVisit && <p><span className='font-semibold text-ink'>{t('Next visit')}: </span><span dir='auto'>{localizeDigits(prescription.nextVisit)}</span></p>}
    </div>
  )
}

const EventBody = ({ event, onRemind, onDelete }) => {
  const { t, language, localizeDigits } = useLanguage()
  const [open, setOpen] = useState(false)

  if (event.type === 'visit') {
    const status = VISIT_STATUS[event.status] || VISIT_STATUS.upcoming
    return (
      <>
        <div className='flex flex-wrap items-center gap-2'>
          <p className='text-body-sm font-semibold text-ink'>{event.doctorName ? `${t('Visit with')} ${event.doctorName}` : t('Visit')}</p>
          <Badge tone={status.tone}>{t(status.label)}</Badge>
        </div>
        <p className='text-caption text-ink-2'>{[event.speciality && t(event.speciality), event.location, localizeDigits(event.time || '')].filter(Boolean).join(' · ')}</p>
        {event.prescription && (
          <>
            <button type='button' onClick={() => setOpen((value) => !value)} aria-expanded={open} className='mt-1 inline-flex min-h-9 items-center gap-1 text-body-sm font-medium text-brand'>
              {open ? t('Hide prescription') : t('Show prescription')}
              <ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden='true' />
            </button>
            {open && <Prescription prescription={event.prescription} onRemind={onRemind} />}
          </>
        )}
      </>
    )
  }

  if (event.type === 'history') {
    return <p className='text-body-sm text-ink-2'>{event.updatedBy === 'patient' ? t('You updated your medical history') : t('Your doctor updated your medical history')}</p>
  }
  if (event.type === 'insurance') {
    return <p className='text-body-sm text-ink-2'>{t('Your insurance details were updated')}</p>
  }

  const readings = event.type === 'vitals'
    ? VITAL_FIELDS.filter((field) => Number.isFinite(event.vitals?.[field.key])).map((field) => `${t(field.label)}: ${localizeDigits(String(event.vitals[field.key]))} ${t(field.unit)}`)
    : []
  const typeLabel = ENTRY_TYPES.find((type) => type.value === event.type)?.label

  return (
    <div className='flex items-start justify-between gap-2'>
      <div className='min-w-0'>
        <p dir='auto' className='text-body-sm font-semibold text-ink'>{event.title || t(typeLabel)}</p>
        {readings.length > 0 && <p className='text-body-sm text-ink-2'>{readings.join(' · ')}</p>}
        {event.note && <p dir='auto' className='mt-0.5 text-body-sm whitespace-pre-line text-ink-2'>{event.note}</p>}
      </div>
      <IconButton label={`${t('Remove')}: ${formatIsoDate(event.date, language)}`} variant='ghost' size='sm' onClick={() => onDelete(event)}>
        <Trash2 className='size-4' />
      </IconButton>
    </div>
  )
}

/** A patient's whole health story in one place, newest first, grouped by month. */
const HealthTimeline = ({ members = [], onChanged }) => {
  const { t, language } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const [memberId, setMemberId] = useState('')
  const [events, setEvents] = useState(null)
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)
  const [reminderDraft, setReminderDraft] = useState(null)

  const load = useCallback(async () => {
    setEvents(null)
    const data = await api('get', `/api/account/timeline${memberId ? `?memberId=${memberId}` : ''}`)
    setEvents(data.success ? data.events : [])
  }, [api, memberId])

  useEffect(() => {
    load()
  }, [load])

  const removeEntry = async (event) => {
    const data = await api('delete', `/api/account/entries/${event.entryId}`)
    if (!data.success) return notify.error(say(data.message))
    notify.success(say(data.message))
    load()
    onChanged?.()
  }

  const groups = useMemo(() => {
    const byMonth = new Map()
    for (const event of (events || []).filter((item) => matchesFilter(item, filter))) {
      const key = event.date.slice(0, 7)
      if (!byMonth.has(key)) byMonth.set(key, [])
      byMonth.get(key).push(event)
    }
    return [...byMonth.entries()]
  }, [events, filter])

  return (
    <section aria-label={t('Health timeline')}>
      <div className='mb-4 flex flex-wrap items-end justify-between gap-3'>
        <div className='flex flex-wrap gap-1.5' role='group' aria-label={t('Filter the timeline')}>
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type='button'
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={`min-h-9 rounded-control px-3 text-body-sm font-medium transition ${filter === option.value ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-ink-2 hover:text-ink'}`}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
        <div className='flex flex-wrap items-end gap-2'>
          {members.length > 0 && (
            <Select aria-label={t('Whose timeline')} value={memberId} onChange={(event) => setMemberId(event.target.value)} className='w-auto!'>
              <option value=''>{t('Me')}</option>
              {members.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
            </Select>
          )}
          <Button leadingIcon={<Plus className='size-4' />} onClick={() => setAdding(true)}>{t('Add')}</Button>
        </div>
      </div>

      {events === null ? (
        <SkeletonGroup label={t('Loading...')}>
          <div className='space-y-3'>
            {[0, 1, 2].map((key) => <Skeleton key={key} className='h-20 w-full rounded-card' />)}
          </div>
        </SkeletonGroup>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck2 className='size-6' />}
          title={filter === 'all' ? t('Your health story starts here') : t('Nothing here yet')}
          description={t('Visits and prescriptions appear by themselves. Add readings, symptoms or vaccines whenever you like.')}
          action={<Button variant='secondary' onClick={() => setAdding(true)}>{t('Add the first entry')}</Button>}
          headingLevel={3}
        />
      ) : (
        <div className='space-y-6'>
          {groups.map(([month, items]) => (
            <div key={month}>
              <h3 className='mb-3 font-display text-title text-ink'>{formatIsoDate(`${month}-01`, language, { year: 'numeric', month: 'long' })}</h3>
              <ol className='relative space-y-3 border-s-2 border-line ps-5'>
                {items.map((event) => {
                  const Icon = iconFor(event)
                  return (
                    <li key={event.id} className='relative animate-fade'>
                      <span className='absolute -start-[2.15rem] top-3 flex size-7 items-center justify-center rounded-full bg-primary-soft text-brand ring-4 ring-canvas'>
                        <Icon className='size-3.5' aria-hidden='true' />
                      </span>
                      <div className='rounded-card border border-line bg-surface p-3.5 shadow-e1'>
                        <p className='mb-1 text-caption text-ink-3'>{formatIsoDate(event.date, language, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                        <EventBody event={event} onRemind={(item) => setReminderDraft(reminderFromMedication(item))} onDelete={removeEntry} />
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <EntryModal
          open
          memberId={memberId}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            load()
            onChanged?.()
          }}
        />
      )}
      {reminderDraft && (
        <ReminderModal
          draft={reminderDraft}
          members={members}
          onClose={() => setReminderDraft(null)}
          onSaved={() => {
            setReminderDraft(null)
            onChanged?.()
          }}
        />
      )}
    </section>
  )
}

export default HealthTimeline
