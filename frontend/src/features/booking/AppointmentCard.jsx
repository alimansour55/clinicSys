import { useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CreditCard, ExternalLink, Home, MapPin, Phone, RotateCcw, Star, Video, X } from 'lucide-react'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
import { Badge, Button, Card, CardBody, Field, Textarea, cx } from '../../components/ui'
import { StarRow, formatRatingDate } from '../../components/DoctorRating'
import { formatHomeVisitAddress } from '../../utils/homeVisitAreas'
import { formatLocationLine } from '../../utils/placeTranslations'
import DocumentActions from './DocumentActions'
import { fill, formatCountdown, formatDayLong, formatSlotTime, shouldHighlightJoin } from './bookingFormat'

const TYPE_ICONS = { Clinic: MapPin, 'Voice Call': Phone, 'Video Call': Video, 'Home Visit': Home }
const TYPE_LABELS = { Clinic: 'In clinic', 'Voice Call': 'Voice call', 'Video Call': 'Video call', 'Home Visit': 'Home visit' }

const STATUS_BADGES = {
  Booked: { tone: 'brand', label: 'Booked' },
  'Checked In': { tone: 'info', label: 'Checked in' },
  'In Progress': { tone: 'info', label: 'With the doctor' },
  Finished: { tone: 'success', label: 'Completed' },
  Cancelled: { tone: 'danger', label: 'Cancelled' }
}

const REFUND_TONES = { 'Refund Pending': 'warning', Refunded: 'success', 'Refund Failed': 'danger' }

const PaymentLine = ({ appointment }) => {
  const { t } = useLanguage()
  const { formatMoney } = useContext(AppContext)
  const { amount, paymentStatus, paymentMethod, refundStatus, cancelled, coveredByInsurance } = appointment
  const paid = paymentStatus === 'Paid'

  let label
  if (paymentMethod === 'Free') label = t('Free visit')
  else if (paid) label = fill(t('Paid by {{method}}'), { method: t(paymentMethod || 'Cash') })
  else if (cancelled) label = t('Not charged')
  else if (paymentMethod === 'Insurance' || coveredByInsurance) label = t('Reception confirms your insurance')
  else label = t('Due at the clinic')

  return (
    <div className='flex flex-wrap items-center gap-2 text-body-sm'>
      <span className='font-semibold text-ink'>{formatMoney(amount || 0)}</span>
      <span className='text-ink-2'>{label}</span>
      {refundStatus && refundStatus !== 'Not Refunded' && (
        <Badge tone={REFUND_TONES[refundStatus] || 'neutral'}>{t(refundStatus)}</Badge>
      )}
    </div>
  )
}

const RatingForm = ({ appointment, onSubmit }) => {
  const { t, localizeDigits } = useLanguage()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    await onSubmit(appointment._id, rating, comment)
    setSaving(false)
  }

  return (
    <div className='mt-4 rounded-control border border-line bg-surface-sunken p-4'>
      <p className='text-body-sm font-semibold text-ink'>{t('Rate your experience')}</p>
      <div className='mt-2 flex gap-1 text-warning'>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type='button'
            onClick={() => setRating(star)}
            aria-pressed={rating === star}
            aria-label={localizeDigits(fill(t('Rate n out of 5'), { n: star }))}
            className='rounded-full p-1 hover:bg-surface'
          >
            <Star className={cx('h-6 w-6', rating >= star ? 'fill-current' : 'fill-none')} aria-hidden='true' />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <div className='mt-3 animate-rise'>
          <Field label={t('Add a friendly comment')}>
            <Textarea rows={3} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} />
          </Field>
          <Button className='mt-3' size='sm' loading={saving} onClick={submit}>{t('Submit rating')}</Button>
        </div>
      )}
    </div>
  )
}

const AppointmentCard = ({ appointment, now, onCancel, onReschedule, onPay, onRate, onViewPrescription, prescriptionLoading, highlight = false }) => {
  const { t, tc, language, localizeDigits } = useLanguage()
  const { backendUrl, token, displayPersonName, placeTranslationOverrides } = useContext(AppContext)
  const type = appointment.appointmentType || 'Clinic'
  const TypeIcon = TYPE_ICONS[type] || MapPin
  const status = STATUS_BADGES[appointment.appointmentStatus] || STATUS_BADGES.Booked
  const finished = appointment.isCompleted || appointment.appointmentStatus === 'Finished'
  const isCancelled = appointment.cancelled || appointment.appointmentStatus === 'Cancelled'
  const isTele = ['Voice Call', 'Video Call'].includes(type)
  const missed = !finished && !isCancelled && appointment.appointmentStatus === 'Booked' && appointment.endsAt && appointment.endsAt < now
  const upcoming = !finished && !isCancelled && !missed
  const joinOpen = shouldHighlightJoin(appointment, now)
  const doctorName = displayPersonName(appointment.docData?.name) || t('Doctor')

  const place = type === 'Home Visit'
    ? formatHomeVisitAddress(appointment.homeVisitAddress) || t('Home visit address will be confirmed.')
    : isTele
      ? t(TYPE_LABELS[type])
      : formatLocationLine(appointment.clinicLocation || appointment.docData?.address?.line1 || '', language, t, placeTranslationOverrides)

  return (
    <Card variant={highlight ? 'signature' : 'raised'} as='article' className={highlight ? 'animate-rise' : ''}>
      <CardBody>
        <div className='flex gap-4'>
          <img
            className='h-16 w-16 shrink-0 rounded-control bg-surface-sunken object-cover sm:h-20 sm:w-20'
            src={appointment.docData?.image}
            alt=''
            loading='lazy'
          />
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
              <div className='min-w-0'>
                <h3 className='text-title font-semibold text-ink'>{doctorName}</h3>
                <p className='text-body-sm text-ink-2'>{tc(appointment.docData?.speciality)}</p>
              </div>
              <Badge tone={missed ? 'warning' : status.tone} dot>{missed ? t('Missed') : t(status.label)}</Badge>
            </div>

            <p className='mt-3 text-body font-semibold text-ink'>
              {appointment.startsAt ? formatDayLong(appointment.startsAt, language) : appointment.slotDate}
              {' · '}
              {formatSlotTime(appointment.slotTime, language, localizeDigits)}
            </p>
            {upcoming && appointment.startsAt && (
              <p className='text-caption font-semibold text-brand'>{formatCountdown(appointment.startsAt, language, now)}</p>
            )}

            <p className='mt-2 flex items-start gap-1.5 text-body-sm text-ink-2'>
              <TypeIcon className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
              <span className='min-w-0 break-words'>{place}</span>
            </p>
          </div>
        </div>

        <div className='mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3'>
          <PaymentLine appointment={appointment} />
          <span className='text-caption text-ink-3' dir='ltr'>{appointment.reservationNumber}</span>
        </div>

        {upcoming && appointment.teleconsultationLink && (
          <div className='mt-3'>
            {joinOpen ? (
              <Button as='a' href={appointment.teleconsultationLink} target='_blank' rel='noreferrer' fullWidth trailingIcon={<ExternalLink className='h-4 w-4' aria-hidden='true' />}>
                {t('Join call')}
              </Button>
            ) : (
              <p className='flex items-center gap-2 rounded-control bg-info-soft p-3 text-body-sm text-info-ink'>
                <TypeIcon className='h-4 w-4 shrink-0' aria-hidden='true' />
                {t('Your call link opens 15 minutes before the visit.')}
              </p>
            )}
          </div>
        )}

        {upcoming && (
          <div className='mt-4 flex flex-wrap gap-2'>
            {appointment.canReschedule && (
              <Button size='sm' variant='secondary' leadingIcon={<CalendarClock className='h-4 w-4' aria-hidden='true' />} onClick={() => onReschedule(appointment)}>
                {t('Move visit')}
              </Button>
            )}
            {appointment.canPayOnline && (
              <Button size='sm' leadingIcon={<CreditCard className='h-4 w-4' aria-hidden='true' />} onClick={() => onPay(appointment)}>
                {t('Pay online')}
              </Button>
            )}
            {appointment.canCancel && (
              <Button size='sm' variant='ghost' leadingIcon={<X className='h-4 w-4' aria-hidden='true' />} onClick={() => onCancel(appointment)}>
                {t('Cancel appointment')}
              </Button>
            )}
          </div>
        )}

        {(upcoming || finished) && (
          <div className='mt-2'>
            <DocumentActions appointment={appointment} backendUrl={backendUrl} token={token} showCalendar={upcoming} />
          </div>
        )}

        {finished && (
          <>
            <div className='mt-2 flex flex-wrap gap-2'>
              <Button size='sm' loading={prescriptionLoading} onClick={() => onViewPrescription(appointment._id)}>
                {t('View Prescription')}
              </Button>
              <Button
                size='sm'
                variant='secondary'
                as={Link}
                to={`/appointment/${appointment.docId}?type=${encodeURIComponent(type)}`}
                leadingIcon={<RotateCcw className='h-4 w-4 rtl:-scale-x-100' aria-hidden='true' />}
              >
                {t('Book again')}
              </Button>
            </div>
            {appointment.myRating ? (
              <div className='mt-4 rounded-control bg-surface-sunken p-3'>
                <div className='flex items-center gap-2'>
                  <StarRow value={appointment.myRating.rating} />
                  <span className='text-caption text-ink-3'>{formatRatingDate(appointment.myRating.createdAt, language)}</span>
                </div>
                {appointment.myRating.comment && <p className='mt-1 text-body-sm text-ink-2'>{appointment.myRating.comment}</p>}
              </div>
            ) : (
              <RatingForm appointment={appointment} onSubmit={onRate} />
            )}
          </>
        )}

        {(isCancelled || missed) && (
          <div className='mt-3'>
            <Button size='sm' variant='secondary' as={Link} to={`/appointment/${appointment.docId}?type=${encodeURIComponent(type)}`} leadingIcon={<RotateCcw className='h-4 w-4 rtl:-scale-x-100' aria-hidden='true' />}>
              {t('Book again')}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

export default AppointmentCard
