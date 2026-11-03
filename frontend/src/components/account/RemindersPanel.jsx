import { useState } from 'react'
import { BellPlus, BellRing, Pause, Pencil, Play, Trash2 } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { Badge, Button, Card, CardBody, EmptyState, IconButton, notify } from '../ui'
import { useAccountApi, useServerText } from './accountApi'
import { adherence, dueReminders, todayIso } from './hubLogic'
import ReminderModal from './ReminderModal'

const FREQUENCY_LABELS = { daily: 'Every day', weekly: 'Every week', monthly: 'Every month', once: 'Just once' }

const DOT = { taken: 'bg-success', skipped: 'bg-line-strong', missed: 'bg-warning' }
const DOT_LABEL = { taken: 'Taken (medicine)', skipped: 'Skipped', missed: 'Missed (medicine)' }

/** The last few answers, each with its own title, so the pattern does not rely on colour alone. */
const History = ({ reminder }) => {
  const { t, language, formatPercent, localizeDigits } = useLanguage()
  const recent = (reminder.history || []).slice(-14)
  if (!recent.length) return null
  const score = adherence(reminder)
  return (
    <div className='mt-3 flex flex-wrap items-center gap-3'>
      <ol dir='ltr' className='flex gap-1' aria-label={t('Recent doses')}>
        {recent.map((entry, index) => {
          const when = new Date(entry.dueAt || entry.at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })
          return <li key={index} title={`${when}: ${t(DOT_LABEL[entry.action])}`} className={`size-2.5 rounded-full ${DOT[entry.action]}`}><span className='sr-only'>{`${when}: ${t(DOT_LABEL[entry.action])}`}</span></li>
        })}
      </ol>
      <span className='text-caption text-ink-2'>{localizeDigits(String(t('{{n}} taken lately')).replace('{{n}}', formatPercent(score)))}</span>
    </div>
  )
}

const RemindersPanel = ({ reminders, members, reload }) => {
  const { t, language, localizeDigits } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const due = new Set(dueReminders(reminders).map((reminder) => reminder._id))
  const memberName = (id) => members.find((member) => member._id === id)?.name

  const act = async (method, path, body) => {
    const data = await api(method, path, body)
    if (!data.success) {
      notify.error(say(data.message))
      return false
    }
    if (data.message) notify.success(say(data.message))
    reload()
    return true
  }

  const whenNext = (reminder) => {
    if (!reminder.active) return t('Paused')
    if (!reminder.nextDueAt) return t('Finished')
    const locale = language === 'ar' ? 'ar-EG' : 'en-GB'
    return localizeDigits(new Date(reminder.nextDueAt).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))
  }

  return (
    <section aria-label={t('Reminders')} className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='max-w-xl text-body-sm text-ink-2'>{t('Reminders appear under the bell when you open Clinivo. Prescriptions in your timeline can become reminders with one tap.')}</p>
        <Button leadingIcon={<BellPlus className='size-4' />} onClick={() => setCreating(true)}>{t('Add a reminder')}</Button>
      </div>

      {reminders.length === 0 ? (
        <EmptyState icon={<BellRing className='size-6' />} title={t('No reminders yet')} description={t('Add a medicine, a yearly check-up, or a vaccine for your child.')} headingLevel={3} />
      ) : (
        <ul className='grid grid-cols-1 gap-3 md:grid-cols-2'>
          {reminders.map((reminder) => (
            <li key={reminder._id}>
              <Card className='h-full'>
                <CardBody>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <p dir='auto' className='text-body font-semibold text-ink'>{reminder.title}</p>
                      <p className='text-caption text-ink-2'>{t(FREQUENCY_LABELS[reminder.frequency])}{reminder.memberId && memberName(reminder.memberId) ? ` · ${memberName(reminder.memberId)}` : ''}</p>
                    </div>
                    {due.has(reminder._id) && <Badge tone='accent' dot>{t('Due now')}</Badge>}
                  </div>
                  {reminder.note && <p dir='auto' className='mt-1 text-caption text-ink-3'>{reminder.note}</p>}
                  <p className='mt-2 text-body-sm text-ink-2'>{t('Next')}: {whenNext(reminder)}</p>
                  <History reminder={reminder} />
                  <div className='mt-3 flex flex-wrap items-center gap-1'>
                    {due.has(reminder._id) && (
                      <>
                        <Button size='sm' onClick={() => act('post', `/api/account/reminders/${reminder._id}/respond`, { action: 'taken' })}>{t('Taken (medicine)')}</Button>
                        <Button size='sm' variant='ghost' onClick={() => act('post', `/api/account/reminders/${reminder._id}/respond`, { action: 'skipped' })}>{t('Skip')}</Button>
                      </>
                    )}
                    <span className='ms-auto flex gap-1'>
                      <IconButton label={reminder.active ? t('Pause') : t('Resume')} variant='ghost' size='sm' onClick={() => act('put', `/api/account/reminders/${reminder._id}`, { active: !reminder.active })}>
                        {reminder.active ? <Pause className='size-4' /> : <Play className='size-4' />}
                      </IconButton>
                      <IconButton label={t('Edit')} variant='ghost' size='sm' onClick={() => setEditing(reminder)}><Pencil className='size-4' /></IconButton>
                      <IconButton label={t('Remove')} variant='ghost' size='sm' onClick={() => act('delete', `/api/account/reminders/${reminder._id}`)}><Trash2 className='size-4' /></IconButton>
                    </span>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <ReminderModal
          reminder={editing}
          draft={{ startDate: todayIso() }}
          members={members}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            reload()
          }}
        />
      )}
    </section>
  )
}

export default RemindersPanel
