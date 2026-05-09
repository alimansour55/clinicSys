import jwt from 'jsonwebtoken'
import { logAudit } from '../services/auditService.js'

export const permissionsByRole = {
  admin: [
    'manage users',
    'delete profiles',
    'view all profiles',
    'manage payments',
    'view audit logs',
    'manage prescriptions',
    'manage medical history',
    'manage appointments',
    'manage doctors',
    'manage clinics',
    'manage receptionists',
    'manage site content'
  ],
  doctor: [
    'view assigned patients',
    'edit prescriptions',
    'edit medical history',
    'view medical history',
    'manage appointments',
    'view own profile',
    'update own profile'
  ],
  receptionist: [
    'create appointments',
    'update appointments',
    'view basic patient profile',
    'manage payment status',
    'view doctors'
  ],
  patient: [
    'view own profile',
    'update own basic profile',
    'create appointments',
    'view own appointments',
    'cancel own appointments',
    'view own prescriptions',
    'view own medical history',
    'update own medical history',
    'view own payments'
  ]
}

const tokenHeaders = {
  admin: 'atoken',
  doctor: 'dtoken',
  receptionist: 'rtoken',
  patient: 'token'
}

const buildAdminPayload = () => ({
  id: process.env.ADMIN_EMAIL,
  userId: process.env.ADMIN_EMAIL,
  role: 'admin',
  email: process.env.ADMIN_EMAIL
})

const normalizeDecodedToken = (decoded, fallbackRole) => {
  if (fallbackRole === 'admin' && typeof decoded === 'string') {
    const legacyAdminSecret = process.env.ADMIN_EMAIL + process.env.ADMIN_PASSWORD
    if (decoded === legacyAdminSecret) {
      return buildAdminPayload()
    }
  }

  if (!decoded || typeof decoded !== 'object') {
    return null
  }

  const role = decoded.role || fallbackRole

  return createJwtPayload({
    id: decoded.id || decoded.userId,
    userId: decoded.userId || decoded.id,
    role,
    email: decoded.email
  })
}

const attachRoleCompat = (req) => {
  if (req.user.role === 'doctor') {
    req.doctor = { docId: req.user.userId }
  }

  if (req.user.role === 'receptionist') {
    req.receptionist = { receptionistId: req.user.userId }
  }
}

export const createJwtPayload = ({ id, userId, role, email }) => ({
  id: id || userId,
  userId: userId || id,
  role,
  ...(email ? { email } : {})
})

export const authenticateRole = (expectedRole) => async (req, res, next) => {
  try {
    const headerName = tokenHeaders[expectedRole]
    const token = req.headers[headerName]

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not Authorized. Login again.' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = normalizeDecodedToken(decoded, expectedRole)

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid token. Login again.' })
    }

    if (user.role !== expectedRole) {
      req.user = user
      await logAudit({
        action: 'unauthorized_access',
        status: 'failed',
        reason: 'Authenticated role used a route for another role',
        metadata: {
          route: req.originalUrl,
          method: req.method,
          requiredRoles: [expectedRole],
          userRole: user.role
        },
        req
      })
      return res.status(403).json({ success: false, message: 'Forbidden. Your role cannot access this route.' })
    }

    req.user = user
    attachRoleCompat(req)

    next()
  } catch (error) {
    console.log(error)
    res.status(401).json({ success: false, message: 'Invalid token. Login again.' })
  }
}

export const authenticateAny = async (req, res, next) => {
  try {
    for (const [role, headerName] of Object.entries(tokenHeaders)) {
      const token = req.headers[headerName]
      if (!token) continue

      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = normalizeDecodedToken(decoded, role)

      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid token. Login again.' })
      }

      req.user = user
      attachRoleCompat(req)
      return next()
    }

    return res.status(401).json({ success: false, message: 'Not Authorized. Login again.' })
  } catch (error) {
    console.log(error)
    res.status(401).json({ success: false, message: 'Invalid token. Login again.' })
  }
}

export const authorizeRole = (...roles) => async (req, res, next) => {
  if (roles.includes(req.user?.role)) {
    return next()
  }

  await logAudit({
    action: 'unauthorized_access',
    status: 'failed',
    reason: 'Role is not allowed for this route',
    metadata: {
      route: req.originalUrl,
      method: req.method,
      requiredRoles: roles,
      userRole: req.user?.role || ''
    },
    req
  })

  return res.status(403).json({ success: false, message: 'Forbidden. You do not have access to this resource.' })
}

export const authorizePermission = (permission) => async (req, res, next) => {
  const role = req.user?.role
  const permissions = permissionsByRole[role] || []

  if (permissions.includes(permission)) {
    return next()
  }

  await logAudit({
    action: 'unauthorized_access',
    status: 'failed',
    reason: 'Permission denied',
    metadata: {
      route: req.originalUrl,
      method: req.method,
      requiredPermission: permission,
      userRole: role || ''
    },
    req
  })

  return res.status(403).json({ success: false, message: 'Forbidden. You do not have permission to perform this action.' })
}
