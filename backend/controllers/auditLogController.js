import auditLogModel from '../models/auditLogModel.js'

const getAuditLogs = async (req, res) => {
  try {
    const { action, actorUserId, entityType, status, startDate, endDate } = req.query
    const filters = {}

    if (action) filters.action = action
    if (actorUserId) filters.actorUserId = actorUserId
    if (entityType) filters.entityType = entityType
    if (status) filters.status = status

    if (startDate || endDate) {
      filters.createdAt = {}
      if (startDate) filters.createdAt.$gte = new Date(startDate)
      if (endDate) filters.createdAt.$lte = new Date(endDate)
    }

    const logs = await auditLogModel.find(filters).sort({ createdAt: -1 }).limit(200)
    res.json({ success: true, logs })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

export { getAuditLogs }
