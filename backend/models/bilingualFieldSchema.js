import mongoose from 'mongoose'

/**
 * One piece of admin-entered content, stored in both languages.
 * Add to a model as `i18n: { name: { type: bilingualFieldSchema, default: undefined } }` and keep
 * the old plain field, since other code reads it. See bilingualContentService and DESIGN_SYSTEM.md.
 */
export const bilingualFieldSchema = new mongoose.Schema(
  {
    en: { type: String, default: '' },
    ar: { type: String, default: '' },
    /** The language the admin typed. The other one was generated, or corrected if `manual`. */
    source: { type: String, enum: ['en', 'ar'], default: 'en' },
    /** The generated side was corrected by hand: only a change to the source may replace it. */
    manual: { type: Boolean, default: false },
    /** `pending`: the translator was unavailable, so the record is saved and will be retried. */
    status: { type: String, enum: ['complete', 'pending'], default: 'complete' },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Number, default: 0 }
  },
  { _id: false }
)

/** A receptionist's schema does not declare `i18n` yet, so writes to it use `strict: false`. */
export const receptionistBilingualFields = {
  name: { kind: 'name' }
}
