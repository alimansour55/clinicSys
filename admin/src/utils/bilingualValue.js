/** Form value for BilingualField: `source` is what the admin typed, `manual` means they corrected the other side. */
export const emptyBilingual = () => ({ en: '', ar: '', source: 'en', manual: false, status: 'complete' })

const hasArabic = (text) => /[؀-ۿ]/.test(String(text || ''))

/** Reads `record.i18n[field]`, falling back to the old plain field for records not filled yet. */
export const bilingualFromRecord = (record, field) => {
  const stored = record?.i18n?.[field]
  if (stored && (stored.en || stored.ar)) {
    return {
      en: stored.en || '',
      ar: stored.ar || '',
      source: stored.source === 'ar' ? 'ar' : 'en',
      manual: stored.manual === true,
      status: stored.status === 'pending' ? 'pending' : 'complete',
    }
  }
  const plain = String(record?.[field] ?? '').trim()
  const source = hasArabic(plain) ? 'ar' : 'en'
  return { ...emptyBilingual(), source, [source]: plain }
}

/** What the API needs. The status is the server's to decide. */
export const bilingualPayload = ({ en, ar, source, manual }) => ({ en, ar, source, manual })

/** One form value per field, for a form that edits many at once. `fields` is a list of field names. */
export const bilingualGroupFromRecord = (record, fields) =>
  Object.fromEntries(fields.map((field) => [field, bilingualFromRecord(record, field)]))

/** Adds a group to a multipart request as `<field>I18n` JSON text, which is what the server reads. */
export const appendBilingualGroup = (formData, group) => {
  Object.entries(group).forEach(([field, value]) => {
    formData.append(`${field}I18n`, JSON.stringify(bilingualPayload(value)))
  })
}

/** The same for a JSON request. */
export const bilingualGroupPayload = (group) =>
  Object.fromEntries(Object.entries(group).map(([field, value]) => [`${field}I18n`, bilingualPayload(value)]))

/** What a preview shows for one language: the text if it exists, otherwise the other language. */
export const bilingualText = (value, language) => value?.[language] || value?.[language === 'en' ? 'ar' : 'en'] || ''

export const bilingualIsEmpty = (value) => !String(value?.en || '').trim() && !String(value?.ar || '').trim()
