import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { Clock, MapPin } from 'lucide-react'
import { AppContext } from '../../context/AppContext'
import { RatingBadge } from '../DoctorRating'
import PromoOfferBadge from '../PromoOfferBadge'
import { formatLocationLine } from '../../utils/placeTranslations'
import { openingsFor, VISIT_MODES } from './doctorInsights'
import { fill, formatOpening, optimizedImage } from './format'
import { doctorHref, MODE_META } from './modes'

/** One doctor in any discovery list. The name is the link; the whole card is its hit area. */
export default function DoctorCard({ row, mode = '', now, priority = false, headingLevel = 3 }) {
  const { t, tc, language, formatMoney, displayPersonName, placeTranslationOverrides } = useContext(AppContext)
  const doctor = row.doctor
  const Heading = `h${headingLevel}`
  const openings = openingsFor(row, mode)
  const name = displayPersonName(doctor.name)
  const place = row.places.find((p) => p.raw === openings?.nextPlace) || row.places[0]
  const offered = VISIT_MODES.filter((m) => row.modes[m])

  const availability = row.comingSoon
    ? { tone: 'bg-warning-soft text-warning-ink', text: t('Booking opens soon') }
    : doctor.available === false
      ? { tone: 'bg-surface-sunken text-ink-2', text: t('Not taking bookings right now') }
      : openings?.next
      ? { tone: 'bg-success-soft text-success-ink', text: fill(t('Next: {{when}}'), { when: formatOpening(openings.next, language, t, now ? new Date(now) : undefined) }) }
      : { tone: 'bg-surface-sunken text-ink-2', text: mode ? t('No openings for this visit type soon') : t('No openings in the next two weeks') }

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-e1 transition duration-(--duration-base) ease-standard ${
        row.comingSoon ? '' : 'focus-within:shadow-e2 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-e2'
      }`}
    >
      <div className='relative aspect-[4/3] overflow-hidden bg-primary-soft'>
        <img
          src={optimizedImage(doctor.image, 480)}
          alt=''
          width={480}
          height={360}
          loading={priority ? 'eager' : 'lazy'}
          decoding='async'
          fetchpriority={priority ? 'high' : undefined}
          className='size-full object-cover object-top transition duration-(--duration-slow) ease-standard group-hover:scale-[1.03]'
        />
        <RatingBadge summary={doctor.ratingSummary} className='absolute start-2.5 top-2.5' />
        <PromoOfferBadge doctor={doctor} formatMoney={formatMoney} className='absolute bottom-2.5 start-2.5' />
      </div>

      <div className='flex flex-1 flex-col gap-2 p-4'>
        <div className='min-w-0'>
          <Heading className='truncate text-subtitle font-semibold text-ink'>
            {row.comingSoon ? (
              name
            ) : (
              <Link
                to={doctorHref(row, mode)}
                className='outline-none after:absolute after:inset-0 after:rounded-card after:content-[""] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus'
              >
                {name}
              </Link>
            )}
          </Heading>
          <p className='truncate text-body-sm text-ink-2'>
            {[doctor.title ? t(doctor.title) : '', tc(doctor.speciality)].filter(Boolean).join(' · ')}
          </p>
        </div>

        {place && (
          <p className='flex min-w-0 items-center gap-1.5 text-body-sm text-ink-2'>
            <MapPin aria-hidden='true' className='size-4 shrink-0 text-brand' />
            <span className='truncate'>{formatLocationLine(place.main, language, t, placeTranslationOverrides)}</span>
            {row.places.length > 1 && (
              <span className='shrink-0 text-caption text-ink-3'>{fill(t('+{{n}} more'), { n: row.places.length - 1 })}</span>
            )}
          </p>
        )}

        <p className={`flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-caption font-semibold ${availability.tone}`}>
          <Clock aria-hidden='true' className='size-3.5 shrink-0' />
          {availability.text}
        </p>

        <div className='mt-auto flex items-end justify-between gap-3 pt-2'>
          <p className='text-body-sm'>
            {row.fee > 0 ? (
              <>
                <span className='sr-only'>{t('Visit fee')}: </span>
                <span className='font-semibold text-ink'>{formatMoney(row.offerFee ?? row.fee)}</span>
                {row.offerFee != null && <s className='ms-1.5 text-caption text-ink-3'>{formatMoney(row.fee)}</s>}
              </>
            ) : (
              <span className='text-ink-3'>{t('Fee shown when booking')}</span>
            )}
          </p>
          {offered.length > 0 && (
            <ul className='flex shrink-0 items-center gap-1' aria-label={t('Visit types')}>
              {offered.map((m) => {
                const { icon: Icon, label } = MODE_META[m]
                return (
                  <li key={m} title={t(label)} className={`flex size-7 items-center justify-center rounded-full ${m === mode ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-ink-2'}`}>
                    <Icon aria-hidden='true' className='size-3.5' />
                    <span className='sr-only'>{t(label)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </article>
  )
}
