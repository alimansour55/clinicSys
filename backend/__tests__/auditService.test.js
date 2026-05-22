import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logAudit, getAuditActor } from '../services/auditService.js'

vi.mock('../models/auditLogModel.js', () => ({
  default: {
    db: { readyState: 1 },
    create: vi.fn().mockResolvedValue({}),
  },
}))
vi.mock('../services/securityPolicyService.js', () => ({
  getSecuritySettings: vi.fn().mockResolvedValue({
    auditLogsEnabled: true,
    allowIpTracking: true,
    auditLogRetentionDays: 365,
  }),
}))

import auditLogModel from '../models/auditLogModel.js'

describe('auditService', () => {
  const redact = (metadata) => {
    const sensitiveKeys = ['password', 'token', 'atoken', 'dtoken', 'rtoken', 'authorization']
    const sanitize = (value) => {
      if (!value || typeof value !== 'object') return value
      if (Array.isArray(value)) return value.map(sanitize)
      return Object.entries(value).reduce((safe, [key, item]) => {
        if (sensitiveKeys.includes(key.toLowerCase())) safe[key] = '[redacted]'
        else if (item && typeof item === 'object') safe[key] = sanitize(item)
        else safe[key] = item
        return safe
      }, {})
    }
    return sanitize(metadata)
  }

  describe('getAuditActor', () => {
    it('extracts actor from request user', () => {
      expect(getAuditActor({ user: { userId: 'u1', role: 'admin' } })).toEqual({
        actorUserId: 'u1',
        actorRole: 'admin',
      })
    })
  })

  describe('logAudit', () => {
    beforeEach(() => {
      vi.mocked(auditLogModel.create).mockClear()
    })

    it('writes audit entry with required fields and redacted metadata', async () => {
      const req = {
        user: { userId: 'admin1', role: 'admin' },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'vitest', 'x-forwarded-for': '10.0.0.1' },
      }

      await logAudit({
        action: 'user.login',
        targetUserId: 'pat1',
        entityType: 'user',
        entityId: 'pat1',
        status: 'success',
        metadata: { password: 'secret', nested: { token: 'abc' }, ok: true },
        req,
      })

      expect(auditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.login',
          actorUserId: 'admin1',
          actorRole: 'admin',
          targetUserId: 'pat1',
          entityType: 'user',
          entityId: 'pat1',
          status: 'success',
          metadata: redact({ password: 'secret', nested: { token: 'abc' }, ok: true }),
          ipAddress: '10.0.0.1',
          userAgent: 'vitest',
        })
      )
    })

    it('skips when audit logging disabled', async () => {
      const { getSecuritySettings } = await import('../services/securityPolicyService.js')
      vi.mocked(getSecuritySettings).mockResolvedValueOnce({ auditLogsEnabled: false })

      await logAudit({ action: 'test', req: {} })
      expect(auditLogModel.create).not.toHaveBeenCalled()
    })
  })
})
