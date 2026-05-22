import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { resolveBackendUrl } from './resolveBackendUrl'

describe('resolveBackendUrl', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_BACKEND_URL', 'http://localhost:4000')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
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
})
