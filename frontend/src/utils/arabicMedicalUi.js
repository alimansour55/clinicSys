/** Arabic-native doctor / slot count labels and currency for patient UI. */

export function formatDoctorCountLabel(count, language = 'en', localizeDigits = (v) => String(v)) {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  if (language !== 'ar') {
    if (n === 0) return 'No doctors'
    if (n === 1) return '1 doctor'
    return `${n} doctors`
  }
  if (n === 0) return 'لا يوجد أطباء'
  if (n === 1) return 'طبيب واحد'
  if (n === 2) return 'طبيبان'
  if (n >= 3 && n <= 10) return `${localizeDigits(String(n))} أطباء`
  return `${localizeDigits(String(n))} طبيبًا`
}

export function formatSlotCountLabel(count, language = 'en', localizeDigits = (v) => String(v)) {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  if (language !== 'ar') {
    if (n === 0) return 'No slots'
    if (n === 1) return '1 slot'
    return `${n} slots`
  }
  if (n === 0) return 'لا توجد مواعيد'
  if (n === 1) return 'موعد واحد'
  if (n === 2) return 'موعدان'
  if (n >= 3 && n <= 10) return `${localizeDigits(String(n))} مواعيد`
  return `${localizeDigits(String(n))} موعداً`
}

export function formatSlotsThisWeekLabel(count, language = 'en', localizeDigits = (v) => String(v)) {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  if (language !== 'ar') {
    if (n === 0) return 'No slots this week'
    if (n === 1) return '1 slot this week'
    return `${n} slots this week`
  }
  if (n === 0) return 'لا توجد مواعيد هذا الأسبوع'
  if (n === 1) return 'موعد واحد هذا الأسبوع'
  if (n === 2) return 'موعدان هذا الأسبوع'
  if (n >= 3 && n <= 10) return `${localizeDigits(String(n))} مواعيد هذا الأسبوع`
  return `${localizeDigits(String(n))} موعداً هذا الأسبوع`
}

export function formatMoney(amount, language = 'en', localizeDigits = (v) => String(v)) {
  const num = Number(amount)
  const raw = Number.isFinite(num) ? String(num) : String(amount ?? '').trim()
  const digits = localizeDigits(raw)
  if (language === 'ar') return `${digits} ج.م`
  return `EGP ${digits}`
}
