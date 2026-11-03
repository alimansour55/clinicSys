/**
 * Saves admin-entered content in both languages on the record itself, so it does not depend on a
 * translator being up when someone views it. See DESIGN_SYSTEM.md for how to apply it to a form.
 *
 * Field config: { name: { kind: 'name' | 'label' | 'place' | 'text' } }
 * - name:  a person. Transliterated offline, never translated by meaning.
 * - label: a short department or speciality. Reviewed list first, then machine translation.
 * - place: an address or area. Known places first, then machine translation.
 * - text:  sentences. Machine translation.
 */
import { CLINIC_LABELS } from '../data/clinicLabels.js'
import { PLACE_NAMES_LATIN_TO_AR } from '../data/placeNamesLatinToAr.js'
import { transliterateName } from '../utils/personNameTransliteration.js'
import { tryTranslatePlainText } from './plainTextTranslateService.js'

const hasArabic = (s) => /[؀-ۿ]/.test(String(s || ''))
const hasLetters = (s) => /[A-Za-z؀-ۿ]/.test(String(s || ''))
const clean = (s) => String(s ?? '').trim()
const other = (language) => (language === 'en' ? 'ar' : 'en')
const norm = (s) => clean(s).toLowerCase().replace(/\s+/g, ' ')

/** How long a save may wait for a translator before it is stored as pending. */
const TRANSLATE_BUDGET_MS = 12_000
/** Leave a failed record alone for this long before trying again. */
const RETRY_AFTER_MS = 10 * 60_000

const titleCase = (s) => s.replace(/_/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase())

const PLACES_AR_TO_LATIN = {}
for (const [latin, arabic] of Object.entries(PLACE_NAMES_LATIN_TO_AR)) {
  /* Spaced keys read best, so they beat compact spellings like "nasrcity" */
  if (!PLACES_AR_TO_LATIN[arabic] || latin.includes(' ')) PLACES_AR_TO_LATIN[arabic] = titleCase(latin)
}

const lookupLabel = (text, target) => {
  const from = other(target)
  return CLINIC_LABELS.find((label) => norm(label[from]) === norm(text))?.[target] || ''
}

const lookupPlace = (text, target) => {
  if (target === 'en') return PLACES_AR_TO_LATIN[clean(text)] || ''
  const key = norm(text).replace(/[^a-z0-9 ]/g, '')
  return (
    PLACE_NAMES_LATIN_TO_AR[key] ||
    PLACE_NAMES_LATIN_TO_AR[key.replace(/\s+/g, '')] ||
    PLACE_NAMES_LATIN_TO_AR[key.replace(/\s+/g, '_')] ||
    ''
  )
}

const withBudget = (promise, ms) => {
  let timer
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** @returns {Promise<string|null>} null when no translation could be produced right now */
export async function translateForKind(text, target, kind = 'text', { budgetMs = TRANSLATE_BUDGET_MS } = {}) {
  const raw = clean(text)
  if (!raw) return ''
  if (!hasLetters(raw)) return raw
  if (kind === 'name') return transliterateName(raw, target) || null
  if (kind === 'label') {
    const known = lookupLabel(raw, target) || lookupPlace(raw, target)
    if (known) return known
  }
  if (kind === 'place') {
    const known = lookupPlace(raw, target)
    if (known) return known
  }
  return withBudget(tryTranslatePlainText(raw, target, { allowOpenAI: true }), budgetMs)
}

const EMPTY = { en: '', ar: '', source: 'en', manual: false, status: 'complete', attempts: 0, lastAttemptAt: 0 }

const readStored = (stored) => {
  if (!stored || (!clean(stored.en) && !clean(stored.ar))) return null
  return {
    en: clean(stored.en),
    ar: clean(stored.ar),
    source: stored.source === 'ar' ? 'ar' : 'en',
    manual: stored.manual === true,
    status: stored.status === 'pending' ? 'pending' : 'complete',
    attempts: Number(stored.attempts) || 0,
    lastAttemptAt: Number(stored.lastAttemptAt) || 0
  }
}

/* A plain string comes from a form not yet converted: work out which language it is */
const readInput = (input, previous) => {
  if (typeof input === 'string') {
    const text = clean(input)
    if (previous && (text === previous.en || text === previous.ar)) return { ...previous }
    const source = hasArabic(text) ? 'ar' : 'en'
    return { en: source === 'en' ? text : '', ar: source === 'ar' ? text : '', source }
  }
  const en = clean(input?.en)
  const ar = clean(input?.ar)
  const wanted = input?.source === 'ar' || input?.source === 'en' ? input.source : previous?.source
  const fallback = en ? 'en' : 'ar'
  return { en, ar, source: wanted && clean(input?.[wanted]) ? wanted : fallback, manual: input?.manual }
}

/**
 * Works out what to store. Never throws for translator failures: the record saves as pending.
 * A hand correction survives every save until the source text itself changes.
 */
export async function resolveBilingualValue({ previous, input, kind = 'text', budgetMs }) {
  const prev = readStored(previous)
  const next = readInput(input, prev)
  if (!next.en && !next.ar) return { ...EMPTY }

  const source = next.source
  const target = other(source)
  const sourceText = next[source]
  const targetText = next[target]
  const sourceChanged = prev?.[source] !== sourceText
  const targetChanged = (prev?.[target] ?? '') !== targetText

  const stored = (values) => ({
    en: sourceText && source === 'en' ? sourceText : values.en ?? targetText,
    ar: sourceText && source === 'ar' ? sourceText : values.ar ?? targetText,
    source,
    manual: false,
    status: 'complete',
    attempts: 0,
    lastAttemptAt: 0,
    ...values
  })

  if (!sourceChanged && !targetChanged && prev && !(prev.status === 'pending' && !targetText)) return prev

  const handTyped =
    Boolean(targetText) &&
    (next.manual === true || !sourceChanged || (next.manual === undefined && (targetChanged || !prev)))
  if (handTyped) return stored({ manual: true })

  const translated = await translateForKind(sourceText, target, kind, { budgetMs })
  if (translated) return stored({ [target]: translated })

  /* A fresh suggestion the admin saw in the form beats nothing. An unchanged one is out of date. */
  if (targetText && next.manual === false && targetChanged) return stored({ [target]: targetText })

  /* Blank, not the source text in the wrong language: display falls back to the other side */
  return stored({
    [target]: '',
    status: 'pending',
    attempts: (prev?.attempts || 0) + 1,
    lastAttemptAt: Date.now()
  })
}

/**
 * Applies a request body to a Mongoose document: reads `<field>I18n` ({ en, ar, source, manual })
 * or the plain `<field>` string, and sets `i18n.<field>`. It leaves the plain fields to the
 * controller, because renaming one can have side effects there.
 */
export async function applyBilingualFields(doc, fields, body = {}) {
  for (const [field, { kind }] of Object.entries(fields)) {
    const input = body[`${field}I18n`] ?? body[field]
    if (input === undefined) continue
    const previous = doc.i18n?.[field]
    const value = await resolveBilingualValue({ previous, input, kind })
    doc.set(`i18n.${field}`, value)
  }
  return doc
}

/** The value for an old plain field: English when there is one, so existing lookups keep working. */
export const primaryText = (input) => {
  if (input === undefined || input === null) return ''
  if (typeof input === 'string') return clean(input)
  return clean(input.en) || clean(input.ar)
}

const pendingQuery = (fields) => ({
  $or: Object.keys(fields).map((field) => ({ [`i18n.${field}.status`]: 'pending' }))
})

export const countPendingBilingual = (model, fields) => model.countDocuments(pendingQuery(fields))

/** Retries records whose translation failed. Bounded, because it can run inside a request. */
export async function retryPendingBilingual(model, fields, { limit = 3, deadlineMs = 5_000, force = false } = {}) {
  const docs = await model.find(pendingQuery(fields)).limit(limit)
  const started = Date.now()
  let completed = 0
  let stillPending = 0

  for (const doc of docs) {
    for (const [field, { kind }] of Object.entries(fields)) {
      const current = doc.i18n?.[field]
      if (current?.status !== 'pending') continue
      const remaining = deadlineMs - (Date.now() - started)
      const tooSoon = !force && Date.now() - (current.lastAttemptAt || 0) < RETRY_AFTER_MS
      if (remaining <= 0 || tooSoon) {
        stillPending += 1
        continue
      }
      const value = await resolveBilingualValue({
        previous: current,
        input: { en: current.en, ar: current.ar, source: current.source },
        kind,
        budgetMs: remaining
      })
      await model.updateOne({ _id: doc._id }, { $set: { [`i18n.${field}`]: value } })
      if (value.status === 'pending') stillPending += 1
      else completed += 1
    }
  }
  return { completed, stillPending }
}

/**
 * Fills `i18n` for records that predate it, from their plain fields. Safe to run repeatedly: a
 * finished field is skipped and hand corrections are never touched. A dry run calls no translator.
 */
export async function backfillBilingual(model, fields, { dryRun = true, log = () => {} } = {}) {
  const summary = { scanned: 0, wouldFill: 0, filled: 0, pending: 0, skipped: 0 }
  const docs = await model.find({}).lean()

  for (const doc of docs) {
    summary.scanned += 1
    for (const [field, { kind }] of Object.entries(fields)) {
      const stored = doc.i18n?.[field]
      const plain = clean(doc[field])
      const done = readStored(stored) && stored.status !== 'pending'
      if (done || (!plain && !readStored(stored))) {
        summary.skipped += 1
        continue
      }
      if (dryRun) {
        summary.wouldFill += 1
        log(`would fill ${doc._id} ${field}: ${plain.slice(0, 60)}`)
        continue
      }
      const input = readStored(stored) ? { en: stored.en, ar: stored.ar, source: stored.source } : plain
      const value = await resolveBilingualValue({ previous: stored, input, kind })
      await model.updateOne({ _id: doc._id }, { $set: { [`i18n.${field}`]: value } })
      if (value.status === 'pending') summary.pending += 1
      else summary.filled += 1
      log(`${value.status} ${doc._id} ${field}`)
    }
  }
  return summary
}
