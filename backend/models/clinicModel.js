import mongoose from 'mongoose'

export const defaultClinicNames = [
  'General physician',
  'Gynecologist',
  'Dermatologist',
  'Pediatricians',
  'Neurologist',
  'Gastroenterologist'
]

const clinicSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  active: { type: Boolean, default: true },
  date: { type: Number, required: true }
}, { minimize: false })

const clinicModel = mongoose.models.clinic || mongoose.model('clinic', clinicSchema)

export default clinicModel
