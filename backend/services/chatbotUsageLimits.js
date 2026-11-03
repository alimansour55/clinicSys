import crypto from 'crypto'
import mongoose from 'mongoose'

/**
 * Usage limits for the public assistant. Two layers:
 * - A request limiter per IP, kept in memory, which sheds floods cheaply.
 * - An AI budget in MongoDB, because serverless instances share nothing in memory.
 *   It is what actually caps the OpenAI bill. If the budget cannot be read, no AI call is
 *   made and the rule-based assistant answers instead.
 */

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export const getAiLimits = () => ({
  perIpPerHour: numberFromEnv('CHATBOT_AI_PER_IP_PER_HOUR', 15),
  perDay: numberFromEnv('CHATBOT_AI_PER_DAY', 1000),
  perMonth: numberFromEnv('CHATBOT_AI_PER_MONTH', 15000)
})

const windows = new Map()
const MAX_TRACKED_KEYS = 20000

const pruneWindows = (now) => {
  if (windows.size < MAX_TRACKED_KEYS) return
  for (const [key, entry] of windows) {
    if (entry.resetAt <= now) windows.delete(key)
  }
  // Under a flood of unique addresses, drop the oldest rather than grow without limit.
  while (windows.size >= MAX_TRACKED_KEYS) {
    windows.delete(windows.keys().next().value)
  }
}

export const hashClient = (ip = '') =>
  crypto
    .createHash('sha256')
    .update(`${process.env.JWT_SECRET || 'clinivo'}:${ip}`)
    .digest('hex')
    .slice(0, 32)

/** Express middleware: at most `max` requests per IP per window. */
export const limitRequests = ({ name, windowMs, max }) => (req, res, next) => {
  const now = Date.now()
  const key = `${name}:${hashClient(req.ip)}`
  const entry = windows.get(key)

  if (!entry || entry.resetAt <= now) {
    pruneWindows(now)
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return next()
  }

  entry.count += 1
  if (entry.count <= max) return next()

  res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
  return res.status(429).json({
    success: false,
    rateLimited: true,
    message: 'Too many messages. Please wait a moment and try again.'
  })
}

const usageSchema = new mongoose.Schema(
  {
    _id: String,
    count: { type: Number, default: 0 },
    expireAt: { type: Date, required: true }
  },
  { versionKey: false, collection: 'chatbotusage' }
)
usageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 })

const ChatbotUsage = mongoose.models.ChatbotUsage || mongoose.model('ChatbotUsage', usageSchema)

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** Takes one unit, atomically. At the cap the upsert collides with the existing row and is refused. */
const takeFromBudget = async (key, max, ttlMs, now) => {
  if (max <= 0) return false
  try {
    await ChatbotUsage.findOneAndUpdate(
      { _id: key, count: { $lt: max } },
      { $inc: { count: 1 }, $setOnInsert: { expireAt: new Date(now + ttlMs) } },
      { upsert: true }
    )
    return true
  } catch (error) {
    if (error?.code === 11000) return false
    throw error
  }
}

/** Reserves one OpenAI call. Resolves to { allowed, reason }. Never throws. */
export const reserveAiCall = async (ip = '', now = Date.now()) => {
  if (String(process.env.CHATBOT_AI_ENABLED || '').toLowerCase() === 'false') {
    return { allowed: false, reason: 'disabled' }
  }
  if (mongoose.connection.readyState !== 1) return { allowed: false, reason: 'budget_unavailable' }

  const limits = getAiLimits()
  const date = new Date(now).toISOString()
  try {
    if (!(await takeFromBudget(`month:${date.slice(0, 7)}`, limits.perMonth, 40 * DAY, now))) {
      return { allowed: false, reason: 'monthly_budget' }
    }
    if (!(await takeFromBudget(`day:${date.slice(0, 10)}`, limits.perDay, 2 * DAY, now))) {
      return { allowed: false, reason: 'daily_budget' }
    }
    if (!(await takeFromBudget(`ip:${hashClient(ip)}:${date.slice(0, 13)}`, limits.perIpPerHour, 2 * HOUR, now))) {
      return { allowed: false, reason: 'ip_budget' }
    }
    return { allowed: true, reason: '' }
  } catch (error) {
    console.error('chatbot usage budget:', error?.name || 'error')
    return { allowed: false, reason: 'budget_unavailable' }
  }
}

export const resetRequestLimitsForTests = () => windows.clear()
