import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeEmail,
  findOneByEmail,
  emailExists,
  adminEmailsMatch,
} from '../utils/emailUtils.js'

describe('emailUtils', () => {
  describe('normalizeEmail', () => {
    it('lowercases and trims valid email', () => {
      expect(normalizeEmail('  User@Example.COM  ')).toBe('user@example.com')
    })

    it('returns empty string for null, undefined, or blank', () => {
      expect(normalizeEmail(null)).toBe('')
      expect(normalizeEmail(undefined)).toBe('')
      expect(normalizeEmail('   ')).toBe('')
    })
  })

  describe('adminEmailsMatch', () => {
    it('matches case-insensitively after trim', () => {
      expect(adminEmailsMatch(' Admin@Site.com ', 'admin@site.com')).toBe(true)
      expect(adminEmailsMatch('other@test.com', 'admin@site.com')).toBe(false)
    })
  })

  describe('findOneByEmail', () => {
    let findOne

    beforeEach(() => {
      findOne = vi.fn().mockReturnValue({
        collation: vi.fn().mockResolvedValue({ _id: '1', email: 'user@example.com' }),
      })
    })

    it('queries with normalized email and collation', async () => {
      const Model = { findOne }
      const doc = await findOneByEmail(Model, ' User@Example.COM ')

      expect(findOne).toHaveBeenCalledWith({ email: 'user@example.com' })
      expect(findOne.mock.results[0].value.collation).toHaveBeenCalledWith({
        locale: 'en',
        strength: 2,
      })
      expect(doc).toEqual({ _id: '1', email: 'user@example.com' })
    })

    it('merges extra filter', async () => {
      const Model = { findOne }
      await findOneByEmail(Model, 'user@example.com', { role: 'admin' })

      expect(findOne).toHaveBeenCalledWith({ role: 'admin', email: 'user@example.com' })
    })

    it('returns null without querying when email is empty', async () => {
      const Model = { findOne }
      const doc = await findOneByEmail(Model, '   ')

      expect(findOne).not.toHaveBeenCalled()
      expect(doc).toBeNull()
    })
  })

  describe('emailExists', () => {
    it('returns true when a document is found', async () => {
      const Model = {
        findOne: vi.fn().mockReturnValue({
          collation: vi.fn().mockResolvedValue({ _id: '1' }),
        }),
      }
      expect(await emailExists(Model, 'user@example.com')).toBe(true)
    })

    it('returns false when no document is found', async () => {
      const Model = {
        findOne: vi.fn().mockReturnValue({
          collation: vi.fn().mockResolvedValue(null),
        }),
      }
      expect(await emailExists(Model, 'missing@example.com')).toBe(false)
    })

    it('excludes id when provided', async () => {
      const findOne = vi.fn().mockReturnValue({
        collation: vi.fn().mockResolvedValue(null),
      })
      await emailExists({ findOne }, 'user@example.com', 'exclude-id')

      expect(findOne).toHaveBeenCalledWith({
        _id: { $ne: 'exclude-id' },
        email: 'user@example.com',
      })
    })
  })
})
