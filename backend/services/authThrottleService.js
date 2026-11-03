import crypto from 'crypto'
import authThrottleModel from '../models/authThrottleModel.js'

const MINUTE = 60 * 1000

const hashKey = (scope, identifier) =>
  `${scope}:${crypto
    .createHmac('sha256', String(process.env.JWT_SECRET || 'throttle'))
    .update(String(identifier ?? '').trim().toLowerCase())
    .digest('hex')}`

export const clientIp = (req) => req?.ip || req?.socket?.remoteAddress || 'unknown'

/** Minutes left on a lock (rounded up), or 0 when the key is not locked. */
export const getLockMinutes = async (scope, identifier) => {
  const doc = await authThrottleModel.findOne({ key: hashKey(scope, identifier) }).lean()
  if (!doc?.lockedUntil || doc.lockedUntil <= Date.now()) return 0
  return Math.max(1, Math.ceil((doc.lockedUntil - Date.now()) / MINUTE))
}

/**
 * Counts one failure. Reaching `max` inside the window locks the key for `lockMs`.
 * Returns the number of attempts left before the lock.
 */
export const recordFailure = async (scope, identifier, { max = 5, windowMs = 15 * MINUTE, lockMs = 15 * MINUTE } = {}) => {
  const key = hashKey(scope, identifier)
  const now = Date.now()
  const doc = await authThrottleModel.findOne({ key })
  const inWindow = doc && now - doc.windowStartedAt < windowMs
  const count = inWindow ? doc.count + 1 : 1
  const windowStartedAt = inWindow ? doc.windowStartedAt : now
  const lockedUntil = count >= max ? now + lockMs : 0

  await authThrottleModel.updateOne(
    { key },
    { $set: { count, windowStartedAt, lockedUntil, expireAt: new Date(now + Math.max(windowMs, lockMs) + MINUTE) } },
    { upsert: true }
  )

  return { attemptsLeft: Math.max(0, max - count), locked: count >= max }
}

export const clearFailures = async (scope, identifier) => {
  await authThrottleModel.deleteOne({ key: hashKey(scope, identifier) })
}

/**
 * Fixed-window request limit for things that cost money or reach someone's inbox.
 * Returns true when the request may go ahead. The increment is atomic.
 */
export const consumeQuota = async (scope, identifier, { max, windowMs }) => {
  const key = hashKey(scope, identifier)
  const now = Date.now()
  const windowStart = now - windowMs

  const updated = await authThrottleModel.findOneAndUpdate(
    { key, windowStartedAt: { $gt: windowStart }, count: { $lt: max } },
    { $inc: { count: 1 } },
    { new: true }
  ).lean()
  if (updated) return true

  const current = await authThrottleModel.findOne({ key }).lean()
  if (current && current.windowStartedAt > windowStart) return false

  await authThrottleModel.updateOne(
    { key },
    { $set: { count: 1, windowStartedAt: now, lockedUntil: 0, expireAt: new Date(now + windowMs + MINUTE) } },
    { upsert: true }
  )
  return true
}
