import { describe, expect, it } from 'vitest'
import { parseDoctorQuery, removeQueryPart } from './queryParser'
import { normalizeSearchText } from './searchText'

const catalogue = {
  specialities: ['Dermatologist', 'Pediatricians', 'General physician', 'Gastroenterologist'],
  areas: [
    { key: 'new cairo', labels: ['New Cairo', 'القاهرة الجديدة', 'التجمع'] },
    { key: 'nasr city', labels: ['Nasr City', 'مدينة نصر'] },
  ],
}

describe('normalizeSearchText', () => {
  it('unifies Arabic letter forms and digits', () => {
    expect(normalizeSearchText('أقل من ٥٠٠ جنيهاً')).toBe('اقل من 500 جنيها')
    expect(normalizeSearchText('مدينة  نصر')).toBe('مدينه نصر')
  })
})

describe('parseDoctorQuery', () => {
  it('reads a full English request', () => {
    const q = parseDoctorQuery('skin rash in New Cairo under 500 tomorrow by video', catalogue)
    expect(q).toMatchObject({ speciality: 'Dermatologist', area: 'new cairo', maxPrice: 500, when: 'tomorrow', mode: 'tele' })
    expect(q.terms).toEqual([])
  })

  it('reads Egyptian Arabic with attached prefixes', () => {
    const q = parseDoctorQuery('دكتورة أطفال بالفيديو النهارده في مدينة نصر', catalogue)
    expect(q).toMatchObject({ speciality: 'Pediatricians', gender: 'Female', mode: 'tele', when: 'today', area: 'nasr city' })
  })

  it('reads an Arabic price with Arabic-Indic digits', () => {
    expect(parseDoctorQuery('جلدية أقل من ٤٠٠ جنيه', catalogue)).toMatchObject({ speciality: 'Dermatologist', maxPrice: 400 })
  })

  it('maps symptoms to a speciality only when that speciality exists', () => {
    expect(parseDoctorQuery('my baby has a cough', catalogue)).toMatchObject({ speciality: 'Pediatricians', specialityFromSymptom: true })
    expect(parseDoctorQuery('heart doctor', catalogue)).toMatchObject({ missingSpeciality: 'cardiologist' })
    expect(parseDoctorQuery('heart doctor', catalogue).speciality).toBeUndefined()
  })

  it('tells video calls from voice calls', () => {
    expect(parseDoctorQuery('video call', catalogue).mode).toBe('tele')
    expect(parseDoctorQuery('phone call', catalogue).mode).toBe('voice')
    expect(parseDoctorQuery('home visit today', catalogue)).toMatchObject({ mode: 'home', when: 'today' })
  })

  it('keeps names as free text and drops filler words', () => {
    const q = parseDoctorQuery('I need doctor Sara please', catalogue)
    expect(q.terms).toEqual(['sara'])
  })

  it('does not treat "female" as "male"', () => {
    expect(parseDoctorQuery('female dermatologist', catalogue)).toMatchObject({ gender: 'Female', speciality: 'Dermatologist' })
  })

  it('removes the words behind one understood filter', () => {
    const q = parseDoctorQuery('dermatologist in New Cairo tomorrow', catalogue)
    expect(removeQueryPart(q, 'area')).toBe('dermatologist in tomorrow')
    expect(removeQueryPart(q, 'when')).toBe('dermatologist in New Cairo')
  })
})
