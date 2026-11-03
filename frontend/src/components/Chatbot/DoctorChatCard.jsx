import React from 'react'
import { Clock3, MapPin } from 'lucide-react'
import { RatingBadge } from '../DoctorRating'
import { Badge, Button } from '../ui'
import { isDoctorComingSoon, isDoctorBookableForPatients } from '../../utils/doctorBooking'

const DoctorChatCard = ({
  doctor,
  displayName,
  specialtyLabel,
  locationsLabel,
  feesLabel,
  nextSlots = [],
  slotsMatchRequest = true,
  slotLabel,
  onPickSlot,
  onChoose,
  t,
  style
}) => {
  const comingSoon = isDoctorComingSoon(doctor)
  const bookable = isDoctorBookableForPatients(doctor) && !comingSoon

  return (
    <article style={style} className='assistant-chip rounded-card border border-line bg-surface p-3 shadow-e1'>
      <div className='flex gap-3'>
        {doctor.image ? (
          <img src={doctor.image} alt='' className='size-14 shrink-0 rounded-control object-cover' />
        ) : (
          <span className='flex size-14 shrink-0 items-center justify-center rounded-control bg-primary-soft text-title font-bold text-brand'>
            {displayName.charAt(0)}
          </span>
        )}

        <div className='min-w-0 flex-1'>
          <h4 className='truncate text-body-sm font-bold text-ink'>{displayName}</h4>
          <p className='truncate text-caption text-ink-2'>{specialtyLabel}</p>
          <div className='mt-1 flex flex-wrap items-center gap-1.5'>
            {feesLabel && (
              <Badge tone='brand'>
                {t('assistant.feeLabel')}: {feesLabel}
              </Badge>
            )}
            <RatingBadge summary={doctor.ratingSummary} className='static' />
          </div>
          {locationsLabel && (
            <p className='mt-1 flex items-start gap-1 text-caption text-ink-3'>
              <MapPin aria-hidden='true' className='mt-0.5 size-3 shrink-0' />
              <span className='line-clamp-2'>{locationsLabel}</span>
            </p>
          )}
        </div>
      </div>

      {bookable && nextSlots.length > 0 && (
        <div className='mt-3'>
          <p className='mb-1.5 flex items-center gap-1 text-caption font-medium text-ink-2'>
            <Clock3 aria-hidden='true' className='size-3' />
            {t(slotsMatchRequest ? 'assistant.nextTimes' : 'assistant.nearestTimes')}
          </p>
          <div className='flex flex-wrap gap-1.5'>
            {nextSlots.map((slot) => (
              <button
                key={`${slot.slotDate}-${slot.time}-${slot.clinicLocation || ''}`}
                type='button'
                onClick={() => onPickSlot(doctor, slot)}
                className='min-h-9 cursor-pointer rounded-control border border-primary bg-primary-soft px-2.5 py-1 text-caption font-semibold text-brand transition duration-(--duration-fast) ease-standard hover:bg-primary hover:text-on-primary active:scale-[0.98]'
              >
                {slotLabel(slot)}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button
        className='mt-3'
        variant={nextSlots.length ? 'ghost' : 'secondary'}
        size='sm'
        fullWidth
        disabled={!bookable}
        onClick={() => bookable && onChoose(doctor)}
      >
        {!bookable ? t('assistant.notBookable') : nextSlots.length ? t('assistant.moreTimes') : t('assistant.chooseDoctor')}
      </Button>
    </article>
  )
}

export default DoctorChatCard
