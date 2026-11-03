import { useContext, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { AppContext } from '../../context/AppContext'
import { applyPageMeta } from './usePageMeta'
import { optimizedImage } from './format'

/* Pages that set their own title and description through usePageMeta. */
const OWN_META = /^\/($|doctors(\/|$)|about$|contact$)/

/* Account and one-time pages: useful to people, useless or harmful in search results. */
const PRIVATE = /^\/(my-profile|my-appointments|medical-history|insurance|email-verify|otp-verify|account-verify|reset-password)/

const TITLES = {
  '/login': 'Sign in',
  '/my-profile': 'My Profile',
  '/my-appointments': 'My Appointments',
  '/medical-history': 'Medical History',
  '/insurance': 'Insurance',
  '/email-verify': 'Verify your email',
  '/otp-verify': 'Verify your email',
  '/account-verify': 'Verify your account',
  '/reset-password': 'Reset password',
}

/** Titles, robots rules and doctor structured data for routes the discovery pages do not own. */
export default function RouteMeta() {
  const { pathname } = useLocation()
  const { doctors, t, language, doctorText } = useContext(AppContext)

  const doctorId = pathname.match(/^\/appointment\/([^/]+)/)?.[1]
  const doctor = doctorId ? doctors.find((d) => String(d._id) === doctorId) : null

  useEffect(() => {
    if (OWN_META.test(pathname)) return
    if (doctorId) {
      if (!doctor) {
        applyPageMeta({ title: t('Book an appointment'), language })
        return
      }
      const name = doctorText(doctor, 'name')
      const speciality = doctorText(doctor, 'speciality')
      const count = Number(doctor.ratingSummary?.ratingCount || 0)
      applyPageMeta({
        title: `${name} · ${speciality}`,
        description: `${name}, ${speciality}. ${t('See real open times and book a clinic visit, call or home visit on Clinivo.')}`,
        image: optimizedImage(doctor.image, 1200).startsWith('http') ? optimizedImage(doctor.image, 1200) : undefined,
        type: 'profile',
        language,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Physician',
          name: doctor.name,
          medicalSpecialty: doctor.speciality,
          image: String(doctor.image || '').startsWith('http') ? doctor.image : undefined,
          address: (doctor.locations || []).slice(0, 3).map((place) => ({ '@type': 'PostalAddress', streetAddress: place, addressCountry: 'EG' })),
          ...(count > 0
            ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: doctor.ratingSummary.averageRating, ratingCount: count, bestRating: 5 } }
            : {}),
        },
      })
      return
    }
    applyPageMeta({ title: TITLES[pathname] ? t(TITLES[pathname]) : '', noindex: PRIVATE.test(pathname), language })
  }, [pathname, doctorId, doctor, t, language, doctorText])

  return null
}
