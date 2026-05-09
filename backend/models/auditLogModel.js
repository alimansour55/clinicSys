import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true, index: true },
  actorUserId: { type: String, default: '', index: true },
  actorRole: { type: String, default: '', index: true },
  targetUserId: { type: String, default: '' },
  entityType: { type: String, default: '', index: true },
  entityId: { type: String, default: '' },
  status: { type: String, enum: ['success', 'failed'], required: true, index: true },
  ipAddress: { type: String, default: '' },
  location: { type: Object, default: {} },
  userAgent: { type: String, default: '' },
  reason: { type: String, default: '' },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now, index: true }
}, { minimize: false })

const auditLogModel = mongoose.models.auditLog || mongoose.model('auditLog', auditLogSchema)

export default auditLogModel
