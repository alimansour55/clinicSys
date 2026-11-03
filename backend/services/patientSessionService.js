import jwt from 'jsonwebtoken'
import userModel from '../models/userModel.js'
import { createJwtPayload } from '../middlewares/rbac.js'
import { logAudit } from './auditService.js'
import { buildMfaSetupPayload, generateMfaSecret } from './mfaService.js'
import { getSecuritySettings, isMfaRequiredForProfile } from './securityPolicyService.js'

const MFA_TOKEN_EXPIRES_IN = '10m'
export const PATIENT_TOKEN_EXPIRES_IN = '7d'

export const signPatientSession = (user) =>
  jwt.sign(createJwtPayload({ id: user._id, role: 'patient', email: user.email }), process.env.JWT_SECRET, {
    expiresIn: PATIENT_TOKEN_EXPIRES_IN
  })

export const signPatientMfaToken = (user, purpose = 'patient-mfa') =>
  jwt.sign({ id: user._id.toString(), role: 'patient', purpose }, process.env.JWT_SECRET, {
    expiresIn: MFA_TOKEN_EXPIRES_IN
  })

/** Returns the user with MFA secrets loaded, or null when the token is invalid, expired or for another purpose. */
export const getPatientFromMfaToken = async (mfaToken, purpose = 'patient-mfa') => {
  let decoded
  try {
    decoded = jwt.verify(String(mfaToken || ''), process.env.JWT_SECRET)
  } catch {
    return null
  }
  if (decoded?.purpose !== purpose || decoded?.role !== 'patient' || !decoded?.id) return null
  return userModel.findById(decoded.id).select('+mfa.secret +mfa.lastUsedStep +mfa.recoveryCodes')
}

/**
 * The step after the password (or after verifying an account): either a session, or the MFA challenge.
 * Every way into an account goes through here, so none of them can skip MFA.
 */
export const completeSignIn = async (user, req, { loginId = '' } = {}) => {
  const security = await getSecuritySettings()
  const mfaRequired = isMfaRequiredForProfile(security, 'patient', user)

  if (mfaRequired && !user.mfa?.enabled) {
    const secret = generateMfaSecret()
    await userModel.findByIdAndUpdate(user._id, { 'mfa.secret': secret, 'mfa.enabled': false })
    await logAudit({
      action: 'mfa_setup_required',
      actorUserId: user._id,
      actorRole: 'patient',
      status: 'success',
      entityType: 'user',
      entityId: user._id,
      metadata: { loginId },
      req
    })
    return {
      success: false,
      mfaSetupRequired: true,
      mfaToken: signPatientMfaToken(user, 'patient-mfa-setup'),
      setup: buildMfaSetupPayload({ secret, accountName: user.email }),
      message: 'Authenticator setup is required before login'
    }
  }

  if (mfaRequired) {
    return {
      success: false,
      mfaRequired: true,
      mfaToken: signPatientMfaToken(user),
      message: 'Enter your authenticator code'
    }
  }

  await logAudit({
    action: 'login_success',
    actorUserId: user._id,
    actorRole: 'patient',
    status: 'success',
    entityType: 'user',
    entityId: user._id,
    metadata: { username: user.name, loginId: user.patientId || user.email, email: user.email },
    req
  })
  return { success: true, token: signPatientSession(user) }
}

/** Ends every session issued so far. iat has one-second resolution, so round down or the next token would be refused. */
export const sessionCutoffNow = () => Math.floor(Date.now() / 1000) * 1000
