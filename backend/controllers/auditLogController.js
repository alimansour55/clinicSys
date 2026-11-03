import auditLogModel from '../models/auditLogModel.js'
import { getSecuritySettings, purgeExpiredAuditLogs } from '../services/securityPolicyService.js'

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getAuditLogs = async (req, res) => {
  try {
    const security = await getSecuritySettings()
    if (!security.auditLogsEnabled) {
      return res.json({ success: true, logs: [], auditLogsEnabled: false, retentionDays: security.auditLogRetentionDays })
    }

    const purgeResult = await purgeExpiredAuditLogs()
    const { action, actorUserId, entityType, status, startDate, endDate } = req.query
    const filters = {}

    /* Query values reach Mongo, so only plain text gets through */
    const text = (value) => (typeof value === 'string' ? value.trim() : '')
    if (text(action)) filters.action = { $regex: escapeRegex(text(action)), $options: 'i' }
    if (text(actorUserId)) filters.actorUserId = text(actorUserId)
    if (text(entityType)) filters.entityType = text(entityType)
    if (text(status)) filters.status = text(status)

    const parseDay = (value, endOfDay) => {
      const date = new Date(`${text(value)}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`)
      return Number.isNaN(date.getTime()) ? null : date
    }
    const from = text(startDate) && parseDay(startDate, false)
    const to = text(endDate) && parseDay(endDate, true)
    if (from || to) {
      filters.createdAt = {}
      if (from) filters.createdAt.$gte = from
      if (to) filters.createdAt.$lte = to
    }

    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 200))
    const [logs, total] = await Promise.all([
      auditLogModel.find(filters).sort({ createdAt: -1 }).limit(limit),
      auditLogModel.countDocuments(filters)
    ])
    res.json({ success: true, logs, total, auditLogsEnabled: true, retentionDays: security.auditLogRetentionDays, purgedAuditLogs: purgeResult.deletedCount })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

export { getAuditLogs }
