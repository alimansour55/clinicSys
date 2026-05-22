import { describe, it, expect } from 'vitest'
import { EGYPT_DIAL_CODE } from '../utils/egyptPhone.js'

describe('vitest (ESM)', () => {
  it('loads backend modules', () => {
    expect(EGYPT_DIAL_CODE).toBe('+20')
  })
})
