import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { installMobileTapFix } from './mobileTapFix'

describe('installMobileTapFix', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a cleanup function on coarse pointers', () => {
    const cleanup = installMobileTapFix()
    expect(typeof cleanup).toBe('function')
    cleanup()
  })

  it('skips install when pointer is not coarse', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    const addSpy = vi.spyOn(document, 'addEventListener')
    const cleanup = installMobileTapFix()
    expect(addSpy).not.toHaveBeenCalled()
    expect(cleanup()).toBeUndefined()
    addSpy.mockRestore()
  })
})
