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
