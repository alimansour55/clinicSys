import { describe, expect, it } from 'vitest'
import { loginPath, safeNextPath } from './loginRedirect'

describe('safeNextPath', () => {
  it('keeps same-site paths with their query and hash', () => {
    expect(safeNextPath('/appointment/abc')).toBe('/appointment/abc')
    expect(safeNextPath('/my-profile?tab=reminders#top')).toBe('/my-profile?tab=reminders#top')
  })

  it('refuses anything that could leave the site', () => {
    for (const value of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      ' //evil.example',
      '/%2F%2Fevil.example',
      'evil.example',
      '/\nhttps://evil.example',
      '',
      null,
      undefined,
    ]) {
      const result = safeNextPath(value)
      if (result !== null) expect(result.startsWith('/') && !result.startsWith('//')).toBe(true)
      else expect(result).toBeNull()
    }
    expect(safeNextPath('https://evil.example')).toBeNull()
    expect(safeNextPath('//evil.example')).toBeNull()
    expect(safeNextPath('/\\evil.example')).toBeNull()
    expect(safeNextPath('javascript:alert(1)')).toBeNull()
  })

  it('does not return to the login pages themselves', () => {
    expect(safeNextPath('/login?mode=signup')).toBeNull()
    expect(safeNextPath('/account-verify')).toBeNull()
  })
})

describe('loginPath', () => {
  it('adds next for the page to come back to', () => {
    expect(loginPath('/insurance')).toBe('/login?mode=login&next=%2Finsurance')
    expect(loginPath({ pathname: '/my-profile', search: '?tab=security', hash: '' }, 'signup')).toBe('/login?mode=signup&next=%2Fmy-profile%3Ftab%3Dsecurity')
  })

  it('leaves next out when there is nowhere useful to return', () => {
    expect(loginPath('/')).toBe('/login?mode=login')
    expect(loginPath('https://evil.example')).toBe('/login?mode=login')
    expect(loginPath('')).toBe('/login?mode=login')
  })
})
