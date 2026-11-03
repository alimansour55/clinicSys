import { useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import { Hourglass, Sparkles } from 'lucide-react'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
import { Badge, Button, Card, CardBody, notify } from '../../components/ui'
import CountdownTimer from '../../components/CountdownTimer'
import { leaveWaitlist } from './bookingApi'
import { fill, formatSlotTime } from './bookingFormat'

const WaitlistPanel = ({ entries, onChanged }) => {
  const { t, localizeDigits, language } = useLanguage()
  const { backendUrl, token, doctorText, slotDateFormat } = useContext(AppContext)
  const [busyId, setBusyId] = useState('')

  if (!entries.length) return null

  const leave = async (entry) => {
    setBusyId(entry._id)
    try {
      await leaveWaitlist(backendUrl, token, entry._id)
      onChanged()
    } catch {
      notify.error(t('Something went wrong. Please try again.'))
    } finally {
      setBusyId('')
    }
  }

  const offered = entries.filter((entry) => entry.status === 'offered' && entry.offer?.expiresAt)
  const waiting = entries.filter((entry) => entry.status === 'waiting')

  return (
    <div className='mb-6 space-y-3'>
      {offered.map((entry) => {
        const params = new URLSearchParams({
          type: entry.appointmentType,
          slotDate: entry.offer.slotDate,
          slotTime: entry.offer.slotTime,
          ...(entry.clinicLocation ? { location: entry.clinicLocation } : {})
        })
        return (
          <Card key={entry._id} variant='signature' className='animate-rise border-accent!'>
            <CardBody>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='flex min-w-0 items-start gap-3'>
                  <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent'>
                    <Sparkles className='h-5 w-5' aria-hidden='true' />
                  </span>
                  <div className='min-w-0'>
                    <h2 className='text-title font-semibold text-ink'>{t('A time opened up for you')}</h2>
                    <p className='mt-0.5 text-body-sm text-ink-2'>
                      {fill(t('{{doctor}} on {{date}} at {{time}}'), {
                        doctor: doctorText({ docId: entry.docId, name: entry.doctorName }, 'name'),
                        date: slotDateFormat(entry.offer.slotDate),
                        time: formatSlotTime(entry.offer.slotTime, language, localizeDigits)
                      })}
                    </p>
                  </div>
                </div>
                <span className='flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-caption font-semibold text-accent-ink'>
                  {t('Reserved for')}
                  <CountdownTimer expiresAt={entry.offer.expiresAt} onExpire={onChanged} />
                </span>
              </div>
              <div className='mt-4 flex flex-wrap gap-2'>
                <Button as={Link} to={`/appointment/${entry.docId}?${params.toString()}`}>{t('Book this time')}</Button>
                <Button variant='ghost' loading={busyId === entry._id} onClick={() => leave(entry)}>{t('No thanks')}</Button>
              </div>
            </CardBody>
          </Card>
        )
      })}

      {waiting.length > 0 && (
        <Card variant='flat'>
          <CardBody>
            <h2 className='flex items-center gap-2 text-subtitle font-semibold text-ink'>
              <Hourglass className='h-4 w-4 text-brand' aria-hidden='true' />
              {t('Your waitlists')}
            </h2>
            <ul className='mt-2 divide-y divide-line'>
              {waiting.map((entry) => (
                <li key={entry._id} className='flex flex-wrap items-center justify-between gap-2 py-2'>
                  <span className='flex flex-wrap items-center gap-2 text-body-sm text-ink'>
                    {doctorText({ docId: entry.docId, name: entry.doctorName }, 'name')}
                    <Badge tone='neutral'>{localizeDigits(fill(t('Number {{position}} in line'), { position: entry.position || 1 }))}</Badge>
                  </span>
                  <Button size='sm' variant='ghost' loading={busyId === entry._id} onClick={() => leave(entry)}>{t('Leave')}</Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

export default WaitlistPanel
