import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/plainTextTranslateService.js', () => ({
  tryTranslatePlainText: vi.fn(),
  resolvePlainTextTranslationsBatch: vi.fn(async () => ({}))
}))

import { tryTranslatePlainText } from '../../services/plainTextTranslateService.js'
import clinicModel, { clinicBilingualFields } from '../../models/clinicModel.js'
import {
  applyBilingualFields,
  backfillBilingual,
  retryPendingBilingual
} from '../../services/bilingualContentService.js'
import { clearTestDatabase, connectTestDatabase, disconnectTestDatabase } from '../helpers/db.js'

const translator = vi.mocked(tryTranslatePlainText)

const insertLegacy = (name, description = '') =>
  clinicModel.collection.insertOne({ name, description, active: true, date: 1 })

beforeAll(connectTestDatabase)
afterAll(disconnectTestDatabase)
beforeEach(async () => {
  await clearTestDatabase()
  translator.mockReset()
  translator.mockImplementation(async (text, target) => `${target}:${text}`)
})

describe('bilingual content on a real model', () => {
  it('stores both languages on the record', async () => {
    const clinic = new clinicModel({ name: 'Rare care', description: '', date: 1 })
    await applyBilingualFields(clinic, clinicBilingualFields, {
      nameI18n: { en: 'Rare care', source: 'en' },
      description: ''
    })
    await clinic.save()
    const saved = await clinicModel.findById(clinic._id).lean()
    expect(saved.i18n.name).toMatchObject({ en: 'Rare care', ar: 'ar:Rare care', source: 'en', status: 'complete' })
  })

  it('saves when the translator is down, then a retry completes it', async () => {
    translator.mockResolvedValue(null)
    const clinic = new clinicModel({ name: 'Rare care', description: '', date: 1 })
    await applyBilingualFields(clinic, clinicBilingualFields, { name: 'Rare care' })
    await clinic.save()
    expect((await clinicModel.findById(clinic._id).lean()).i18n.name.status).toBe('pending')

    /* Too soon: left alone */
    await retryPendingBilingual(clinicModel, clinicBilingualFields)
    expect(translator).toHaveBeenCalledTimes(1)

    translator.mockImplementation(async (text, target) => `${target}:${text}`)
    const result = await retryPendingBilingual(clinicModel, clinicBilingualFields, { force: true })
    expect(result).toEqual({ completed: 1, stillPending: 0 })
    expect((await clinicModel.findById(clinic._id).lean()).i18n.name).toMatchObject({ ar: 'ar:Rare care', status: 'complete' })
  })
})

describe('backfillBilingual', () => {
  it('writes nothing and calls no translator on a dry run', async () => {
    await insertLegacy('Rare care', 'About us')
    const summary = await backfillBilingual(clinicModel, clinicBilingualFields, { dryRun: true })
    expect(summary).toMatchObject({ scanned: 1, wouldFill: 2, filled: 0 })
    expect(translator).not.toHaveBeenCalled()
    expect((await clinicModel.findOne({ name: 'Rare care' }).lean()).i18n).toBeUndefined()
  })

  it('fills old records and is safe to run again', async () => {
    await insertLegacy('Dermatologist', 'About us')
    const first = await backfillBilingual(clinicModel, clinicBilingualFields, { dryRun: false })
    expect(first).toMatchObject({ filled: 2, pending: 0 })
    const saved = await clinicModel.findOne({ name: 'Dermatologist' }).lean()
    expect(saved.i18n.name).toMatchObject({ en: 'Dermatologist', ar: 'الجلدية' })
    expect(saved.i18n.description).toMatchObject({ en: 'About us', ar: 'ar:About us' })
    expect(saved.name).toBe('Dermatologist')

    translator.mockClear()
    const second = await backfillBilingual(clinicModel, clinicBilingualFields, { dryRun: false })
    expect(second).toMatchObject({ filled: 0, pending: 0, skipped: 2 })
    expect(translator).not.toHaveBeenCalled()
  })

  it('does not touch a hand correction', async () => {
    await clinicModel.collection.insertOne({
      name: 'Rare care',
      description: '',
      date: 1,
      i18n: { name: { en: 'Rare care', ar: 'رعاية خاصة', source: 'en', manual: true, status: 'complete' } }
    })
    await backfillBilingual(clinicModel, clinicBilingualFields, { dryRun: false })
    expect((await clinicModel.findOne({ name: 'Rare care' }).lean()).i18n.name.ar).toBe('رعاية خاصة')
  })

  it('leaves records pending when the translator is down, and finishes them later', async () => {
    await insertLegacy('Rare care')
    translator.mockResolvedValue(null)
    expect(await backfillBilingual(clinicModel, clinicBilingualFields, { dryRun: false })).toMatchObject({ pending: 1 })
    translator.mockImplementation(async (text, target) => `${target}:${text}`)
    expect(await backfillBilingual(clinicModel, clinicBilingualFields, { dryRun: false })).toMatchObject({ filled: 1, pending: 0 })
  })
})
