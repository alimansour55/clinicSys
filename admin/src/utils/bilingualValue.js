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

export const bilingualIsEmpty = (value) => !String(value?.en || '').trim() && !String(value?.ar || '').trim()
