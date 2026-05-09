import express from 'express'
import { getAuditLogs } from '../controllers/auditLogController.js'
import { authenticateAny, authorizePermission } from '../middlewares/rbac.js'

const auditLogRouter = express.Router()

auditLogRouter.get('/', authenticateAny, authorizePermission('view audit logs'), getAuditLogs)

export default auditLogRouter
