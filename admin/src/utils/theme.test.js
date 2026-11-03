import fs from 'fs'
import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_THEME_PREFERENCE, getThemePreference, resolveTheme, setThemePreference, THEME_STORAGE_KEY } from './theme'

const stubSystemTheme = (dark) =>
  vi.stubGlobal('matchMedia', (query) => ({ matches: dark && query.includes('dark'), addEventListener: () => {} }))

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('theme', () => {
  it('uses the default when nothing valid is stored', () => {
    expect(getThemePreference()).toBe(DEFAULT_THEME_PREFERENCE)
    localStorage.setItem(THEME_STORAGE_KEY, 'neon')
    expect(getThemePreference()).toBe(DEFAULT_THEME_PREFERENCE)
  })

  it('stores a preference and applies it to the document', () => {
    setThemePreference('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    setThemePreference('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('ignores an unknown preference', () => {
    setThemePreference('dark')
    setThemePreference('neon')
    expect(getThemePreference()).toBe('dark')
  })

  it('follows the operating system for the system preference', () => {
    stubSystemTheme(true)
    expect(resolveTheme('system')).toBe('dark')
    stubSystemTheme(false)
    expect(resolveTheme('system')).toBe('light')
  })

  it('still resolves when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(resolveTheme('system')).toBe('light')
  })

  it('agrees with the pre-paint script in index.html', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8')
    expect(html).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`)
    expect(html).toContain(`var theme = '${DEFAULT_THEME_PREFERENCE}'`)
  })
})
