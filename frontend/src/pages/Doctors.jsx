import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CalendarDays, CreditCard, MapPin, Search, SlidersHorizontal, Sparkles, Star, Stethoscope, Tag, UserRound, X } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { specialityData } from '../assets/assets'
import { Button, EmptyState, Modal } from '../components/ui'
import { resolveClinicSectionLabel } from '../utils/chatbotOpeningSuggestions'
import { extractMainPlaceFromLocation, formatLocationLine, placeFilterKey } from '../utils/placeTranslations'
import { formatDoctorCountLabel } from '../utils/arabicMedicalUi'
import DoctorCard from '../components/discovery/DoctorCard'
import { MODE_META } from '../components/discovery/modes'
import PriceFilter from '../components/discovery/PriceFilter'
import { useDoctorCatalog } from '../components/discovery/useDoctorCatalog'
import { usePageMeta } from '../components/discovery/usePageMeta'
import { parseDoctorQuery, removeQueryPart } from '../components/discovery/queryParser'
import { fill } from '../components/discovery/format'
import { DoctorListSkeleton } from '../components/DoctorCatalogSkeleton'
import {
  activeFilterKeys,
  EMPTY_FILTERS,
  facetCounts,
  filterRows,
  matchesFilters,
  SORTS,
  sortRows,
  suggestRelaxations,
  VISIT_MODES,
} from '../components/discovery/doctorInsights'

const PAGE_SIZE = 12
const WHEN_OPTIONS = ['today', 'tomorrow', 'week']
const RATING_OPTIONS = [4, 4.5]
const TITLE_OPTIONS = ['Professor', 'Consultant', 'Lecturer', 'Specialist']
const SORT_LABELS = {
  recommended: 'Recommended',
  soonest: 'Soonest available',
  'price-asc': 'Lowest fee',
  'price-desc': 'Highest fee',
  rating: 'Highest rated',
}
const WHEN_LABELS = { today: 'Today', tomorrow: 'Tomorrow', week: 'This week' }

/** URL → the filters a person chose by hand. Old links (?clinic=, a place in the path) still work. */
function readExplicit(params, pathParam, knownSpecialities) {
  const pathIsSpeciality = pathParam && knownSpecialities.some((s) => s.toLowerCase() === pathParam.toLowerCase())
  const legacyPlace = params.get('clinic') || (!pathIsSpeciality ? pathParam : '')
  const areaParam = params.get('area') || (legacyPlace ? placeFilterKey(extractMainPlaceFromLocation(legacyPlace) || legacyPlace) : '')
  const consultation = params.get('consultation') || ''
  const max = Number(params.get('max'))
  return {
    q: params.get('q') || '',
    speciality: pathIsSpeciality ? knownSpecialities.find((s) => s.toLowerCase() === pathParam.toLowerCase()) : '',
    area: areaParam,
    mode: VISIT_MODES.includes(consultation) ? consultation : '',
    when: WHEN_OPTIONS.includes(params.get('when')) ? params.get('when') : '',
    maxPrice: max > 0 ? max : null,
    minRating: Number(params.get('rating')) || 0,
    gender: ['Female', 'Male'].includes(params.get('gender')) ? params.get('gender') : '',
    title: TITLE_OPTIONS.includes(params.get('title')) ? params.get('title') : '',
    pay: ['cash', 'online'].includes(params.get('pay')) ? params.get('pay') : '',
    offer: params.get('offer') === '1',
    language: params.get('lang') || '',
    sort: SORTS.includes(params.get('sort')) ? params.get('sort') : '',
  }
}

function writeUrl(state) {
  const path = state.speciality ? `/doctors/${encodeURIComponent(state.speciality)}` : '/doctors'
  const p = new URLSearchParams()
  if (state.q) p.set('q', state.q)
  if (state.area) p.set('area', state.area)
  if (state.mode) p.set('consultation', state.mode)
  if (state.when) p.set('when', state.when)
  if (state.maxPrice) p.set('max', String(state.maxPrice))
  if (state.minRating) p.set('rating', String(state.minRating))
  if (state.gender) p.set('gender', state.gender)
  if (state.title) p.set('title', state.title)
  if (state.pay) p.set('pay', state.pay)
  if (state.offer) p.set('offer', '1')
  if (state.language) p.set('lang', state.language)
  if (state.sort) p.set('sort', state.sort)
  const query = p.toString()
  return query ? `${path}?${query}` : path
}

const Doctors = () => {
  const { speciality: pathParam = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { token, t, tc, language, formatMoney, localizeDigits, placeTranslationOverrides } = useContext(AppContext)
  const { rows, catalogue, stats, loading, now } = useDoctorCatalog()
  const [showFilters, setShowFilters] = useState(false)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const resultsRef = useRef(null)

  const knownSpecialities = useMemo(
    () => [...new Set([...catalogue.specialities, ...specialityData.map((item) => item.speciality)])],
    [catalogue.specialities],
  )
  const explicit = readExplicit(searchParams, pathParam, knownSpecialities)
  const parsed = useMemo(() => parseDoctorQuery(explicit.q, catalogue), [explicit.q, catalogue])

  // Free words only count if some doctor matches them; the rest are shown as not understood.
  const knownTerms = parsed.terms.filter((term) => rows.some((row) => row.search.includes(term)))
  const unknownTerms = parsed.terms.filter((term) => !knownTerms.includes(term))

  const filters = {
    ...EMPTY_FILTERS,
    speciality: explicit.speciality || parsed.speciality || '',
    area: explicit.area || parsed.area || '',
    mode: explicit.mode || parsed.mode || '',
    when: explicit.when || parsed.when || '',
    maxPrice: explicit.maxPrice ?? parsed.maxPrice ?? null,
    minRating: explicit.minRating,
    gender: explicit.gender || parsed.gender || '',
    title: explicit.title,
    pay: explicit.pay,
    offer: explicit.offer,
    language: explicit.language,
    terms: knownTerms,
  }
  const sort = explicit.sort || parsed.sort || 'recommended'
  const mode = filters.mode

  const results = useMemo(() => sortRows(filterRows(rows, filters), sort, mode), [rows, JSON.stringify(filters), sort, mode]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = results.slice(0, visible)

  useEffect(() => setVisible(PAGE_SIZE), [location.search, location.pathname])

  /* Any change rewrites the URL, so back, reload and sharing all keep the search. */
  const go = (next, replace = false) => navigate(writeUrl(next), { replace, preventScrollReset: true })
  const setFilter = (key, value) => {
    const q = parsed.spans[key]?.length ? removeQueryPart(parsed, key) : explicit.q
    go({ ...explicit, q, [key]: value })
  }
  const toggle = (key, value) => setFilter(key, filters[key] === value ? (key === 'maxPrice' ? null : '') : value)
  const clearAll = () => go({})
  const dropUnderstood = (key) => go({ ...explicit, q: removeQueryPart(parsed, key) })

  /* Labels for chips, relaxation buttons and the page title */
  const specialityLabel = (name) => resolveClinicSectionLabel(name, language, t, tc, placeTranslationOverrides)
  const areaLabel = (key) => {
    const area = catalogue.areas.find((a) => a.key === key)
    return area ? formatLocationLine(area.main, language, t, placeTranslationOverrides) : key
  }
  const filterLabel = (key, value = filters[key]) => {
    switch (key) {
      case 'speciality': return specialityLabel(value)
      case 'area': return areaLabel(value)
      case 'mode': return t(MODE_META[value].label)
      case 'when': return t(WHEN_LABELS[value])
      case 'maxPrice': return fill(t('Up to {{amount}}'), { amount: formatMoney(value) })
      case 'minRating': return fill(t('{{n}}+ stars'), { n: localizeDigits(String(value)) })
      case 'gender': return t(value)
      case 'title': return t(value)
      case 'pay': return value === 'cash' ? t('Cash') : t('Online payment')
      case 'offer': return t('Has an offer')
      case 'language': return value
      case 'terms': return `“${value.join(' ')}”`
      default: return ''
    }
  }

  const facet = (key, options) => facetCounts(rows, filters, key, options).counts
  const modeCounts = facet('mode', VISIT_MODES)
  const whenCounts = facet('when', WHEN_OPTIONS)
  const relaxations = results.length === 0 ? suggestRelaxations(rows, filters).slice(0, 3) : []
  const activeKeys = activeFilterKeys(filters)
  // Filters that came from the search words are shown under the search box instead
  const chosenKeys = activeKeys.filter((key) => key !== 'terms' && !(parsed.spans[key]?.length && !explicit[key]))
  const pricesForHistogram = rows.filter((row) => matchesFilters(row, filters, 'maxPrice')).map((row) => row.offerFee ?? row.fee)

  /* SEO: the title names what is on screen */
  const headingByMode = { tele: 'Book a Video Call', voice: 'Book a Voice Call', home: 'Book a Home Visit' }
  const metaTitle = [filters.speciality && specialityLabel(filters.speciality), filters.area && areaLabel(filters.area)].filter(Boolean).join(' · ') || t(headingByMode[mode] || 'Find Your Doctor')
  usePageMeta({
    title: metaTitle,
    description: fill(t('Compare {{count}} with real next openings, fees and ratings, then book a clinic visit, call or home visit on Clinivo.'), {
      count: formatDoctorCountLabel(results.length, language, localizeDigits),
    }),
    path: location.pathname,
    language,
    jsonLd: results.length
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: results.slice(0, 20).map((row, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: `${window.location.origin}/appointment/${row.id}`,
            name: row.doctor.name,
          })),
        }
      : null,
  })

  const chip = (active) =>
    `inline-flex min-h-10 items-center gap-2 rounded-control border px-3 text-body-sm font-medium transition duration-(--duration-fast) ease-standard disabled:cursor-not-allowed disabled:opacity-45 ${
      active ? 'border-primary bg-primary text-on-primary shadow-e1' : 'border-line bg-surface text-ink hover:border-primary hover:text-brand'
    }`
  const count = (n) => <span className='ms-auto text-caption opacity-80'>{localizeDigits(String(n))}</span>

  /* A render helper, not a component, so buttons inside keep focus across re-renders */
  const section = (Icon, title, children) => (
    <fieldset className='border-b border-line pb-5 last:border-0'>
      <legend className='mb-3 flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-ink-2'>
        <Icon aria-hidden='true' className='size-4 text-brand' />
        {title}
      </legend>
      {children}
    </fieldset>
  )

  const optionList = (key, options, label, max = 8) => {
    const counts = facet(key, options)
    return (
      <div className='flex flex-col gap-1.5'>
        {options.slice(0, max).map((option) => (
          <button
            key={option}
            type='button'
            aria-pressed={filters[key] === option}
            disabled={!counts[option] && filters[key] !== option}
            onClick={() => toggle(key, option)}
            className={`${chip(filters[key] === option)} w-full justify-start text-start`}
          >
            <span className='truncate'>{label(option)}</span>
            {count(counts[option])}
          </button>
        ))}
      </div>
    )
  }

  const genders = ['Female', 'Male'].filter((g) => rows.some((row) => row.gender === g))
  const titles = TITLE_OPTIONS.filter((v) => rows.some((row) => row.title === v))
  const languages = [...new Set(rows.flatMap((row) => row.languages))]
  const ratingCounts = facet('minRating', RATING_OPTIONS)
  const payCounts = facet('pay', ['cash', 'online'])
  const offerCount = facet('offer', [true]).true

  const filterPanel = (
    <div className='flex flex-col gap-5'>
      {section(Stethoscope, t('Speciality'), optionList('speciality', catalogue.specialities, specialityLabel, 20))}
      {catalogue.areas.length > 0 && section(MapPin, t('Area'), optionList('area', catalogue.areas.map((a) => a.key), areaLabel, 30))}
      {section(CreditCard, t('Visit fee'), (
        <>
          <PriceFilter prices={pricesForHistogram} value={filters.maxPrice} onChange={(value) => setFilter('maxPrice', value)} />
          <div className='mt-4 grid grid-cols-2 gap-2'>
            {['cash', 'online'].map((value) => (
              <button key={value} type='button' aria-pressed={filters.pay === value} disabled={!payCounts[value] && filters.pay !== value} onClick={() => toggle('pay', value)} className={chip(filters.pay === value)}>
                {filterLabel('pay', value)}
              </button>
            ))}
          </div>
          {(offerCount > 0 || filters.offer) && (
            <button type='button' aria-pressed={filters.offer} onClick={() => setFilter('offer', !filters.offer)} className={`${chip(filters.offer)} mt-2 w-full`}>
              <Tag aria-hidden='true' className='size-4' />
              {t('Has an offer')}
              {count(offerCount)}
            </button>
          )}
        </>
      ))}
      {section(Star, t('Patient rating'), (
        <>
          <div className='grid grid-cols-2 gap-2'>
            {RATING_OPTIONS.map((value) => (
              <button key={value} type='button' aria-pressed={filters.minRating === value} disabled={!ratingCounts[value] && filters.minRating !== value} onClick={() => toggle('minRating', value)} className={chip(filters.minRating === value)}>
                {filterLabel('minRating', value)}
                {count(ratingCounts[value])}
              </button>
            ))}
          </div>
          <p className='mt-2 text-caption text-ink-3'>{t('Only doctors rated by patients after a visit.')}</p>
        </>
      ))}
      {(genders.length > 1 || titles.length > 0) && section(UserRound, t('Doctor'), (
        <>
          {genders.length > 1 && <div className='grid grid-cols-2 gap-2'>{genders.map((g) => <button key={g} type='button' aria-pressed={filters.gender === g} onClick={() => toggle('gender', g)} className={chip(filters.gender === g)}>{t(g)}</button>)}</div>}
          {titles.length > 0 && <div className='mt-2 grid grid-cols-2 gap-2'>{titles.map((v) => <button key={v} type='button' aria-pressed={filters.title === v} onClick={() => toggle('title', v)} className={chip(filters.title === v)}>{t(v)}</button>)}</div>}
        </>
      ))}
      {languages.length > 0 && section(Sparkles, t('Languages spoken'), optionList('language', languages, (v) => v))}
    </div>
  )

  const understood = ['speciality', 'area', 'mode', 'when', 'maxPrice', 'gender', 'sort'].filter((key) => parsed[key] != null && parsed.spans[key]?.length)

  return (
    <div className='mx-auto w-full max-w-7xl px-gutter pb-section'>
      <header className='pt-8 sm:pt-12'>
        <p className='text-caption font-semibold uppercase tracking-wide text-brand'>{t('Doctors')}</p>
        <h1 className='mt-2 font-display text-display text-ink'>{t(headingByMode[mode] || 'Find Your Doctor')}</h1>
        <p className='mt-3 max-w-2xl text-body text-ink-2'>{t('Describe what you need in your own words, or narrow the list with filters. Every time shown is a real opening from the doctor’s schedule.')}</p>
      </header>

      {/* Search: understands plain English and Arabic */}
      <form role='search' className='mt-6' onSubmit={(event) => { event.preventDefault(); resultsRef.current?.focus() }}>
        <label htmlFor='doctor-search' className='sr-only'>{t('Search doctors')}</label>
        <div className='relative'>
          <Search aria-hidden='true' className='pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-ink-3' />
          <input
            id='doctor-search'
            type='search'
            enterKeyHint='search'
            autoComplete='off'
            value={explicit.q}
            onChange={(event) => go({ ...explicit, q: event.target.value }, true)}
            placeholder={t('Try “skin rash in Maadi under 500 tomorrow”')}
            className='h-14 w-full rounded-control border border-field bg-surface ps-12 pe-12 text-body text-ink shadow-e1 outline-none transition placeholder:text-ink-3 focus:border-primary focus:shadow-e2'
          />
          {explicit.q && (
            <button type='button' onClick={() => go({ ...explicit, q: '' })} aria-label={t('Clear search')} className='absolute end-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 hover:bg-surface-sunken hover:text-ink'>
              <X aria-hidden='true' className='size-4' />
            </button>
          )}
        </div>
        {(understood.length > 0 || parsed.clarify || parsed.missingSpeciality || unknownTerms.length > 0) && (
          <div className='mt-3 flex flex-wrap items-center gap-2 text-body-sm' aria-live='polite'>
            {understood.length > 0 && <span className='text-ink-3'>{t('Understood:')}</span>}
            {understood.map((key) => (
              <button key={key} type='button' onClick={() => dropUnderstood(key)} className='inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 font-medium text-brand animate-rise hover:brightness-95' aria-label={fill(t('Remove {{filter}}'), { filter: key === 'sort' ? t(SORT_LABELS[parsed.sort]) : filterLabel(key, parsed[key]) })}>
                {key === 'speciality' && parsed.specialityFromSymptom && <Sparkles aria-hidden='true' className='size-3.5' />}
                {key === 'sort' ? t(SORT_LABELS[parsed.sort]) : filterLabel(key, parsed[key])}
                <X aria-hidden='true' className='size-3.5' />
              </button>
            ))}
            {parsed.clarify === 'adult_or_child' && (
              <span className='inline-flex flex-wrap items-center gap-2'>
                <span className='text-ink-2'>{t('Is this for an adult or a child?')}</span>
                {catalogue.specialities.includes('General physician') && <button type='button' onClick={() => setFilter('speciality', 'General physician')} className={chip(false)}>{t('Adult')}</button>}
                {catalogue.specialities.includes('Pediatricians') && <button type='button' onClick={() => setFilter('speciality', 'Pediatricians')} className={chip(false)}>{t('Child')}</button>}
              </span>
            )}
            {parsed.missingSpeciality && (
              <span className='rounded-full bg-warning-soft px-3 py-1 text-warning-ink'>{t('Clinivo has no doctor in that speciality yet.')}</span>
            )}
            {unknownTerms.length > 0 && (
              <span className='text-ink-3'>{fill(t('No doctor matches “{{words}}”, so it was ignored.'), { words: unknownTerms.join(' ') })}</span>
            )}
          </div>
        )}
        {parsed.specialityFromSymptom && (
          <p className='mt-2 text-caption text-ink-3'>{t('Suggested from the symptoms you typed. This is not a diagnosis. In an emergency call 123.')}</p>
        )}
      </form>

      {/* Visit type and day: the two choices most people make first */}
      <div className='mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
        <div role='group' aria-label={t('Visit type')} className='-mx-gutter flex gap-2 overflow-x-auto px-gutter pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0'>
          {VISIT_MODES.map((key) => {
            const { icon: Icon, label } = MODE_META[key]
            return (
              <button key={key} type='button' aria-pressed={mode === key} disabled={!modeCounts[key] && mode !== key} onClick={() => toggle('mode', key)} className={`${chip(mode === key)} shrink-0`}>
                <Icon aria-hidden='true' className='size-4' />
                {t(label)}
                <span className='text-caption opacity-80'>{localizeDigits(String(modeCounts[key]))}</span>
              </button>
            )
          })}
        </div>
        <div role='group' aria-label={t('Available')} className='-mx-gutter flex gap-2 overflow-x-auto px-gutter pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0'>
          {WHEN_OPTIONS.map((key) => (
            <button key={key} type='button' aria-pressed={filters.when === key} disabled={!whenCounts[key] && filters.when !== key} onClick={() => toggle('when', key)} className={`${chip(filters.when === key)} shrink-0`}>
              <CalendarDays aria-hidden='true' className='size-4' />
              {t(WHEN_LABELS[key])}
              <span className='text-caption opacity-80'>{localizeDigits(String(whenCounts[key]))}</span>
            </button>
          ))}
        </div>
      </div>

      <div className='mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[17rem_1fr]'>
        <aside aria-label={t('Filters')} className='hidden lg:block'>
          <div className='sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-card border border-line bg-surface p-5 shadow-e1'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-subtitle font-semibold text-ink'>{t('Filters')}</h2>
              {activeKeys.length > 0 && <button type='button' onClick={clearAll} className='text-body-sm font-semibold text-brand hover:underline'>{t('Clear all')}</button>}
            </div>
            {filterPanel}
          </div>
        </aside>

        <section aria-labelledby='results-heading' className='min-w-0'>
          <div className='mb-4 flex flex-wrap items-center gap-3'>
            <h2 id='results-heading' ref={resultsRef} tabIndex={-1} className='text-subtitle font-semibold text-ink outline-none' aria-live='polite'>
              {loading ? t('Loading doctors…') : formatDoctorCountLabel(results.length, language, localizeDigits)}
            </h2>
            <Button variant='secondary' size='sm' className='lg:hidden' leadingIcon={<SlidersHorizontal aria-hidden='true' className='size-4' />} onClick={() => setShowFilters(true)}>
              {t('Filters')}
              {activeKeys.length > 0 && <span className='rounded-full bg-primary px-1.5 text-caption text-on-primary'>{localizeDigits(String(activeKeys.length))}</span>}
            </Button>
            <label className='ms-auto flex items-center gap-2 text-body-sm text-ink-2'>
              {t('Sort by')}
              <select value={sort} onChange={(event) => setFilter('sort', event.target.value === 'recommended' ? '' : event.target.value)} className='min-h-10 rounded-control border border-field bg-surface px-3 text-body-sm text-ink'>
                {SORTS.map((key) => <option key={key} value={key}>{t(SORT_LABELS[key])}</option>)}
              </select>
            </label>
          </div>

          {chosenKeys.length > 0 && (
            <ul className='mb-5 flex flex-wrap gap-2' aria-label={t('Active filters')}>
              {chosenKeys.map((key) => (
                <li key={key}>
                  <button
                    type='button'
                    onClick={() => (key === 'terms' ? go({ ...explicit, q: removeQueryPart(parsed, 'terms') }) : setFilter(key, key === 'maxPrice' ? null : key === 'offer' ? false : key === 'minRating' ? 0 : ''))}
                    className='inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1 text-body-sm text-ink hover:border-primary'
                    aria-label={fill(t('Remove {{filter}}'), { filter: filterLabel(key) })}
                  >
                    {filterLabel(key)}
                    <X aria-hidden='true' className='size-3.5' />
                  </button>
                </li>
              ))}
              <li><button type='button' onClick={clearAll} className='px-2 py-1 text-body-sm font-semibold text-brand hover:underline'>{t('Clear all')}</button></li>
            </ul>
          )}

          {loading ? (
            <DoctorListSkeleton count={6} />
          ) : results.length === 0 ? (
            <EmptyState
              icon={<Search aria-hidden='true' className='size-6' />}
              title={t('No doctors match all of that')}
              description={relaxations.length ? t('Loosen one filter to see doctors who are close:') : t('Try fewer words or clear the filters.')}
              action={
                <div className='flex flex-wrap justify-center gap-2'>
                  {relaxations.map(({ key, count: n }) => (
                    <Button key={key} variant='secondary' size='sm' onClick={() => (key === 'terms' ? go({ ...explicit, q: removeQueryPart(parsed, 'terms') }) : setFilter(key, key === 'maxPrice' ? null : key === 'offer' ? false : key === 'minRating' ? 0 : ''))}>
                      {fill(t('Without {{filter}}: {{count}}'), { filter: filterLabel(key), count: formatDoctorCountLabel(n, language, localizeDigits) })}
                    </Button>
                  ))}
                  <Button variant='ghost' size='sm' onClick={clearAll}>{t('Clear all')}</Button>
                </div>
              }
            />
          ) : (
            <>
              <ul className='grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4'>
                {shown.map((row, index) => (
                  <li key={row.id} className='animate-rise' style={{ animationDelay: `${Math.min(index % PAGE_SIZE, 8) * 40}ms` }}>
                    <DoctorCard row={row} mode={mode} now={now} priority={index < 3} />
                  </li>
                ))}
              </ul>
              {results.length > shown.length && (
                <div className='mt-8 flex justify-center'>
                  <Button variant='secondary' onClick={() => setVisible((n) => n + PAGE_SIZE)}>
                    {fill(t('Show more doctors ({{n}} left)'), { n: localizeDigits(String(results.length - shown.length)) })}
                  </Button>
                </div>
              )}
            </>
          )}

          {token && (
            <p className='mt-10 text-center text-body-sm text-ink-2'>
              <Link to='/my-appointments' className='font-semibold text-brand hover:underline'>{t('View My Appointments')}</Link>
            </p>
          )}
          <p className='mt-6 text-center text-caption text-ink-3'>
            {fill(t('{{doctors}} on Clinivo across {{specialities}} specialities.'), {
              doctors: formatDoctorCountLabel(stats.doctors, language, localizeDigits),
              specialities: localizeDigits(String(stats.specialities)),
            })}
          </p>
        </section>
      </div>

      <Modal
        open={showFilters}
        onClose={() => setShowFilters(false)}
        title={t('Filters')}
        size='lg'
        footer={
          <div className='flex w-full gap-3'>
            <Button variant='secondary' className='flex-1' onClick={clearAll}>{t('Clear all')}</Button>
            <Button className='flex-1' onClick={() => setShowFilters(false)} data-autofocus>
              {fill(t('Show {{count}}'), { count: formatDoctorCountLabel(results.length, language, localizeDigits) })}
            </Button>
          </div>
        }
      >
        {filterPanel}
      </Modal>
    </div>
  )
}

export default Doctors
