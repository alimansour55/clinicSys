import auditLogModel from '../models/auditLogModel.js'

const sensitiveKeys = ['password', 'token', 'atoken', 'dtoken', 'rtoken', 'authorization']
const auditWriteTimeoutMs = 1500

const getClientIp = (req) => {
  const forwardedFor = req?.headers?.['x-forwarded-for']
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  return req?.ip || req?.headers?.['x-real-ip'] || req?.socket?.remoteAddress || ''
}

const getLocation = (req) => {
  const headers = req?.headers || {}
  return {
    country: headers['cf-ipcountry'] || headers['x-vercel-ip-country'] || '',
    region: headers['x-vercel-ip-country-region'] || '',
    city: headers['x-vercel-ip-city'] || '',
    timezone: headers['x-vercel-ip-timezone'] || ''
  }
}

const sanitizeMetadata = (value) => {
  if (!value || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeMetadata(item))
  }

  return Object.entries(value).reduce((safe, [key, item]) => {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      safe[key] = '[redacted]'
    } else if (item && typeof item === 'object') {
      safe[key] = sanitizeMetadata(item)
    } else {
      safe[key] = item
    }
    return safe
  }, {})
}

export const getAuditActor = (req) => {
  const user = req?.user || {}
  return {
    actorUserId: user.userId || user.id || '',
    actorRole: user.role || ''
  }
}

export const logAudit = async ({
  action,
  actorUserId,
  actorRole,
  targetUserId = '',
  entityType = '',
  entityId = '',
  status = 'success',
  reason = '',
  metadata = {},
  req
}) => {
  try {
    if (auditLogModel.db.readyState !== 1) {
      console.warn('Audit logging skipped: database is not connected')
      return
    }

    const actor = req ? getAuditActor(req) : {}

    const writeAuditLog = auditLogModel.create({
        action,
        actorUserId: actorUserId || actor.actorUserId || '',
        actorRole: actorRole || actor.actorRole || '',
        targetUserId: targetUserId || '',
        entityType: entityType || '',
        entityId: entityId || '',
        status,
        reason,
        metadata: sanitizeMetadata(metadata) || {},
        ipAddress: getClientIp(req),
        location: getLocation(req),
        userAgent: req?.headers?.['user-agent'] || ''
      })

    await Promise.race([
      writeAuditLog,
      new Promise(resolve => setTimeout(resolve, auditWriteTimeoutMs))
    ])

    writeAuditLog.catch(error => {
      console.error('Audit logging failed:', error.message)
    })
  } catch (error) {
    console.error('Audit logging failed:', error.message)
  }
}
