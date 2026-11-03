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
 * Where a field's stored value lives: `name` is at `i18n.name`, `footer.title` at `footer.i18n.title`.
 * A field can name its own home with `i18n`, which array fields use.
 */
export const i18nPathOf = (field, config = {}) => {
  if (config.i18n) return config.i18n
  const parts = field.split('.')
  const leaf = parts.pop()
  return [...parts, 'i18n', leaf].join('.')
}

const readPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object)

const plainTextOf = (doc, field, config) => (config.plain ? config.plain(doc) : readPath(doc, field))

/** Multipart forms post `<field>I18n` as JSON text. Everything else is left as it came. */
const readI18nBody = (raw) => {
  if (typeof raw !== 'string') return raw
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : raw
  } catch {
    return raw
  }
}

/**
 * The input for each field in a request body. `<field>I18n` wins over the plain `<field>`. A field
 * marked `i18nOnly` ignores the plain one, because its plain value is not text (a doctor's address).
 */
export const readBilingualInputs = (fields, body = {}) => {
  const inputs = {}
  for (const [field, config] of Object.entries(fields)) {
    const i18n = readI18nBody(body[`${field}I18n`])
    const input = i18n ?? (config.i18nOnly ? undefined : body[field])
    if (input !== undefined && input !== null) inputs[field] = input
  }
  return inputs
}

const isBlankInput = (input) =>
  typeof input === 'string' ? !clean(input) : !clean(input?.en) && !clean(input?.ar)

/**
 * Resolves several fields at once, in parallel because a settings form has a dozen of them.
 * Blank inputs are skipped when `keepBlank` is set, so a cleared box keeps the saved text.
 * @returns {Promise<Record<string, object>>} the value to store for each field that was supplied
 */
export async function resolveBilingualFields({ previous = {}, fields, body = {}, keepBlank = false }) {
  const inputs = readBilingualInputs(fields, body)
  const resolved = {}
  await Promise.all(
    Object.entries(inputs).map(async ([field, input]) => {
      if (keepBlank && isBlankInput(input)) return
      resolved[field] = await resolveBilingualValue({ previous: previous?.[field], input, kind: fields[field].kind })
    })
  )
  return resolved
}

/** The plain field's value once both languages are known. English first, so lookups keep working. */
export const primaryOf = (value) => clean(value?.en) || clean(value?.ar)

/**
 * Applies a request body to a Mongoose document: reads `<field>I18n` ({ en, ar, source, manual })
 * or the plain `<field>` string, and sets `i18n.<field>`. It leaves the plain fields to the
 * controller, because renaming one can have side effects there.
 */
export async function applyBilingualFields(doc, fields, body = {}) {
  const resolved = await resolveBilingualFields({ previous: doc.i18n, fields, body })
  for (const [field, value] of Object.entries(resolved)) {
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
  $or: Object.entries(fields).map(([field, config]) => ({ [`${i18nPathOf(field, config)}.status`]: 'pending' }))
})

export const countPendingBilingual = (model, fields) => model.countDocuments(pendingQuery(fields))

/* An `each` field is an array of stored values rather than one. Yields every value with its own path. */
const storedEntries = (doc, field, config) => {
  const path = i18nPathOf(field, config)
  const stored = readPath(doc, path)
  if (!config.each) return [{ path, stored }]
  return (Array.isArray(stored) ? stored : []).map((item, index) => ({ path: `${path}.${index}`, stored: item }))
}

/* strict: false because a model can hold i18n before its schema declares it. See the registry. */
const writeStored = (model, id, path, value) =>
  model.updateOne({ _id: id }, { $set: { [path]: value } }, { strict: false })

/** Retries records whose translation failed. Bounded, because it can run inside a request. */
export async function retryPendingBilingual(model, fields, { limit = 3, deadlineMs = 5_000, force = false } = {}) {
  const docs = await model.find(pendingQuery(fields)).limit(limit).lean()
  const started = Date.now()
  let completed = 0
  let stillPending = 0

  for (const doc of docs) {
    for (const [field, config] of Object.entries(fields)) {
      for (const { path, stored: current } of storedEntries(doc, field, config)) {
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
          kind: config.kind,
          budgetMs: remaining
        })
        await writeStored(model, doc._id, path, value)
        if (value.status === 'pending') stillPending += 1
        else completed += 1
      }
    }
  }
  return { completed, stillPending }
}

/* An `each` field's list can be longer than what is stored, so walk the plain list instead */
const backfillEntries = (doc, field, config) => {
  if (!config.each) {
    return [{ path: i18nPathOf(field, config), stored: readPath(doc, i18nPathOf(field, config)), plain: clean(plainTextOf(doc, field, config)) }]
  }
  const path = i18nPathOf(field, config)
  const stored = readPath(doc, path)
  const plainList = plainTextOf(doc, field, config)
  return (Array.isArray(plainList) ? plainList : []).map((plain, index) => ({
    path: `${path}.${index}`,
    stored: Array.isArray(stored) ? stored[index] : undefined,
    plain: clean(plain)
  }))
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
    for (const [field, config] of Object.entries(fields)) {
      for (const { path, stored, plain } of backfillEntries(doc, field, config)) {
        const done = readStored(stored) && stored.status !== 'pending'
        if (done || (!plain && !readStored(stored))) {
          summary.skipped += 1
          continue
        }
        if (dryRun) {
          summary.wouldFill += 1
          log(`would fill ${doc._id} ${path}: ${plain.slice(0, 60)}`)
          continue
        }
        const input = readStored(stored) ? { en: stored.en, ar: stored.ar, source: stored.source } : plain
        const value = await resolveBilingualValue({ previous: stored, input, kind: config.kind })
        await writeStored(model, doc._id, path, value)
        if (value.status === 'pending') summary.pending += 1
        else summary.filled += 1
        log(`${value.status} ${doc._id} ${path}`)
      }
    }
  }
  return summary
}
