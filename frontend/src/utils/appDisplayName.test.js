import { describe, it, expect } from 'vitest'
import { DEFAULT_APP_DISPLAY_NAME } from './appDisplayName.js'

describe('appDisplayName', () => {
  it('has a default brand name', () => {
    expect(typeof DEFAULT_APP_DISPLAY_NAME).toBe('string')
    expect(DEFAULT_APP_DISPLAY_NAME.length).toBeGreaterThan(0)
  })
})
