import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { Button, Field, IconButton, Input, Modal, Select, Textarea, notify } from '../ui'
import { useAccountApi, useServerText } from './accountApi'
import { todayIso } from './hubLogic'

const KINDS = [
  { value: 'medication', label: 'Medicine' },
  { value: 'checkup', label: 'Check-up' },
  { value: 'vaccine', label: 'Vaccine' },
  { value: 'other', label: 'Other' }
]

const FREQUENCIES = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'once', label: 'Just once' }
]

const ReminderModal = ({ draft = {}, reminder, members = [], onClose, onSaved }) => {
  const { t } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const source = reminder || draft
  const [form, setForm] = useState({
    kind: source.kind || 'medication',
    title: source.title || '',
    note: source.note || '',
    frequency: source.frequency || 'daily',
    times: source.times?.length ? source.times : ['09:00'],
    startDate: source.startDate || todayIso(),
    endDate: source.endDate || '',
    memberId: source.memberId || ''
  })
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const save = async () => {
    setSaving(true)
    const body = { ...form, tzOffsetMinutes: new Date().getTimezoneOffset() }
    const data = reminder
      ? await api('put', `/api/account/reminders/${reminder._id}`, body)
      : await api('post', '/api/account/reminders', body)
    setSaving(false)
    if (!data.success) return notify.error(say(data.message))
    notify.success(say(data.message))
    onSaved()
  }

  const multipleTimes = form.frequency === 'daily'
  const times = multipleTimes ? form.times : form.times.slice(0, 1)

  return (
    <Modal
      open
      onClose={onClose}
      title={reminder ? t('Edit reminder') : t('New reminder')}
      description={t('Reminders appear in Clinivo, under the bell, the next time you open it. We do not send them by SMS or email.')}
      footer={<Button loading={saving} onClick={save}>{t('Save')}</Button>}
    >
      <div className='space-y-4'>
        <Field label={t('What should we remind you about?')} required>
          <Input data-autofocus dir='auto' maxLength={160} value={form.title} onChange={(event) => set('title', event.target.value)} />
        </Field>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <Field label={t('Type')}>
            <Select value={form.kind} onChange={(event) => set('kind', event.target.value)}>
              {KINDS.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
            </Select>
          </Field>
          <Field label={t('How often')}>
            <Select value={form.frequency} onChange={(event) => set('frequency', event.target.value)}>
              {FREQUENCIES.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
            </Select>
          </Field>
          {members.length > 0 && (
            <Field label={t('Who is it for?')} className='sm:col-span-2'>
              <Select value={form.memberId} onChange={(event) => set('memberId', event.target.value)}>
                <option value=''>{t('Me')}</option>
                {members.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
              </Select>
            </Field>
          )}
        </div>

        <fieldset>
          <legend className='mb-1.5 text-body-sm font-medium text-ink'>{t('At what time?')}</legend>
          <div className='flex flex-wrap items-center gap-2' data-input-field>
            {times.map((time, index) => (
              <span key={index} className='flex items-center gap-1'>
                <Input
                  type='time'
                  dir='ltr'
                  aria-label={t('Time')}
                  value={time}
                  onChange={(event) => set('times', form.times.map((value, position) => (position === index ? event.target.value : value)))}
                  className='w-32'
                />
                {times.length > 1 && (
                  <IconButton label={t('Remove this time')} variant='ghost' size='sm' onClick={() => set('times', form.times.filter((_, position) => position !== index))}>
                    <X className='size-4' />
                  </IconButton>
                )}
              </span>
            ))}
            {multipleTimes && times.length < 6 && (
              <Button type='button' variant='ghost' size='sm' leadingIcon={<Plus className='size-4' />} onClick={() => set('times', [...form.times, '21:00'])}>{t('Add a time')}</Button>
            )}
          </div>
        </fieldset>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <Field label={form.frequency === 'once' ? t('Date') : t('Start date')} required>
            <Input type='date' value={form.startDate} onChange={(event) => set('startDate', event.target.value)} className='date-field-input' />
          </Field>
          {form.frequency !== 'once' && (
            <Field label={t('End date')} hint={t('Leave empty if it has no end.')}>
              <Input type='date' min={form.startDate} value={form.endDate} onChange={(event) => set('endDate', event.target.value)} className='date-field-input' />
            </Field>
          )}
        </div>
        <Field label={t('Note')}>
          <Textarea dir='auto' rows={2} maxLength={500} value={form.note} onChange={(event) => set('note', event.target.value)} placeholder={t('For example: after food')} />
        </Field>
      </div>
    </Modal>
  )
}

export default ReminderModal
