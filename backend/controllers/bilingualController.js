import { countPendingBilingual, retryPendingBilingual, translateForKind } from '../services/bilingualContentService.js'
import { BILINGUAL_MODELS } from '../services/bilingualRegistry.js'

const KINDS = ['name', 'label', 'place', 'text']
const MAX_TEXT = 8000

/** Suggestion shown in a form while the admin types. Nothing is saved here. */
export const postTranslatePreview = async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim()
    const target = req.body?.target === 'ar' ? 'ar' : 'en'
    const kind = KINDS.includes(req.body?.kind) ? req.body.kind : 'text'
    if (!text || text.length > MAX_TEXT) {
      return res.json({ success: false, message: 'Text is empty or too long' })
    }
    const translated = await translateForKind(text, target, kind)
    res.json({ success: true, translated: translated || '', available: Boolean(translated) })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

export const getTranslationStatus = async (req, res) => {
  try {
    const counts = await Promise.all(
      BILINGUAL_MODELS.map(async ({ label, model, fields }) => ({
        label,
        pending: await countPendingBilingual(model, fields)
      }))
    )
    res.json({ success: true, models: counts, pending: counts.reduce((sum, row) => sum + row.pending, 0) })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

export const postRetryTranslations = async (req, res) => {
  try {
    let completed = 0
    let stillPending = 0
    for (const { model, fields } of BILINGUAL_MODELS) {
      const result = await retryPendingBilingual(model, fields, { limit: 10, deadlineMs: 20_000, force: true })
      completed += result.completed
      stillPending += result.stillPending
    }
    res.json({ success: true, completed, stillPending })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}
