import { describe, expect, it } from 'vitest'
import { bilingualText, providerLabel, recordSearchTexts, recordText } from './bilingualContent'
import { doctorFieldText } from './doctorText'
import { siteField } from '../components/discovery/siteCopy'
import { buildDoctorRow } from '../components/discovery/doctorInsights'
import { normalizeSearchText } from '../components/discovery/searchText'

/* A tc() like the app's: the current language, else the other one. */
const tcFor = (language) => (value) => (value && typeof value === 'object' ? value[language] || value.en || value.ar : value)

const doctor = {
  _id: 'd1',
  name: 'Ahmed Ali',
  speciality: 'Dermatologist',
  degree: 'MBBS',
  about: 'Skin doctor.',
  address: { line1: 'Nasr City', line2: '' },
  i18n: {
    name: { en: 'Ahmed Ali', ar: 'أحمد علي', status: 'complete' },
    speciality: { en: 'Dermatologist', ar: 'جلدية', status: 'complete' },
    about: { en: 'Skin doctor.', ar: '', status: 'pending' },
  },
}

describe('bilingual content', () => {
  it('shows the stored value in the current language', () => {
    expect(recordText(tcFor('ar'), doctor, 'name')).toBe('أحمد علي')
    expect(recordText(tcFor('en'), doctor, 'name')).toBe('Ahmed Ali')
  })

  it('falls back to the other language while a translation is pending', () => {
    expect(recordText(tcFor('ar'), doctor, 'about')).toBe('Skin doctor.')
  })

  it('returns nothing for records without i18n or with both sides blank', () => {
    expect(recordText(tcFor('ar'), { name: 'Old' }, 'name')).toBe('')
    expect(bilingualText(tcFor('ar'), { en: '', ar: '', status: 'pending' })).toBe('')
    /* A bare tc() would hand back the object here, which React cannot render. */
    expect(bilingualText((value) => value, { en: '', ar: '' })).toBe('')
  })

  it('collects every language for search', () => {
    expect(recordSearchTexts(doctor, ['name', 'speciality'])).toEqual(['Ahmed Ali', 'Ahmed Ali', 'أحمد علي', 'Dermatologist', 'Dermatologist', 'جلدية'])
  })

  it('lets a doctor be found by either stored language', () => {
    const row = buildDoctorRow(doctor)
    expect(row.search).toContain(normalizeSearchText('أحمد علي'))
    expect(row.search).toContain(normalizeSearchText('جلدية'))
    expect(row.search).toContain('ahmed')
  })
})

describe('doctorFieldText', () => {
  it('prefers stored text and falls back to the plain field', () => {
    const ctx = { tc: tcFor('ar'), language: 'ar', textTranslationOverrides: {} }
    expect(doctorFieldText(doctor, 'speciality', ctx)).toBe('جلدية')
    expect(doctorFieldText(doctor, 'degree', ctx)).toBe('MBBS')
    expect(doctorFieldText(doctor, 'address', ctx)).toBe('Nasr City')
    expect(doctorFieldText({ name: 'Old Record' }, 'name', { tc: tcFor('en'), language: 'en' })).toBe('Old Record')
    expect(doctorFieldText(null, 'name', ctx)).toBe('')
  })
})

describe('providerLabel', () => {
  const labels = [
    { name: 'AXA', en: 'AXA', ar: 'أكسا', status: 'complete' },
    { name: 'Bupa', en: 'Bupa', ar: '', status: 'complete' },
  ]
  const fallback = (name) => (name === 'Bupa' ? 'بوبا' : '')

  it('uses the stored name in the current language', () => {
    expect(providerLabel({ tc: tcFor('ar'), language: 'ar' }, labels, 'AXA', fallback)).toBe('أكسا')
    expect(providerLabel({ tc: tcFor('en'), language: 'en' }, labels, 'أكسا', fallback)).toBe('AXA')
  })

  it('uses the built-in list when that language was never stored', () => {
    expect(providerLabel({ tc: tcFor('ar'), language: 'ar' }, labels, 'Bupa', fallback)).toBe('بوبا')
    expect(providerLabel({ tc: tcFor('ar'), language: 'ar' }, [], 'Unknown', fallback)).toBe('Unknown')
  })
})

describe('siteField', () => {
  const t = (value) => `t:${value}`

  it('reads the stored section text first', () => {
    const hero = { title: 'Hello', i18n: { title: { en: 'Hello', ar: 'مرحبا' } } }
    expect(siteField({ t, tc: tcFor('ar') }, hero, 'title')).toBe('مرحبا')
  })

  it('falls back to the plain field through t() for sections not backfilled', () => {
    expect(siteField({ t, tc: tcFor('ar') }, { title: 'Hello' }, 'title')).toBe('t:Hello')
    expect(siteField({ t, tc: tcFor('ar') }, {}, 'title')).toBeNull()
  })

  it('treats an old default in either language as not set', () => {
    const hero = { i18n: { title: { en: 'Book Appointment With 100+ Trusted Doctors', ar: 'احجز موعدك' } } }
    expect(siteField({ t, tc: tcFor('ar') }, hero, 'title', 5)).toBeNull()
  })
})
