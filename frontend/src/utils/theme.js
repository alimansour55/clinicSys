import { useSyncExternalStore } from 'react'

/** Matches the pre-paint script in index.html. Change both to make 'system' the default. */
export const THEME_STORAGE_KEY = 'clinivoTheme'
export const DEFAULT_THEME_PREFERENCE = 'light'

const PREFERENCES = ['light', 'dark', 'system']
const THEME_COLORS = { light: '#f6f8f5', dark: '#0a1513' }

const listeners = new Set()

const systemPrefersDark = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

export const getThemePreference = () => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return PREFERENCES.includes(stored) ? stored : DEFAULT_THEME_PREFERENCE
  } catch {
    return DEFAULT_THEME_PREFERENCE
  }
}

export const resolveTheme = (preference = getThemePreference()) => {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return preference === 'dark' ? 'dark' : 'light'
}

const applyTheme = () => {
  if (typeof document === 'undefined') return
  const theme = resolveTheme()
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

const notify = () => {
  applyTheme()
  listeners.forEach((listener) => listener())
}

export const setThemePreference = (preference) => {
  if (!PREFERENCES.includes(preference)) return
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    /* private mode: the theme still applies for this page view */
  }
  notify()
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

if (typeof window !== 'undefined') {
  applyTheme()
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_STORAGE_KEY) notify()
  })
  if (typeof window.matchMedia === 'function') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', notify)
  }
}

/** Current theme. Needs no provider, so pages and their tests can call it anywhere. */
export const useTheme = () => {
  const preference = useSyncExternalStore(subscribe, getThemePreference, () => DEFAULT_THEME_PREFERENCE)
  const theme = resolveTheme(preference)
  return {
    preference,
    theme,
    isDark: theme === 'dark',
    setPreference: setThemePreference,
    toggle: () => setThemePreference(theme === 'dark' ? 'light' : 'dark'),
  }
}
