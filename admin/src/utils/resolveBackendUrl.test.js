import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { resolveBackendUrl, shouldShowMobileApiHint } from './resolveBackendUrl'

describe('resolveBackendUrl', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_BACKEND_URL', 'http://localhost:4000')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses env URL on localhost', () => {
    vi.stubGlobal('window', {
      location: { hostname: 'localhost', protocol: 'http:' },
    })
    expect(resolveBackendUrl()).toBe('http://localhost:4000')
  })

  it('uses same host as page when opened via LAN IP', () => {
    vi.stubGlobal('window', {
      location: { hostname: '192.168.8.139', protocol: 'http:' },
    })
    expect(resolveBackendUrl()).toBe('http://192.168.8.139:4000')
  })

  it('uses production env URL on Vercel (no :4000 on page host)', () => {
    vi.stubEnv('VITE_BACKEND_URL', 'https://api.example.com')
    vi.stubGlobal('window', {
      location: { hostname: 'adm-snowy.vercel.app', protocol: 'https:' },
    })
    expect(resolveBackendUrl()).toBe('https://api.example.com')
  })

  it('uses production env URL on custom domain', () => {
    vi.stubEnv('VITE_BACKEND_URL', 'https://clinivo-api.onrender.com')
    vi.stubGlobal('window', {
      location: { hostname: 'staff.myclinic.com', protocol: 'https:' },
    })
    expect(resolveBackendUrl()).toBe('https://clinivo-api.onrender.com')
  })
})

describe('shouldShowMobileApiHint', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is true on LAN IP', () => {
    vi.stubGlobal('window', {
      location: { hostname: '192.168.1.42' },
    })
    expect(shouldShowMobileApiHint()).toBe(true)
  })

  it('is false on Vercel', () => {
    vi.stubGlobal('window', {
      location: { hostname: 'adm-snowy.vercel.app' },
    })
    expect(shouldShowMobileApiHint()).toBe(false)
  })
})
