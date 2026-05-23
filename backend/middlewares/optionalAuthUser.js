import jwt from 'jsonwebtoken'
import { createJwtPayload } from './rbac.js'

const normalizeDecodedToken = (decoded) => {
  if (!decoded || typeof decoded !== 'object') return null
  return createJwtPayload({
    id: decoded.id || decoded.userId,
    userId: decoded.userId || decoded.id,
    role: decoded.role || 'patient',
    email: decoded.email
  })
}

/** Sets req.user when a valid patient token is present; continues without auth otherwise. */
const optionalAuthUser = async (req, res, next) => {
  const token = req.headers.token
  if (!token) return next()

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = normalizeDecodedToken(decoded)
    if (user?.role === 'patient') {
      req.user = user
    }
  } catch {
    // ignore invalid token for optional auth
  }

  return next()
}

export default optionalAuthUser
