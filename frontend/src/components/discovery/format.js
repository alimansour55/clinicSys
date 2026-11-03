/* Display helpers for discovery: dates of openings and right-sized doctor photos. */

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/** "Today · 4:30 PM", "Tomorrow · 10:00 AM", "Thu 12 Nov · 10:00 AM", in either language. */
export function formatOpening(date, language, t, now = new Date()) {
  if (!date) return ''
  const locale = language === 'ar' ? 'ar-EG' : 'en-GB'
  const time = date.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86400000)
  const day =
    days === 0
      ? t('Today')
      : days === 1
        ? t('Tomorrow')
        : date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day} · ${time}`
}

/**
 * Cloudinary photos are uploaded full size. Ask for a resized, modern-format copy
 * instead. Any other URL (or a data URI) is returned unchanged.
 */
export function optimizedImage(url, width = 480) {
  const value = String(url || '')
  if (!/res\.cloudinary\.com\/.+\/image\/upload\//.test(value)) return value
  if (/\/upload\/[^/]*(w_|f_auto|q_auto)/.test(value)) return value
  return value.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`)
}

/** `{{name}}` placeholders in a translated string. */
export const fill = (text, vars = {}) =>
  Object.entries(vars).reduce((out, [key, value]) => out.split(`{{${key}}}`).join(String(value)), String(text))
