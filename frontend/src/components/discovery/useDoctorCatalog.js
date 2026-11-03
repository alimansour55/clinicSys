import { useContext, useEffect, useMemo, useState } from 'react'
import { AppContext } from '../../context/AppContext'
import { translateString } from '../../i18n'
import { CLINIC_SECTION_LABELS } from '../../utils/clinicSectionLabels'
import { displayPersonName } from '../../utils/personNameArabic'
import { arabicPlaceLabelForFilter, formatLocationLine } from '../../utils/placeTranslations'
import { buildDoctorRow, catalogueStats } from './doctorInsights'

/* Openings move as time passes, so rows are rebuilt every few minutes. */
const REFRESH_MS = 5 * 60 * 1000

export function useNow(intervalMs = REFRESH_MS) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    const onVisible = () => document.visibilityState === 'visible' && setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])
  return now
}

const arabic = (value) => (value ? translateString(value, 'ar') : '')

/** Doctor rows with real openings, plus what the search parser may propose. */
export function useDoctorCatalog() {
  const { doctors, isDoctorsLoading, siteSettings, placeTranslationOverrides } = useContext(AppContext)
  const now = useNow()
  const globalVisitFees = siteSettings?.globalVisitFees

  const rows = useMemo(() => {
    const labels = (doctor) => [
      displayPersonName(doctor.name, 'ar'),
      arabic(doctor.speciality),
      CLINIC_SECTION_LABELS[String(doctor.speciality || '').trim().toLowerCase()]?.ar,
      arabic(doctor.title),
      ...(doctor.locations || []).map((raw) => formatLocationLine(raw, 'ar', arabic, placeTranslationOverrides)),
    ]
    return (doctors || []).map((doctor) => buildDoctorRow(doctor, { globalVisitFees, labels, now: new Date(now) }))
  }, [doctors, globalVisitFees, placeTranslationOverrides, now])

  const catalogue = useMemo(() => {
    const areas = new Map()
    for (const row of rows) {
      for (const place of row.places) {
        if (!place.key || areas.has(place.key)) continue
        areas.set(place.key, {
          key: place.key,
          main: place.main,
          labels: [place.main, arabicPlaceLabelForFilter(place.main), arabic(place.main)].filter(Boolean),
        })
      }
    }
    return {
      specialities: [...new Set(rows.map((row) => row.speciality).filter(Boolean))].sort(),
      areas: [...areas.values()].sort((a, b) => a.main.localeCompare(b.main)),
    }
  }, [rows])

  const stats = useMemo(() => catalogueStats(rows), [rows])

  return { rows, catalogue, stats, loading: isDoctorsLoading && !rows.length, now }
}
