import { describe, expect, it } from 'vitest'
import {
  collectDoctorAboutTextsNeedingTranslate,
  getTranslatedDoctorAbout,
} from './doctorAboutTranslate.js'

describe('doctorAboutTranslate', () => {
  it('uses curated Arabic for known English bios', () => {
    const en =
      'Experienced general physician specializing in chronic disease management, preventive care, and routine medical checkups.'
    const ar = getTranslatedDoctorAbout(en, 'ar', {})
    expect(ar).toContain('طبيب عام')
    expect(ar).not.toBe(en)
  })

  it('skips API translation for known English bios', () => {
    const doctors = [
      {
        about:
          'Experienced general physician specializing in chronic disease management, preventive care, and routine medical checkups.',
      },
    ]
    expect(collectDoctorAboutTextsNeedingTranslate(doctors, 'ar')).toHaveLength(0)
  })

  it('still collects unknown English bios', () => {
    const doctors = [{ about: 'A brand new biography not in the map.' }]
    expect(collectDoctorAboutTextsNeedingTranslate(doctors, 'ar')).toContain(
      'A brand new biography not in the map.'
    )
  })
})
