import mongoose from 'mongoose'

/** Cached machine translations for longer UI strings (e.g. doctor about). Key = sha256(text + targetLang). */
const contentTranslationCacheSchema = new mongoose.Schema(
  {
    cacheKey: { type: String, required: true, unique: true, index: true, maxlength: 80 },
    targetLang: { type: String, required: true, enum: ['ar', 'en'], index: true },
    translated: { type: String, required: true, maxlength: 32000 },
    source: { type: String, enum: ['google', 'libre'], default: 'libre' }
  },
  { timestamps: true }
)

const contentTranslationCacheModel =
  mongoose.models.contentTranslationCache ||
  mongoose.model('contentTranslationCache', contentTranslationCacheSchema)

export default contentTranslationCacheModel
