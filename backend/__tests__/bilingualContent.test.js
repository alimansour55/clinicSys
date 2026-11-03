import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../services/plainTextTranslateService.js', () => ({
  tryTranslatePlainText: vi.fn()
}))

import { tryTranslatePlainText } from '../services/plainTextTranslateService.js'
import { primaryText, resolveBilingualValue, translateForKind } from '../services/bilingualContentService.js'
import { transliterateName } from '../utils/personNameTransliteration.js'
import { isLocalMongoUri } from '../utils/mongoUri.js'

const translator = vi.mocked(tryTranslatePlainText)

beforeEach(() => {
  translator.mockReset()
  translator.mockImplementation(async (text, target) => `${target}:${text}`)
})

describe('resolveBilingualValue', () => {
  it('generates Arabic when the admin types English', async () => {
    const value = await resolveBilingualValue({ input: { en: 'Sunny clinic', source: 'en' } })
    expect(value).toMatchObject({ en: 'Sunny clinic', ar: 'ar:Sunny clinic', source: 'en', manual: false, status: 'complete' })
  })

  it('generates English when the admin types Arabic', async () => {
    const value = await resolveBilingualValue({ input: { ar: 'عيادة', source: 'ar' } })
    expect(value).toMatchObject({ ar: 'عيادة', en: 'en:عيادة', source: 'ar', status: 'complete' })
  })

  it('accepts a plain string from a form that is not converted yet', async () => {
    const value = await resolveBilingualValue({ input: 'عيادة' })
    expect(value).toMatchObject({ ar: 'عيادة', en: 'en:عيادة', source: 'ar' })
  })

  it('keeps both sides when the admin typed both', async () => {
    const value = await resolveBilingualValue({ input: { en: 'Clinic', ar: 'عيادة' } })
    expect(value).toMatchObject({ en: 'Clinic', ar: 'عيادة', manual: true, status: 'complete' })
    expect(translator).not.toHaveBeenCalled()
  })

  it('marks a corrected translation as manual', async () => {
    const previous = { en: 'Clinic', ar: 'ar:Clinic', source: 'en' }
    const value = await resolveBilingualValue({ previous, input: { en: 'Clinic', ar: 'عيادتي', source: 'en' } })
    expect(value).toMatchObject({ en: 'Clinic', ar: 'عيادتي', manual: true })
    expect(translator).not.toHaveBeenCalled()
  })

  it('keeps a hand correction when the record is saved again unchanged', async () => {
    const previous = { en: 'Clinic', ar: 'عيادتي', source: 'en', manual: true }
    const value = await resolveBilingualValue({ previous, input: { en: 'Clinic', ar: 'عيادتي', source: 'en' } })
    expect(value).toMatchObject({ ar: 'عيادتي', manual: true })
    expect(translator).not.toHaveBeenCalled()
  })

  it('keeps a hand correction when an old form posts the same plain text', async () => {
    const previous = { en: 'Clinic', ar: 'عيادتي', source: 'en', manual: true }
    const value = await resolveBilingualValue({ previous, input: 'Clinic' })
    expect(value).toMatchObject({ ar: 'عيادتي', manual: true })
    expect(translator).not.toHaveBeenCalled()
  })

  it('replaces a hand correction once the source text changes', async () => {
    const previous = { en: 'Clinic', ar: 'عيادتي', source: 'en', manual: true }
    const value = await resolveBilingualValue({
      previous,
      input: { en: 'Main clinic', ar: 'عيادتي', source: 'en', manual: false }
    })
    expect(value).toMatchObject({ en: 'Main clinic', ar: 'ar:Main clinic', manual: false })
  })

  it('keeps a correction made together with a source change', async () => {
    const previous = { en: 'Clinic', ar: 'ar:Clinic', source: 'en' }
    const value = await resolveBilingualValue({
      previous,
      input: { en: 'Main clinic', ar: 'العيادة الرئيسية', source: 'en', manual: true }
    })
    expect(value).toMatchObject({ en: 'Main clinic', ar: 'العيادة الرئيسية', manual: true })
  })

  it('saves as pending with a blank side when the translator is down', async () => {
    translator.mockResolvedValue(null)
    const value = await resolveBilingualValue({ input: { en: 'Clinic', source: 'en' } })
    expect(value).toMatchObject({ en: 'Clinic', ar: '', status: 'pending', attempts: 1 })
    expect(value.lastAttemptAt).toBeGreaterThan(0)
  })

  it('never leaves an old translation behind a changed source when the translator is down', async () => {
    translator.mockResolvedValue(null)
    const previous = { en: 'Clinic', ar: 'عيادة', source: 'en' }
    const value = await resolveBilingualValue({ previous, input: { en: 'Pharmacy', ar: 'عيادة', source: 'en', manual: false } })
    expect(value).toMatchObject({ en: 'Pharmacy', ar: '', status: 'pending' })
  })

  it('accepts a fresh suggestion from the form when the translator has since gone down', async () => {
    translator.mockResolvedValue(null)
    const value = await resolveBilingualValue({ input: { en: 'Pharmacy', ar: 'صيدلية', source: 'en', manual: false } })
    expect(value).toMatchObject({ en: 'Pharmacy', ar: 'صيدلية', manual: false, status: 'complete' })
  })

  it('completes a pending field on retry', async () => {
    const previous = { en: 'Clinic', ar: '', source: 'en', status: 'pending', attempts: 2 }
    const value = await resolveBilingualValue({ previous, input: { en: 'Clinic', ar: '', source: 'en' } })
    expect(value).toMatchObject({ ar: 'ar:Clinic', status: 'complete', attempts: 0 })
  })

  it('counts another attempt when a retry fails', async () => {
    translator.mockResolvedValue(null)
    const previous = { en: 'Clinic', ar: '', source: 'en', status: 'pending', attempts: 2 }
    const value = await resolveBilingualValue({ previous, input: { en: 'Clinic', ar: '', source: 'en' } })
    expect(value).toMatchObject({ status: 'pending', attempts: 3 })
  })

  it('returns an empty field for empty input', async () => {
    const value = await resolveBilingualValue({ input: { en: '  ', ar: '' } })
    expect(value).toMatchObject({ en: '', ar: '', status: 'complete' })
  })

  it('switches the source when the admin clears it and leaves the other side', async () => {
    const previous = { en: 'Clinic', ar: 'عيادة', source: 'en' }
    const value = await resolveBilingualValue({ previous, input: { en: '', ar: 'عيادة', source: 'en' } })
    expect(value).toMatchObject({ source: 'ar', ar: 'عيادة', en: 'en:عيادة' })
  })
})

describe('translateForKind', () => {
  it('never sends a person name to a translator', async () => {
    expect(await translateForKind('Ahmed Hassan', 'ar', 'name')).toBe(transliterateName('Ahmed Hassan', 'ar'))
    expect(translator).not.toHaveBeenCalled()
  })

  it('uses the reviewed list for clinic labels, in both directions', async () => {
    expect(await translateForKind('Dermatologist', 'ar', 'label')).toBe('الجلدية')
    expect(await translateForKind('الجلدية', 'en', 'label')).toBe('Dermatologist')
    expect(translator).not.toHaveBeenCalled()
  })

  it('uses the known place list, in both directions', async () => {
    expect(await translateForKind('Zamalek', 'ar', 'place')).toBe('الزمالك')
    expect(await translateForKind('الزمالك', 'en', 'place')).toBe('Zamalek')
    expect(translator).not.toHaveBeenCalled()
  })

  it('falls through to the translator for unknown text', async () => {
    expect(await translateForKind('A long bio', 'ar', 'text')).toBe('ar:A long bio')
    expect(translator).toHaveBeenCalledWith('A long bio', 'ar', { allowOpenAI: true })
  })

  it('copies text with no letters as it is', async () => {
    expect(await translateForKind('12 / 5', 'ar', 'text')).toBe('12 / 5')
    expect(translator).not.toHaveBeenCalled()
  })

  it('gives up when the translator runs past the budget', async () => {
    translator.mockImplementation(() => new Promise(() => {}))
    expect(await translateForKind('Slow', 'ar', 'text', { budgetMs: 5 })).toBeNull()
  })
})

describe('transliterateName', () => {
  it('uses known spellings rather than meaning', () => {
    expect(transliterateName('Ahmed', 'ar')).toBe('أحمد')
    expect(transliterateName('أحمد', 'en')).toBe('Ahmed')
  })

  it('handles unknown names letter by letter, both ways', () => {
    expect(transliterateName('Zidan', 'ar')).toMatch(/[؀-ۿ]/)
    expect(transliterateName('زيدان', 'en')).toMatch(/^Z[a-z]+$/)
  })

  it('carries titles across', () => {
    expect(transliterateName('Dr. Ahmed', 'ar')).toBe('د. أحمد')
    expect(transliterateName('د. أحمد', 'en')).toBe('Dr. Ahmed')
  })

  it('handles the common Arabic name prefixes', () => {
    expect(transliterateName('الشريف', 'en')).toMatch(/^El-/)
    expect(transliterateName('عبدالله', 'en')).toMatch(/^Abdel/)
  })

  it('leaves a name already in the target script alone', () => {
    expect(transliterateName('أحمد', 'ar')).toBe('أحمد')
    expect(transliterateName('Ahmed', 'en')).toBe('Ahmed')
  })
})

describe('primaryText', () => {
  it('prefers English so existing lookups keep working', () => {
    expect(primaryText({ en: 'Clinic', ar: 'عيادة' })).toBe('Clinic')
    expect(primaryText({ ar: 'عيادة' })).toBe('عيادة')
    expect(primaryText(' Clinic ')).toBe('Clinic')
    expect(primaryText(undefined)).toBe('')
  })
})

describe('isLocalMongoUri', () => {
  it('accepts only this machine', () => {
    expect(isLocalMongoUri('mongodb://127.0.0.1:27017/x')).toBe(true)
    expect(isLocalMongoUri('mongodb://localhost/x')).toBe(true)
    expect(isLocalMongoUri('mongodb://user:pw@127.0.0.1:27017/x')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isLocalMongoUri('mongodb+srv://cluster0.example.mongodb.net/x')).toBe(false)
    expect(isLocalMongoUri('mongodb://db.example.com:27017/x')).toBe(false)
    expect(isLocalMongoUri('mongodb://127.0.0.1:27017,db.example.com:27017/x')).toBe(false)
    expect(isLocalMongoUri('')).toBe(false)
    expect(isLocalMongoUri(undefined)).toBe(false)
  })
})
