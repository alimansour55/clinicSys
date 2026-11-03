/**
 * Admin-entered content is stored in both languages on the record (`record.i18n.<field>`).
 * Show it with `tc(record.i18n?.name) || record.name`: tc() falls back to the other language
 * while a translation is pending, so a visitor never sees a blank.
 */

/** Key for an old-style label lookup that only knows a record's plain name. */
export const storedLabelKey = (name, language) => `${language}:${String(name || '').trim()}`

/** Map for label lookups: { 'ar:Dermatologist': '...', 'en:Dermatologist': '...' }. */
export const storedClinicLabels = (clinics = []) => {
  const labels = {}
  for (const clinic of clinics) {
    const stored = clinic?.i18n?.name
    if (!clinic?.name || !stored) continue
    if (stored.ar) labels[storedLabelKey(clinic.name, 'ar')] = stored.ar
    if (stored.en) labels[storedLabelKey(clinic.name, 'en')] = stored.en
  }
  return labels
}

const textOf = (value) => (typeof value === 'string' ? value.trim() : '')

/** True when a stored bilingual value ({ en, ar, status }) has text in at least one language. */
export const hasBilingualText = (stored) =>
  Boolean(stored && typeof stored === 'object' && (textOf(stored.en) || textOf(stored.ar)))

/**
 * The stored value in the current language through `tc()`, which falls back to the other one,
 * or '' when nothing is stored yet. Callers add `|| record.field` for records not backfilled.
 * Unlike a bare `tc()`, this never returns the object itself when both sides are blank.
 */
export const bilingualText = (tc, stored) => {
  if (!hasBilingualText(stored)) return ''
  const out = typeof tc === 'function' ? tc(stored) : stored.en || stored.ar
  return textOf(out)
}

/** `bilingualText` for `record.i18n[field]`. */
export const recordText = (tc, record, field) => bilingualText(tc, record?.i18n?.[field])

/** The plain value and both stored languages of each field, for search that matches either language. */
export const recordSearchTexts = (record, fields = []) =>
  fields.flatMap((field) => {
    const stored = record?.i18n?.[field]
    return [record?.[field], stored?.en, stored?.ar].map(textOf).filter(Boolean)
  })

/* Settings lists store one { en, ar } per entry. Match on either language or the plain `name`. */
const findLabel = (labels, name) => {
  const key = textOf(name)
  if (!key || !Array.isArray(labels)) return null
  return labels.find((item) => item && [item.name, item.en, item.ar].some((value) => textOf(value) === key)) || null
}

/**
 * An insurance provider name in `language`. `labels` is `insuranceProvidersI18n` from the site
 * settings or `providersI18n` from the providers route; both are `{ name, en, ar }[]`.
 * The server fills `en` with the plain name for providers that have no stored text, so a missing
 * side uses `fallback(name)` (the built-in name list) before borrowing the other language.
 */
export const providerLabel = ({ tc, language }, labels, name, fallback) => {
  const match = findLabel(labels, name)
  if (textOf(match?.[language])) return bilingualText(tc, match)
  return textOf(typeof fallback === 'function' ? fallback(name) : '') || bilingualText(tc, match) || textOf(name)
}
