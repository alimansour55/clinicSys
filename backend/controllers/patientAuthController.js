import bcrypt from 'bcryptjs'
import { v2 as cloudinary } from 'cloudinary'
import validator from 'validator'
import { PASSWORD_RESET_TEMPLATE } from '../config/EmailTemplates.js'
import transporter from '../config/nodemailer.js'
import { getPublicAppBrand } from '../config/publicBrand.js'
import signupVerificationModel from '../models/signupVerificationModel.js'
import userModel from '../models/userModel.js'
import { generateOtp, hashOtp, isAccountVerified, issueVerificationCodes, maskEmail, maskPhone, OTP_MAX_ATTEMPTS, otpMatches, signVerificationToken } from '../services/accountVerificationService.js'
import { logAudit } from '../services/auditService.js'
import { clearFailures, clientIp, consumeQuota, getLockMinutes, recordFailure } from '../services/authThrottleService.js'
import { buildMfaSetupPayload, generateMfaSecret, generateRecoveryCodes, hashRecoveryCode, matchTotpStep } from '../services/mfaService.js'
import { pushNotification } from '../services/notificationService.js'
import { completeSignIn, getPatientFromMfaToken, sessionCutoffNow, signPatientSession } from '../services/patientSessionService.js'
import { getSecuritySettings, isMfaRequiredForProfile, validatePasswordAgainstPolicy } from '../services/securityPolicyService.js'
import { verifySignupProof } from '../services/signupVerificationService.js'
import { findOneByEmail, normalizeEmail } from '../utils/emailUtils.js'
import { isValidEgyptPhone, normalizeEgyptPhone } from '../utils/egyptPhone.js'
import { buildInsuranceData, getNextPatientId, isPastDate } from './userController.js'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const RESET_OTP_EXPIRY_MS = 10 * MINUTE
const RESET_RESEND_COOLDOWN_MS = MINUTE
const MFA_MAX_ATTEMPTS = 5
const IP_FAILURE_LIMIT = 50

const INVALID_LOGIN = 'Incorrect email, phone or password'
const RESET_SENT = 'If that email has an account, we sent a code to it'
const SOMETHING_WRONG = 'Something went wrong. Please try again.'

// Compared against when the account does not exist, so response time does not reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10)

const asText = (value, max = 200) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, max) : '')

const lockedMessage = (minutes) => `Too many attempts. Please try again in ${minutes} minutes.`

const failWith = (res, label, error) => {
  console.error(`${label}:`, error.message)
  return res.json({ success: false, message: SOMETHING_WRONG })
}

const sendSecurityNotice = async (email, subject, body) => {
  try {
    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: `${getPublicAppBrand()}: ${subject}`,
      html: `<p>${body}</p><p>${getPublicAppBrand()}</p>`
    })
  } catch (error) {
    console.error('Security notice email failed:', error.message)
  }
}

// ---- Registration ----

export const registerPatient = async (req, res) => {
  try {
    const body = req.body || {}
    const name = asText(body.name, 120)
    const email = normalizeEmail(asText(body.email, 254))
    const dob = asText(body.dob, 10)
    const password = typeof body.password === 'string' ? body.password : ''

    if (!name || !password || !email || !body.phone || !dob) {
      return res.json({ success: false, message: 'Missing Details' })
    }

    const security = await getSecuritySettings()
    if (!security.allowPatientSelfRegistration) {
      return res.json({ success: false, message: 'Patient self registration is currently disabled' })
    }

    if (!validator.isEmail(email)) return res.json({ success: false, message: 'Enter a valid email' })
    if (!isPastDate(dob)) return res.json({ success: false, message: 'Birth date must be in the past' })

    const phone = normalizeEgyptPhone(asText(body.phone, 20))
    if (!isValidEgyptPhone(phone)) {
      return res.json({ success: false, message: 'Please enter a valid Egyptian mobile number' })
    }

    // The proof comes first. Without it, this route must not reveal whether an email is registered.
    if (!verifySignupProof(body.emailVerificationToken, 'signup-email', email)) {
      return res.json({ success: false, message: 'Please verify your email using Verify now before creating an account' })
    }

    const passwordPolicy = await validatePasswordAgainstPolicy(password)
    if (!passwordPolicy.valid) return res.json({ success: false, message: passwordPolicy.message })

    if (await findOneByEmail(userModel, email)) {
      return res.json({ success: false, message: 'Email already registered' })
    }
    if (await userModel.findOne({ phone }).select('_id').lean()) {
      return res.json({ success: false, message: 'Phone number already registered' })
    }

    const insurance = await buildInsuranceData(body, req.file, {}, 'patient')
    const user = await userModel.create({
      name,
      email,
      phone,
      dob,
      password: await bcrypt.hash(password, 10),
      patientId: await getNextPatientId(),
      insurance,
      emailVerified: true,
      phoneVerified: false,
      accountVerifiedAt: Date.now()
    })

    await signupVerificationModel.deleteOne({ key: `email:${email}` })
    await logAudit({ action: 'patient_register', actorUserId: user._id, actorRole: 'patient', status: 'success', entityType: 'user', entityId: user._id, req })

    return res.json({ success: true, token: signPatientSession(user), message: 'Account created successfully' })
  } catch (error) {
    // A race between two registrations ends here. Insurance validation messages are safe to show.
    if (error.code === 11000) return res.json({ success: false, message: 'Email or phone number already registered' })
    if (/insurance|medical card|provider/i.test(error.message)) return res.json({ success: false, message: error.message })
    return failWith(res, 'Register', error)
  }
}

// ---- Sign in ----

export const loginPatient = async (req, res) => {
  try {
    const body = req.body || {}
    const loginId = asText(body.email || body.loginId, 254)
    const password = typeof body.password === 'string' ? body.password.slice(0, 200) : ''

    if (!loginId || !password) {
      return res.json({ success: false, message: 'Email/phone and password are required' })
    }

    const isEmail = validator.isEmail(loginId)
    const identifier = isEmail ? normalizeEmail(loginId) : normalizeEgyptPhone(loginId) || loginId.toLowerCase()
    const ip = clientIp(req)

    const security = await getSecuritySettings()
    const lockOptions = { max: security.maxLoginAttempts, windowMs: security.lockoutMinutes * MINUTE, lockMs: security.lockoutMinutes * MINUTE }

    // Applied the same way whether or not the account exists, so a lock reveals nothing about it.
    const lockMinutes = Math.max(await getLockMinutes('login', identifier), await getLockMinutes('login-ip', ip))
    if (lockMinutes) {
      await logAudit({ action: 'login_failed', status: 'failed', reason: 'Locked after repeated failures', entityType: 'user', metadata: { loginId }, req })
      return res.json({ success: false, locked: true, message: lockedMessage(lockMinutes) })
    }

    const user = isEmail
      ? await findOneByEmail(userModel, identifier)
      : await userModel.findOne({ phone: identifier })

    const isMatch = await bcrypt.compare(password, user?.password || DUMMY_HASH)

    if (!user || !isMatch) {
      const { attemptsLeft } = await recordFailure('login', identifier, lockOptions)
      await recordFailure('login-ip', ip, { max: IP_FAILURE_LIMIT, windowMs: lockOptions.windowMs, lockMs: lockOptions.lockMs })
      await logAudit({
        action: 'login_failed',
        actorUserId: user?._id,
        actorRole: user ? 'patient' : undefined,
        status: 'failed',
        reason: 'Invalid credentials',
        entityType: 'user',
        entityId: user?._id,
        metadata: { loginId },
        req
      })
      return res.json({ success: false, message: INVALID_LOGIN, attemptsLeft })
    }

    // Only someone holding the password learns the account's state.
    if (user.isActive === false) {
      await logAudit({ action: 'login_failed', actorUserId: user._id, actorRole: 'patient', status: 'failed', reason: 'Patient account is deactivated', entityType: 'user', entityId: user._id, metadata: { loginId }, req })
      return res.json({ success: false, message: 'Patient account is deactivated' })
    }

    await clearFailures('login', identifier)

    if (!isAccountVerified(user)) {
      try {
        await issueVerificationCodes(user)
      } catch (error) {
        console.log('Verification resend on login:', error.code || 'send failed')
      }
      return res.json({
        success: false,
        verificationRequired: true,
        verificationToken: signVerificationToken(user._id),
        email: maskEmail(user.email),
        phone: maskPhone(user.phone),
        message: 'Verify your email before signing in. A new code was sent.'
      })
    }

    return res.json(await completeSignIn(user, req, { loginId }))
  } catch (error) {
    return failWith(res, 'Login', error)
  }
}

/** Accepts the current TOTP code once, or an unused recovery code. Returns 'totp', 'recovery' or ''. */
const consumeSecondFactor = async (user, code, { allowRecovery = true } = {}) => {
  const value = asText(code, 40)
  const step = matchTotpStep(user.mfa?.secret, value)
  if (step) {
    if (step <= (user.mfa?.lastUsedStep || 0)) return ''
    await userModel.findByIdAndUpdate(user._id, { 'mfa.lastUsedStep': step })
    return 'totp'
  }

  if (allowRecovery && value) {
    const hash = hashRecoveryCode(value)
    const result = await userModel.updateOne(
      { _id: user._id, 'mfa.recoveryCodes': hash },
      { $pull: { 'mfa.recoveryCodes': hash } }
    )
    if (result.modifiedCount) return 'recovery'
  }
  return ''
}

const secondFactorLock = (userId) => getLockMinutes('mfa', userId)
const secondFactorFailure = (userId) => recordFailure('mfa', userId, { max: MFA_MAX_ATTEMPTS })

export const verifyMfaLogin = async (req, res) => {
  try {
    const user = await getPatientFromMfaToken(req.body?.mfaToken)
    if (!user || !user.mfa?.secret || !user.mfa?.enabled) {
      return res.json({ success: false, sessionExpired: true, message: 'MFA session expired. Please sign in again.' })
    }
    if (user.isActive === false) return res.json({ success: false, message: 'Patient account is deactivated' })

    const lockMinutes = await secondFactorLock(user._id)
    if (lockMinutes) return res.json({ success: false, locked: true, message: lockedMessage(lockMinutes) })

    const used = await consumeSecondFactor(user, req.body?.code)
    if (!used) {
      await secondFactorFailure(user._id)
      await logAudit({ action: 'mfa_login_failed', actorUserId: user._id, actorRole: 'patient', status: 'failed', reason: 'Invalid MFA code', entityType: 'user', entityId: user._id, req })
      return res.json({ success: false, message: 'Invalid authenticator code' })
    }

    await clearFailures('mfa', user._id)
    await logAudit({
      action: 'login_success',
      actorUserId: user._id,
      actorRole: 'patient',
      status: 'success',
      entityType: 'user',
      entityId: user._id,
      metadata: { username: user.name, loginId: user.patientId || user.email, mfa: true, recovery: used === 'recovery' },
      req
    })

    const remaining = used === 'recovery' ? (user.mfa.recoveryCodes?.length || 1) - 1 : undefined
    return res.json({ success: true, token: signPatientSession(user), recoveryCodeUsed: used === 'recovery', recoveryCodesLeft: remaining })
  } catch (error) {
    return failWith(res, 'MFA login', error)
  }
}

export const completeMfaLoginSetup = async (req, res) => {
  try {
    const user = await getPatientFromMfaToken(req.body?.mfaToken, 'patient-mfa-setup')
    if (!user || !user.mfa?.secret) {
      return res.json({ success: false, sessionExpired: true, message: 'MFA setup session expired. Please sign in again.' })
    }
    if (user.isActive === false) return res.json({ success: false, message: 'Patient account is deactivated' })

    const lockMinutes = await secondFactorLock(user._id)
    if (lockMinutes) return res.json({ success: false, locked: true, message: lockedMessage(lockMinutes) })

    const step = matchTotpStep(user.mfa.secret, req.body?.code)
    if (!step) {
      await secondFactorFailure(user._id)
      return res.json({ success: false, message: 'Invalid authenticator code' })
    }

    const { codes, hashes } = generateRecoveryCodes()
    await userModel.findByIdAndUpdate(user._id, {
      'mfa.enabled': true,
      'mfa.configuredAt': Date.now(),
      'mfa.recoveryCodes': hashes
    })
    await clearFailures('mfa', user._id)
    await logAudit({ action: 'mfa_enable', actorUserId: user._id, actorRole: 'patient', status: 'success', entityType: 'user', entityId: user._id, metadata: { source: 'required_login_setup' }, req })

    return res.json({ success: true, token: signPatientSession(user), recoveryCodes: codes, message: 'Authenticator MFA configured successfully' })
  } catch (error) {
    return failWith(res, 'MFA login setup', error)
  }
}

// ---- Password reset ----

export const sendResetOtp = async (req, res) => {
  const email = normalizeEmail(asText(req.body?.email, 254))
  if (!email) return res.json({ success: false, message: 'Email is required' })

  // The reply is the same in every case below, so this route cannot be used to test which emails are registered.
  const sent = { success: true, message: RESET_SENT, otpExpiresInMinutes: RESET_OTP_EXPIRY_MS / MINUTE, resendAfterSeconds: RESET_RESEND_COOLDOWN_MS / 1000 }

  try {
    if (!validator.isEmail(email)) return res.json(sent)
    if (!(await consumeQuota('reset-ip', clientIp(req), { max: 20, windowMs: HOUR }))) return res.json(sent)
    if (!(await consumeQuota('reset-email', email, { max: 5, windowMs: HOUR }))) return res.json(sent)

    const user = await findOneByEmail(userModel, email)
    if (!user || user.isActive === false) return res.json(sent)
    if (user.resetOtpSentAt && Date.now() - user.resetOtpSentAt < RESET_RESEND_COOLDOWN_MS) return res.json(sent)

    const otp = generateOtp()
    await userModel.findByIdAndUpdate(user._id, {
      resetOtp: hashOtp(otp),
      resetOtpExpireAt: Date.now() + RESET_OTP_EXPIRY_MS,
      resetOtpSentAt: Date.now()
    })
    await clearFailures('reset', email)

    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: 'Password Reset OTP',
      html: PASSWORD_RESET_TEMPLATE.replace('{{otp}}', otp)
        .replace('{{email}}', user.email)
        .replace('{{FOOTER_YEAR}}', String(new Date().getFullYear()))
        .replace('{{FOOTER_BRAND}}', getPublicAppBrand())
    })
  } catch (error) {
    console.error('Password reset email:', error.message)
  }
  return res.json(sent)
}

const INVALID_RESET = 'Invalid or expired code. Check it or request a new one.'

/**
 * Checks a reset code without consuming it. Wrong guesses count, and the fifth destroys the code.
 * Counted by email and answered identically whether or not the account or a code exists.
 */
const checkResetOtp = async (email, otp) => {
  const lockMinutes = await getLockMinutes('reset', email)
  if (lockMinutes) return { ok: false, message: lockedMessage(lockMinutes), restart: true }

  const found = await findOneByEmail(userModel, email)
  const user = found ? await userModel.findById(found._id).select('+resetOtp') : null
  const live = user?.resetOtp && user.resetOtpExpireAt && user.resetOtpExpireAt >= Date.now()

  if (!live || !otpMatches(user.resetOtp, otp)) {
    const { locked } = await recordFailure('reset', email, { max: OTP_MAX_ATTEMPTS })
    if (locked && user) await userModel.findByIdAndUpdate(user._id, { resetOtp: '', resetOtpExpireAt: 0 })
    return { ok: false, message: INVALID_RESET, restart: locked }
  }
  return { ok: true, user }
}

export const verifyResetOtp = async (req, res) => {
  const email = normalizeEmail(asText(req.body?.email, 254))
  const otp = asText(req.body?.otp, 10)
  if (!email || !otp) return res.json({ success: false, message: 'Email and OTP are required' })

  try {
    const result = await checkResetOtp(email, otp)
    if (!result.ok) return res.json({ success: false, message: result.message, restart: result.restart })
    return res.json({ success: true, message: 'OTP verified successfully' })
  } catch (error) {
    return failWith(res, 'Verify reset code', error)
  }
}

export const resetPatientPassword = async (req, res) => {
  const email = normalizeEmail(asText(req.body?.email, 254))
  const otp = asText(req.body?.otp, 10)
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''

  if (!email || !otp || !newPassword) {
    return res.json({ success: false, message: 'Email, OTP, and new password are required' })
  }

  try {
    const result = await checkResetOtp(email, otp)
    if (!result.ok) return res.json({ success: false, message: result.message, restart: result.restart })

    const policy = await validatePasswordAgainstPolicy(newPassword)
    if (!policy.valid) return res.json({ success: false, message: policy.message })

    const { user } = result
    const consumed = await userModel.updateOne(
      { _id: user._id, resetOtp: user.resetOtp },
      {
        password: await bcrypt.hash(newPassword, 10),
        resetOtp: '',
        resetOtpExpireAt: 0,
        passwordChangedAt: Date.now(),
        sessionsValidAfter: sessionCutoffNow()
      }
    )
    if (!consumed.modifiedCount) return res.json({ success: false, message: INVALID_RESET, restart: true })

    await clearFailures('reset', email)
    await clearFailures('login', email)
    await clearFailures('login', user.phone)
    await logAudit({ action: 'password_reset', actorUserId: user._id, actorRole: 'patient', status: 'success', entityType: 'user', entityId: user._id, req })
    void pushNotification({
      recipientRole: 'patient',
      recipientId: user._id,
      title: 'Password changed',
      message: 'Your password was changed and other devices were signed out.',
      type: 'security'
    })
    await sendSecurityNotice(user.email, 'your password was changed', 'Your password was just changed. If this was not you, contact the clinic right away.')

    return res.json({ success: true, message: 'Password reset successfully' })
  } catch (error) {
    return failWith(res, 'Reset password', error)
  }
}

// ---- MFA management, signed in ----

const MFA_SELECT = 'email mfa.enabled mfa.requiredByAdmin +mfa.secret +mfa.lastUsedStep +mfa.recoveryCodes'

/**
 * Whether policy forces MFA on this person. isMfaRequiredForProfile also answers true when they merely opted in,
 * which is right at sign-in but kept anyone who had turned MFA on from ever turning it off.
 */
const isMfaMandatory = (security, user) =>
  isMfaRequiredForProfile(security, 'patient', { mfa: { requiredByAdmin: Boolean(user?.mfa?.requiredByAdmin), enabled: false } })

export const getMfaStatus = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.userId).select(MFA_SELECT)
    const security = await getSecuritySettings()
    return res.json({
      success: true,
      mfa: {
        enabled: Boolean(user?.mfa?.enabled),
        required: isMfaMandatory(security, user),
        requiredByAdmin: Boolean(user?.mfa?.requiredByAdmin),
        canSelfManage: security.mfaAllowUserOptIn !== false,
        recoveryCodesLeft: user?.mfa?.recoveryCodes?.length || 0
      }
    })
  } catch (error) {
    return failWith(res, 'MFA status', error)
  }
}

export const startMfaSetup = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.userId).select(MFA_SELECT)
    if (!user) return res.json({ success: false, message: 'User not found' })

    const security = await getSecuritySettings()
    if (!isMfaMandatory(security, user) && security.mfaAllowUserOptIn === false) {
      return res.json({ success: false, message: 'Self-service MFA is disabled by admin' })
    }
    // Setup used to overwrite the secret and switch MFA off, so a stolen session could remove it without a code.
    if (user.mfa?.enabled) {
      return res.json({ success: false, message: 'Authenticator MFA is already on. Turn it off first to set it up again.' })
    }

    const secret = generateMfaSecret()
    await userModel.findByIdAndUpdate(user._id, { 'mfa.secret': secret, 'mfa.enabled': false })
    return res.json({ success: true, setup: buildMfaSetupPayload({ secret, accountName: user.email }) })
  } catch (error) {
    return failWith(res, 'MFA setup', error)
  }
}

export const enableMfa = async (req, res) => {
  try {
    const userId = req.user.userId
    const user = await userModel.findById(userId).select(MFA_SELECT)
    if (!user?.mfa?.secret) return res.json({ success: false, message: 'Start MFA setup first' })

    const lockMinutes = await secondFactorLock(userId)
    if (lockMinutes) return res.json({ success: false, locked: true, message: lockedMessage(lockMinutes) })

    const step = matchTotpStep(user.mfa.secret, req.body?.code)
    if (!step) {
      await secondFactorFailure(userId)
      return res.json({ success: false, message: 'Invalid authenticator code' })
    }

    const { codes, hashes } = generateRecoveryCodes()
    await userModel.findByIdAndUpdate(userId, {
      'mfa.enabled': true,
      'mfa.configuredAt': Date.now(),
      'mfa.recoveryCodes': hashes
    })
    await clearFailures('mfa', userId)
    await logAudit({ action: 'mfa_enable', status: 'success', actorUserId: userId, actorRole: 'patient', entityType: 'user', entityId: userId, req })
    return res.json({ success: true, message: 'Authenticator MFA enabled', recoveryCodes: codes })
  } catch (error) {
    return failWith(res, 'MFA enable', error)
  }
}

export const disableMfa = async (req, res) => {
  try {
    const userId = req.user.userId
    const user = await userModel.findById(userId).select(MFA_SELECT)
    const security = await getSecuritySettings()
    if (isMfaMandatory(security, user)) {
      return res.json({ success: false, message: 'MFA is required by policy and cannot be disabled' })
    }

    if (user?.mfa?.enabled) {
      const lockMinutes = await secondFactorLock(userId)
      if (lockMinutes) return res.json({ success: false, locked: true, message: lockedMessage(lockMinutes) })

      if (!(await consumeSecondFactor(user, req.body?.code))) {
        await secondFactorFailure(userId)
        return res.json({ success: false, message: 'Invalid authenticator code' })
      }
    }

    await userModel.findByIdAndUpdate(userId, {
      'mfa.enabled': false,
      'mfa.secret': '',
      'mfa.recoveryCodes': [],
      'mfa.lastUsedStep': 0,
      'mfa.resetAt': Date.now()
    })
    await clearFailures('mfa', userId)
    await logAudit({ action: 'mfa_disable', status: 'success', actorUserId: userId, actorRole: 'patient', entityType: 'user', entityId: userId, req })
    return res.json({ success: true, message: 'Authenticator MFA disabled' })
  } catch (error) {
    return failWith(res, 'MFA disable', error)
  }
}

export const regenerateRecoveryCodes = async (req, res) => {
  try {
    const userId = req.user.userId
    const user = await userModel.findById(userId).select(MFA_SELECT)
    if (!user?.mfa?.enabled) return res.json({ success: false, message: 'Turn on authenticator MFA first' })

    const lockMinutes = await secondFactorLock(userId)
    if (lockMinutes) return res.json({ success: false, locked: true, message: lockedMessage(lockMinutes) })

    if (!(await consumeSecondFactor(user, req.body?.code, { allowRecovery: false }))) {
      await secondFactorFailure(userId)
      return res.json({ success: false, message: 'Invalid authenticator code' })
    }

    const { codes, hashes } = generateRecoveryCodes()
    await userModel.findByIdAndUpdate(userId, { 'mfa.recoveryCodes': hashes })
    await logAudit({ action: 'mfa_recovery_codes_regenerated', status: 'success', actorUserId: userId, actorRole: 'patient', entityType: 'user', entityId: userId, req })
    return res.json({ success: true, recoveryCodes: codes, message: 'New recovery codes created' })
  } catch (error) {
    return failWith(res, 'Recovery codes', error)
  }
}

// ---- Signed-in security actions ----

export const changePassword = async (req, res) => {
  try {
    const userId = req.user.userId
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword.slice(0, 200) : ''
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''
    if (!currentPassword || !newPassword) return res.json({ success: false, message: 'Enter your current and new password' })

    const lockMinutes = await getLockMinutes('change-password', userId)
    if (lockMinutes) return res.json({ success: false, locked: true, message: lockedMessage(lockMinutes) })

    const user = await userModel.findById(userId)
    if (!user) return res.json({ success: false, message: 'User not found' })

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      await recordFailure('change-password', userId, { max: 5 })
      return res.json({ success: false, message: 'Your current password is not correct' })
    }

    const policy = await validatePasswordAgainstPolicy(newPassword)
    if (!policy.valid) return res.json({ success: false, message: policy.message })
    if (await bcrypt.compare(newPassword, user.password)) {
      return res.json({ success: false, message: 'Choose a password different from your current one' })
    }

    await userModel.findByIdAndUpdate(userId, {
      password: await bcrypt.hash(newPassword, 10),
      passwordChangedAt: Date.now(),
      sessionsValidAfter: sessionCutoffNow()
    })
    await clearFailures('change-password', userId)
    await logAudit({ action: 'password_change', status: 'success', actorUserId: userId, actorRole: 'patient', entityType: 'user', entityId: userId, req })
    await sendSecurityNotice(user.email, 'your password was changed', 'Your password was just changed. If this was not you, contact the clinic right away.')

    return res.json({ success: true, token: signPatientSession(user), message: 'Password changed. Other devices were signed out.' })
  } catch (error) {
    return failWith(res, 'Change password', error)
  }
}

export const signOutEverywhere = async (req, res) => {
  try {
    const userId = req.user.userId
    const user = await userModel.findByIdAndUpdate(userId, { sessionsValidAfter: sessionCutoffNow() }, { new: true })
    if (!user) return res.json({ success: false, message: 'User not found' })
    await logAudit({ action: 'sign_out_everywhere', status: 'success', actorUserId: userId, actorRole: 'patient', entityType: 'user', entityId: userId, req })
    return res.json({ success: true, token: signPatientSession(user), message: 'All other devices were signed out' })
  } catch (error) {
    return failWith(res, 'Sign out everywhere', error)
  }
}

export const getPasswordPolicy = async (req, res) => {
  try {
    const p = await getSecuritySettings()
    return res.json({
      success: true,
      policy: {
        minLength: p.passwordMinLength,
        strong: p.enforceStrongPasswords,
        uppercase: p.enforceStrongPasswords && p.requireUppercase,
        lowercase: p.enforceStrongPasswords && p.requireLowercase,
        number: p.enforceStrongPasswords && p.requireNumber,
        special: p.enforceStrongPasswords && p.requireSpecialCharacter
      }
    })
  } catch (error) {
    return failWith(res, 'Password policy', error)
  }
}

/** Best-effort removal of a replaced Cloudinary upload. Failure leaves an orphan file, never a broken save. */
export const destroyCloudinaryUpload = async (url) => {
  const match = String(url || '').match(/\/upload\/(?:v\d+\/)?([^.]+)\.[a-z0-9]+$/i)
  if (!match) return
  try {
    await cloudinary.uploader.destroy(match[1], { invalidate: true })
  } catch (error) {
    console.error('Cloudinary cleanup failed:', error.message)
  }
}
