import mongoose from 'mongoose'

const ratingSchema = new mongoose.Schema({
  appointmentId: { type: String, required: true, unique: true },
  docId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '', maxlength: 1000 },
  patientName: { type: String, default: '' },
  doctorName: { type: String, default: '' },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now }
}, { minimize: false })

ratingSchema.index({ docId: 1, createdAt: -1 })
ratingSchema.index({ userId: 1, docId: 1 })

const ratingModel = mongoose.models.rating || mongoose.model('rating', ratingSchema)

export default ratingModel
