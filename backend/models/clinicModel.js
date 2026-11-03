import mongoose from 'mongoose'
import { bilingualFieldSchema } from './bilingualFieldSchema.js'

export const defaultClinicNames = [
  'General physician',
  'Gynecologist',
  'Dermatologist',
  'Pediatricians',
  'Neurologist',
  'Gastroenterologist'
]

export const clinicBilingualFields = {
  name: { kind: 'label' },
  description: { kind: 'text' }
}

const clinicSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  i18n: {
    name: { type: bilingualFieldSchema, default: undefined },
    description: { type: bilingualFieldSchema, default: undefined }
  },
  active: { type: Boolean, default: true },
  date: { type: Number, required: true }
}, { minimize: false })

const clinicModel = mongoose.models.clinic || mongoose.model('clinic', clinicSchema)

export default clinicModel
