import { describe, it, expect } from 'vitest'
import { DEFAULT_FOOTER_DESCRIPTION, DEFAULT_FOOTER_COPYRIGHT } from './publicSiteDefaults.js'
import { DEFAULT_APP_DISPLAY_NAME } from './appDisplayName.js'

describe('publicSiteDefaults', () => {
  it('includes app display name in footer copy', () => {
    expect(DEFAULT_FOOTER_DESCRIPTION).toContain(DEFAULT_APP_DISPLAY_NAME)
    expect(DEFAULT_FOOTER_COPYRIGHT).toContain(DEFAULT_APP_DISPLAY_NAME)
    expect(DEFAULT_FOOTER_COPYRIGHT).toMatch(/Copyright \d{4}/)
  })
})
