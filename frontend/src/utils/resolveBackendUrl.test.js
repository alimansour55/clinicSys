import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { resolveBackendUrl } from './resolveBackendUrl'

describe('resolveBackendUrl', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_BACKEND_URL', 'http://localhost:4000')
    vi.stubEnv('PROD', false)
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

  it('uses same origin on Vercel in dev preview when env points at external API', () => {
    vi.stubEnv('VITE_BACKEND_URL', 'https://api.example.com')
    vi.stubGlobal('window', {
      location: {
        hostname: 'clinic-sys-m878.vercel.app',
        protocol: 'https:',
        origin: 'https://clinic-sys-m878.vercel.app',
      },
    })
    expect(resolveBackendUrl()).toBe('https://api.example.com')
  })

  it('uses same origin on Vercel when env still points to localhost', () => {
    vi.stubGlobal('window', {
      location: {
        hostname: 'clinic-sys-m878.vercel.app',
        protocol: 'https:',
        origin: 'https://clinic-sys-m878.vercel.app',
      },
    })
    expect(resolveBackendUrl()).toBe('https://clinic-sys-m878.vercel.app')
  })

  it('production build never uses :4000 on the page host', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_BACKEND_URL', 'http://localhost:4000')
    vi.stubGlobal('window', {
      location: {
        hostname: 'clinic-sys-m878.vercel.app',
        protocol: 'https:',
        origin: 'https://clinic-sys-m878.vercel.app',
      },
    })
    expect(resolveBackendUrl()).toBe('https://clinic-sys-m878.vercel.app')
    expect(resolveBackendUrl()).not.toContain(':4000')
  })

  it('production build on Vercel uses same origin (api proxy) even when env points at API host', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_BACKEND_URL', 'https://clinic-sys-eight.vercel.app')
    vi.stubGlobal('window', {
      location: {
        hostname: 'clinic-sys-m878.vercel.app',
        protocol: 'https:',
        origin: 'https://clinic-sys-m878.vercel.app',
      },
    })
    expect(resolveBackendUrl()).toBe('https://clinic-sys-m878.vercel.app')
  })

  it('production build on custom domain uses baked API URL when set', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_BACKEND_URL', 'https://api.example.com')
    vi.stubGlobal('window', {
      location: {
        hostname: 'app.example.com',
        protocol: 'https:',
        origin: 'https://app.example.com',
      },
    })
    expect(resolveBackendUrl()).toBe('https://api.example.com')
  })
})
