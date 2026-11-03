import { translateString } from '../i18n'

/* The Arabic for a key, or '' when t() would just hand the English back. */
export const translateForAudit = (key) => {
  const out = translateString(key, 'ar')
  return out === key ? '' : out
}
