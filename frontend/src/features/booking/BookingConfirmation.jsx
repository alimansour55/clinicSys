import { Link } from 'react-router-dom'
import { Check, Video } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { Badge, Button, Card, CardBody } from '../../components/ui'
import DocumentActions from './DocumentActions'
import { fill, formatCountdown, formatDayLong, formatSlotTime } from './bookingFormat'

const TYPE_LABELS = { Clinic: 'In clinic', 'Voice Call': 'Voice call', 'Video Call': 'Video call', 'Home Visit': 'Home visit' }

/** The moment a patient has been working towards. Everything they might want next is one tap away. */
const BookingConfirmation = ({ appointment, doctorName, backendUrl, token, formatMoney, placeLabel }) => {
  const { t, language, localizeDigits } = useLanguage()
  const paid = appointment.paymentStatus === 'Paid'
  const isTele = ['Voice Call', 'Video Call'].includes(appointment.appointmentType)

  return (
    <div className='mx-auto max-w-2xl py-8'>
      <Card variant='signature' className='animate-rise'>
        <CardBody>
          <div className='flex items-start gap-4'>
            <span className='flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-brand'>
              <Check className='h-7 w-7' aria-hidden='true' />
            </span>
            <div className='min-w-0'>
              <h1 className='font-display text-display text-ink'>{t('You are booked')}</h1>
              <p className='mt-1 text-body text-ink-2'>{fill(t('Your visit with {{doctor}} is confirmed.'), { doctor: doctorName })}</p>
            </div>
          </div>

          <dl className='mt-6 grid gap-4 rounded-control bg-surface-sunken p-4 sm:grid-cols-2'>
            <div>
              <dt className='text-caption text-ink-3'>{t('When')}</dt>
              <dd className='mt-0.5 text-body-sm font-semibold text-ink'>
                {appointment.startsAt ? formatDayLong(appointment.startsAt, language) : appointment.slotDate}
                {' · '}{formatSlotTime(appointment.slotTime, language, localizeDigits)}
              </dd>
              {appointment.startsAt && <dd className='text-caption text-ink-2'>{formatCountdown(appointment.startsAt, language)}</dd>}
            </div>
            <div>
              <dt className='text-caption text-ink-3'>{t('How')}</dt>
              <dd className='mt-0.5 text-body-sm font-semibold text-ink'>{t(TYPE_LABELS[appointment.appointmentType] || 'In clinic')}</dd>
              {placeLabel && <dd className='text-caption text-ink-2'>{placeLabel}</dd>}
            </div>
            <div>
              <dt className='text-caption text-ink-3'>{t('Reservation number')}</dt>
              <dd className='mt-0.5 text-body-sm font-semibold text-ink' dir='ltr'>{appointment.reservationNumber}</dd>
            </div>
            <div>
              <dt className='text-caption text-ink-3'>{t('Amount')}</dt>
              <dd className='mt-0.5 flex flex-wrap items-center gap-2 text-body-sm font-semibold text-ink'>
                {formatMoney(appointment.amount)}
                <Badge tone={paid ? 'success' : 'warning'}>{paid ? t('Paid') : t('Due at the clinic')}</Badge>
              </dd>
            </div>
          </dl>

          {isTele && (
            <p className='mt-4 flex items-start gap-2 rounded-control bg-info-soft p-3 text-body-sm text-info-ink'>
              <Video className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
              {t('Your call link is ready in My Appointments. It opens 15 minutes before your visit.')}
            </p>
          )}

          <div className='mt-6'>
            <DocumentActions appointment={appointment} backendUrl={backendUrl} token={token} size='md' />
          </div>

          <div className='mt-6 border-t border-line pt-4'>
            <Button as={Link} to='/my-appointments' fullWidth size='lg'>{t('View my appointments')}</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default BookingConfirmation
