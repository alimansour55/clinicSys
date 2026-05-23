/**
 * User-facing message for failed API calls (axios errors).
 * @param {import('axios').AxiosError} error
 * @param {(key: string) => string} [t]
 */
export function getApiErrorMessage(error, t = (s) => s) {
  const status = error?.response?.status
  const bodyMsg = error?.response?.data?.message

  if (status === 503) {
    if (bodyMsg && /MONGODB_URI|not configured on the server/i.test(bodyMsg)) {
      return t('API database not configured hint') || bodyMsg
    }
    return bodyMsg || t('Database connection failed')
  }

  if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')) {
    return t('API request timed out')
  }

  return bodyMsg || error?.message || t('Network Error')
}

export function isDatabaseConfig503(error) {
  const msg = error?.response?.data?.message
  return error?.response?.status === 503 && /MONGODB_URI|not configured on the server/i.test(msg || '')
}
