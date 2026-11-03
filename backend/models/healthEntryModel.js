import mongoose from 'mongoose'

export const HEALTH_ENTRY_TYPES = ['vitals', 'symptom', 'vaccine', 'lab', 'note']

/** Things a patient records between visits. Every query must filter by ownerId. */
const healthEntrySchema = new mongoose.Schema({
  ownerId: { type: String, required: true },
  memberId: { type: String, default: '' }, // empty means the patient themself
  type: { type: String, enum: HEALTH_ENTRY_TYPES, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  title: { type: String, default: '', maxlength: 160 },
  note: { type: String, default: '', maxlength: 2000 },
  vitals: {
    systolic: Number,
    diastolic: Number,
    glucose: Number,
    weight: Number,
    heartRate: Number,
    temperature: Number
  }
}, { timestamps: true })

healthEntrySchema.index({ ownerId: 1, date: -1 })

const healthEntryModel = mongoose.models.healthEntry || mongoose.model('healthEntry', healthEntrySchema)

export default healthEntryModel
