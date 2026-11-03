import axios from 'axios'
import { useCallback, useContext, useEffect, useState } from 'react'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'

const DEFAULT_POLICY = { minLength: 8, strong: true, uppercase: true, lowercase: true, number: true, special: true }

export const NETWORK_ERROR = 'We could not reach the server. Please check your connection and try again.'

/** Server messages are English keys. Numbers inside them become {{n}}, so one Arabic string covers every value. */
export const serverText = (t, localizeDigits, message) => {
  const raw = String(message || '')
  if (!raw) return t('Something went wrong. Please try again.')
  const number = raw.match(/\d+/)?.[0]
  if (!number) return t(raw)
  return localizeDigits(String(t(raw.replace(number, '{{n}}'))).replace('{{n}}', number))
}

export const useServerText = () => {
  const { t, localizeDigits } = useLanguage()
  return useCallback((message) => serverText(t, localizeDigits, message), [t, localizeDigits])
}

/** Calls the API with the patient's token, ends the session on a 401, and always resolves to { success, ... }. */
export const useAccountApi = () => {
  const { backendUrl, token, setToken } = useContext(AppContext)
  return useCallback(async (method, path, body) => {
    try {
      const { data } = await axios({
        method,
        url: `${backendUrl}${path}`,
        data: body,
        headers: token ? { token } : undefined
      })
      return data
    } catch (error) {
      if (error.response?.status === 401 && token) {
        localStorage.removeItem('token')
        setToken(false)
      }
      return { success: false, message: error.response?.data?.message || NETWORK_ERROR }
    }
  }, [backendUrl, token, setToken])
}

export const passwordRules = (policy = DEFAULT_POLICY) => [
  { key: 'length', label: 'At least {{n}} characters', test: (value) => value.length >= policy.minLength, on: true },
  { key: 'uppercase', label: 'An uppercase letter', test: (value) => /[A-Z]/.test(value), on: policy.uppercase },
  { key: 'lowercase', label: 'A lowercase letter', test: (value) => /[a-z]/.test(value), on: policy.lowercase },
  { key: 'number', label: 'A number', test: (value) => /[0-9]/.test(value), on: policy.number },
  { key: 'special', label: 'A symbol such as ! or #', test: (value) => /[^A-Za-z0-9]/.test(value), on: policy.special }
].filter((rule) => rule.on)

export const usePasswordPolicy = () => {
  const { backendUrl } = useContext(AppContext)
  const [policy, setPolicy] = useState(DEFAULT_POLICY)
  useEffect(() => {
    let cancelled = false
    axios.get(`${backendUrl}/api/account/password-policy`)
      .then(({ data }) => {
        if (!cancelled && data?.success) setPolicy(data.policy)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [backendUrl])
  return policy
}

export const meetsPolicy = (password, policy) => passwordRules(policy).every((rule) => rule.test(password))
