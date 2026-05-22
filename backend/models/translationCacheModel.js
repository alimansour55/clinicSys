import mongoose from 'mongoose'

/** Cached Latin → Arabic for place/clinic labels (filled via API on first request). */
const translationCacheSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true, maxlength: 200 },
    valueAr: { type: String, required: true, maxlength: 500 },
    source: { type: String, enum: ['google', 'libre', 'seed'], default: 'libre' }
  },
  { timestamps: true }
)

const translationCacheModel =
  mongoose.models.translationCache || mongoose.model('translationCache', translationCacheSchema)

export default translationCacheModel
