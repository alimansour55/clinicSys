import React from 'react'
import { MapPin } from 'lucide-react'
import { RatingBadge } from '../DoctorRating'
import { isDoctorComingSoon, isDoctorBookableForPatients } from '../../utils/doctorBooking'

const DoctorChatCard = ({
  doctor,
  displayName,
  specialtyLabel,
  locationLabel,
  feesLabel,
  feeHintLabel,
  locationsLabel,
  chooseLabel,
  unavailableLabel,
  comingSoonLabel,
  availableLabel,
  notAvailableLabel,
  onChoose,
  isRtl
}) => {
  const comingSoon = isDoctorComingSoon(doctor)
  const bookable = isDoctorBookableForPatients(doctor) && !comingSoon

  const statusLabel = comingSoon
    ? comingSoonLabel
    : bookable
      ? availableLabel
      : notAvailableLabel

  return (
    <div
      className={`flex gap-2.5 rounded-xl border bg-white p-2.5 shadow-sm ${
        comingSoon ? 'border-amber-200 opacity-95' : 'border-gray-200'
      }`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {doctor.image ? (
        <img
          src={doctor.image}
          alt=""
          className="h-16 w-16 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-lg font-bold text-primary">
          {displayName.charAt(0)}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-gray-900">{displayName}</p>
        <p className="truncate text-xs text-gray-600">{specialtyLabel}</p>
        {feesLabel && (
          <p className="mt-1.5 inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
            {feeHintLabel ? `${feeHintLabel}: ` : ''}
            {feesLabel}
          </p>
        )}
        {locationsLabel ? (
          <p className="mt-1 flex items-start gap-1 text-[11px] text-gray-500">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
            <span className="line-clamp-3">{locationsLabel}</span>
          </p>
        ) : locationLabel ? (
          <p className="mt-1 flex items-start gap-1 text-[11px] text-gray-500">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
            <span className="line-clamp-2">{locationLabel}</span>
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <RatingBadge summary={doctor.ratingSummary} className="static" />
          <span
            className={`text-[10px] font-medium ${
              comingSoon ? 'text-amber-700' : bookable ? 'text-green-600' : 'text-gray-500'
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <button
          type="button"
          disabled={!bookable}
          onClick={() => bookable && onChoose(doctor)}
          className={`mt-2 w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
            bookable
              ? 'bg-primary text-white hover:bg-primary/90'
              : 'cursor-not-allowed bg-gray-100 text-gray-500'
          }`}
        >
          {bookable ? chooseLabel : unavailableLabel}
        </button>
      </div>
    </div>
  )
}

export default DoctorChatCard
