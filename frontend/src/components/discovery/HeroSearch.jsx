import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Search, Sparkles } from 'lucide-react'
import { AppContext } from '../../context/AppContext'
import { resolveClinicSectionLabel } from '../../utils/chatbotOpeningSuggestions'
import { formatLocationLine } from '../../utils/placeTranslations'
import { formatDoctorCountLabel } from '../../utils/arabicMedicalUi'
import { EMPTY_FILTERS, filterRows } from './doctorInsights'
import { parseDoctorQuery } from './queryParser'
import { MODE_META } from './modes'
import { fill } from './format'

/* Example requests. Only the ones that find at least one real doctor are offered. */
const EXAMPLES = {
  en: ['Skin rash', 'My child has a fever', 'Video call today', 'Home visit this week', 'Female doctor', 'Under 400 EGP tomorrow'],
  ar: ['حساسية في الجلد', 'ابني عنده سخونية', 'مكالمة فيديو النهارده', 'زيارة منزلية الأسبوع ده', 'دكتورة', 'أقل من ٤٠٠ جنيه بكرة'],
}

const toFilters = (parsed) => ({
  ...EMPTY_FILTERS,
  speciality: parsed.speciality || '',
  area: parsed.area || '',
  mode: parsed.mode || '',
  when: parsed.when || '',
  maxPrice: parsed.maxPrice ?? null,
  gender: parsed.gender || '',
})

/** The hero search: understands a sentence and shows what it understood while you type. */
export default function HeroSearch({ rows, catalogue }) {
  const navigate = useNavigate()
  const { t, tc, language, formatMoney, placeTranslationOverrides, localizeDigits } = useContext(AppContext)
  const [text, setText] = useState('')
  const [hint, setHint] = useState(0)
  const parsed = useMemo(() => parseDoctorQuery(text, catalogue), [text, catalogue])

  const examples = useMemo(
    () =>
      (EXAMPLES[language] || EXAMPLES.en)
        .map((example) => ({ example, count: filterRows(rows, toFilters(parseDoctorQuery(example, catalogue))).length, parsed: parseDoctorQuery(example, catalogue) }))
        .filter((item) => item.count > 0 && Object.keys(item.parsed.spans).length > 0)
        .slice(0, 4),
    [rows, catalogue, language],
  )

  /* The placeholder cycles through examples that work. Reduced motion keeps it still. */
  useEffect(() => {
    if (examples.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const id = setInterval(() => setHint((i) => (i + 1) % examples.length), 3500)
    return () => clearInterval(id)
  }, [examples.length])

  const pieces = [
    parsed.speciality && resolveClinicSectionLabel(parsed.speciality, language, t, tc, placeTranslationOverrides),
    parsed.area && formatLocationLine(catalogue.areas.find((a) => a.key === parsed.area)?.main || parsed.area, language, t, placeTranslationOverrides),
    parsed.mode && t(MODE_META[parsed.mode].label),
    parsed.when && t({ today: 'Today', tomorrow: 'Tomorrow', week: 'This week' }[parsed.when]),
    parsed.maxPrice && fill(t('Up to {{amount}}'), { amount: formatMoney(parsed.maxPrice) }),
    parsed.gender && t(parsed.gender),
  ].filter(Boolean)
  const matches = pieces.length ? filterRows(rows, toFilters(parsed)).length : null

  const submit = (value) => {
    const q = String(value ?? text).trim()
    navigate(q ? `/doctors?q=${encodeURIComponent(q)}` : '/doctors')
  }

  return (
    <form role='search' onSubmit={(event) => { event.preventDefault(); submit() }} className='w-full max-w-xl'>
      <label htmlFor='hero-search' className='mb-2 block text-body-sm font-semibold text-ink'>
        {t('What do you need help with?')}
      </label>
      <div className='flex items-center gap-2 rounded-control border border-field bg-surface p-1.5 shadow-e2 transition focus-within:border-primary focus-within:shadow-brand'>
        <Search aria-hidden='true' className='ms-2.5 size-5 shrink-0 text-ink-3' />
        <input
          id='hero-search'
          type='search'
          enterKeyHint='search'
          autoComplete='off'
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={examples.length ? fill(t('e.g. {{example}}'), { example: examples[hint % examples.length].example }) : t('A symptom, a speciality, an area or a doctor')}
          className='min-w-0 flex-1 bg-transparent py-2.5 text-body text-ink outline-none placeholder:text-ink-3'
          aria-describedby='hero-search-understood'
        />
        <button type='submit' className='inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control bg-primary px-4 text-body-sm font-semibold text-on-primary shadow-e1 transition hover:bg-primary-dark sm:px-5'>
          <span className='hidden sm:inline'>{t('Find doctors')}</span>
          <ArrowRight aria-hidden='true' className='size-4 rtl:-scale-x-100' />
          <span className='sr-only sm:hidden'>{t('Find doctors')}</span>
        </button>
      </div>

      <div id='hero-search-understood' aria-live='polite' className='mt-3 min-h-8'>
        {pieces.length > 0 ? (
          <p className='flex flex-wrap items-center gap-1.5 text-body-sm text-ink-2'>
            <Sparkles aria-hidden='true' className='size-4 text-brand' />
            <span>{t('Looking for')}</span>
            {pieces.map((piece) => (
              <span key={piece} className='animate-rise rounded-full bg-primary-soft px-2.5 py-0.5 font-medium text-brand'>{piece}</span>
            ))}
            <span className='text-ink-3'>
              · {matches ? formatDoctorCountLabel(matches, language, localizeDigits) : t('no exact match yet, we will show the closest')}
            </span>
          </p>
        ) : examples.length > 0 ? (
          <div className='flex flex-wrap items-center gap-2 text-body-sm'>
            <span className='text-ink-3'>{t('Try:')}</span>
            {examples.map(({ example }) => (
              <button key={example} type='button' onClick={() => submit(example)} className='rounded-full border border-line bg-surface px-3 py-1 text-ink-2 transition hover:border-primary hover:text-brand'>
                {example}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </form>
  )
}
