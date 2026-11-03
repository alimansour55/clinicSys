import jwt from 'jsonwebtoken'
import userModel from '../models/userModel.js'

export const PATIENT_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const AUTH_HEADERS = ['token', 'atoken', 'dtoken', 'rtoken']

const reject = (res) => res.status(401).json({ success: false, message: 'Not Authorized. Login again.' })

/**
 * Runs before every route, because authenticateRole accepts any signed token with the right role:
 * - Single-purpose tokens (MFA step, account verification, signup proof) are not sessions.
 *   Without this check an MFA token skipped the MFA code, and a verification token skipped the password.
 * - A patient session ends when the password changes, when the patient signs out everywhere,
 *   when the account is deactivated, or after a week. Older tokens have no expiry of their own.
 *
 * A token that fails signature checks is left for the route's own middleware to refuse.
 */
const patientSessionGuard = async (req, res, next) => {
  try {
    for (const header of AUTH_HEADERS) {
      const value = req.headers[header]
      if (!value) continue

      let decoded
      try {
        decoded = jwt.verify(value, process.env.JWT_SECRET)
      } catch {
        continue
      }
      if (!decoded || typeof decoded !== 'object') continue
      if (decoded.purpose) return reject(res)

      if (header !== 'token' || decoded.role !== 'patient') continue

      const issuedAtMs = (decoded.iat || 0) * 1000
      if (Date.now() - issuedAtMs > PATIENT_SESSION_MAX_AGE_MS) return reject(res)

      const user = await userModel.findById(decoded.id || decoded.userId).select('isActive sessionsValidAfter').lean()
      if (!user || user.isActive === false) return reject(res)
      if (user.sessionsValidAfter && issuedAtMs < user.sessionsValidAfter) return reject(res)
    }
    next()
  } catch (error) {
    console.error('Session check failed:', error.message)
    res.status(503).json({ success: false, message: 'Please try again in a moment.' })
  }
}

export default patientSessionGuard
