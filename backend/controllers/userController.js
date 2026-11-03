import validator from 'validator'
import bcrypt from 'bcryptjs'
import userModel from '../models/userModel.js'
import jwt from 'jsonwebtoken'
import { v2 as cloudinary } from 'cloudinary'
import doctorModel from '../models/doctorModel.js'
import appointmentModel from '../models/appointmentModel.js'
import prescriptionModel from '../models/prescriptionModel.js'
import counterModel from '../models/counterModel.js'
import ratingModel from '../models/ratingModel.js'
import { PASSWORD_RESET_TEMPLATE } from "../config/EmailTemplates.js";
import { getPublicAppBrand } from '../config/publicBrand.js'
import transporter from "../config/nodemailer.js";
import { createJwtPayload } from '../middlewares/rbac.js'
import { logAudit } from '../services/auditService.js'
import { refreshRefundsForUser, refundAppointmentPayment } from './paymentController.js'
import { getVisitFeeQuote } from '../services/globalVisitFeesService.js'
import { patientCanBookConsultation } from '../services/visitFeeEligibilityService.js'
import { createAppointmentFromBooking, findOwnActiveAppointment, findPatientClash, isValidId, releaseHold, toPatientAppointment, unlockSlot, validateBookingRequest } from '../services/bookingService.js'
import { acquireSlotForUser, consumeHold, reconcileUserHolds } from '../services/slotHoldService.js'
import { closeWaitlistAfterBooking, processWaitlistForDoctor } from '../services/waitlistService.js'
import { getSecuritySettings, isMfaRequiredForProfile, validatePasswordAgainstPolicy } from '../services/securityPolicyService.js'
import { buildMfaSetupPayload, generateMfaSecret, verifyTotpCode } from '../services/mfaService.js'
import { notifyAppointmentBooked, notifyAppointmentCancelled } from '../services/notificationService.js'
import { assertValidInsuranceProvider } from '../services/insuranceProvidersService.js'
import { attachInsuranceVerification } from '../services/insuranceVerificationService.js'
import { findOneByEmail, normalizeEmail } from '../utils/emailUtils.js'
import { isValidEgyptPhone, normalizeEgyptPhone } from '../utils/egyptPhone.js'
import {
  buildRegistrationVerificationResponse,
  isAccountVerified,
  signVerificationToken,
  issueVerificationCodes,
  maskEmail,
  maskPhone
} from '../services/accountVerificationService.js'
import { verifySignupProof } from '../services/signupVerificationService.js'

const MFA_TOKEN_EXPIRES_IN = '10m'

const signPatientToken = (user) => jwt.sign(createJwtPayload({ id: user._id, role: 'patient', email: user.email }), process.env.JWT_SECRET)

const signPatientMfaToken = (user, purpose = 'patient-mfa') => jwt.sign({
  id: user._id.toString(),
  role: 'patient',
  purpose,
  email: user.email
}, process.env.JWT_SECRET, { expiresIn: MFA_TOKEN_EXPIRES_IN })

const getPatientFromMfaToken = async (mfaToken, purpose = 'patient-mfa') => {
  const decoded = jwt.verify(mfaToken, process.env.JWT_SECRET)
  if (decoded?.purpose !== purpose || decoded?.role !== 'patient' || !decoded?.id) return null
  return userModel.findById(decoded.id).select('+mfa.secret')
}


// Function to get next ID
const getNextPatientId = async () => {
    const counter = await counterModel.findByIdAndUpdate('patientId',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    
    return `PAT${counter.seq.toString().padStart(2, '0')}`;
};

const parseBoolean = (value) => value === true || value === 'true' || value === 'on' || value === '1'

const normalizePhone = (phone = '') => {
  const egypt = normalizeEgyptPhone(phone)
  if (egypt) return egypt
  return String(phone).trim()
}

const normalizePatientGender = (gender) => ['Male', 'Female'].includes(gender) ? gender : 'Not Selected'

const getDoctorPaymentError = (doctor, paymentMethod) => {
  if (paymentMethod === 'Cash' && doctor.acceptsCash === false) return 'This doctor does not accept cash payment'
  if (paymentMethod === 'Visa' && doctor.acceptsOnlinePayment === false) return 'This doctor does not accept online payment'
  return ''
}

const isPastDate = (value) => {
  if (!value || typeof value !== 'string') return false
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return false

  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  return date < todayUtc
}

const buildInsuranceData = async (body = {}, file, existingInsurance = {}, updatedBy = 'patient', options = {}) => {
  const enabled = parseBoolean(body.insuranceEnabled)

  if (!enabled) {
    return {
      enabled: false,
      provider: '',
      fullName: '',
      birthDate: '',
      idNumber: '',
      expiryDate: '',
      medicalCardPhoto: existingInsurance.medicalCardPhoto || '',
      updatedAt: Date.now(),
      updatedBy
    }
  }

  let provider = ''
  if (enabled) {
    let raw = String(body.insuranceProvider || body.insuranceProviderName || '').trim()
    if (!raw && existingInsurance?.provider) raw = String(existingInsurance.provider).trim()
    provider = await assertValidInsuranceProvider(raw)
  }

  const insurance = {
    enabled: true,
    provider,
    fullName: String(body.insuranceFullName || body.fullName || '').trim(),
    birthDate: String(body.insuranceBirthDate || body.birthDate || '').trim(),
    idNumber: String(body.insuranceIdNumber || body.idNumber || '').trim(),
    expiryDate: String(body.insuranceExpiryDate || body.expiryDate || '').trim(),
    medicalCardPhoto: existingInsurance.medicalCardPhoto || '',
    updatedAt: Date.now(),
    updatedBy
  }

  if (!insurance.fullName || !insurance.birthDate || !insurance.idNumber || !insurance.expiryDate) {
    throw new Error('Please complete all insurance fields')
  }

  if (!isPastDate(insurance.birthDate)) {
    throw new Error('Insurance birth date must be in the past')
  }

  if (!file && !insurance.medicalCardPhoto) {
    throw new Error('Please attach a photo of the medical card')
  }

  if (file) {
    const upload = await cloudinary.uploader.upload(file.path, { resource_type: 'auto' })
    insurance.medicalCardPhoto = upload.secure_url
  }

  return attachInsuranceVerification(insurance, {
    updatedBy,
    existingInsurance,
    verifiedBy: options.verifiedBy || (updatedBy === 'receptionist' ? String(body.verifiedBy || body.receptionistId || '').trim() : '')
  })
}



// API to register user
const registerUser = async (req, res) => {
    try {
        const body = req.body || {}
        const { name, password, dob } = body;
        const email = normalizeEmail(body.email)

        if (!name || !password || !email || !body.phone || !dob) {
            return res.json({success: false, message: 'Missing Details'});
        }

        const security = await getSecuritySettings()
        if (!security.allowPatientSelfRegistration) {
            return res.json({ success: false, message: 'Patient self registration is currently disabled' })
        }

        if (!isPastDate(dob)) {
            return res.json({success: false, message: 'Birth date must be in the past'});
        }

        if (!validator.isEmail(email)) {
            return res.json({success: false, message: 'Enter a valid email'});
        }

        const phone = normalizePhone(body.phone)
        if (!isValidEgyptPhone(phone)) {
            return res.json({ success: false, message: 'Please enter a valid Egyptian mobile number' })
        }

        const passwordPolicy = await validatePasswordAgainstPolicy(password)
        if (!passwordPolicy.valid) {
            return res.json({success: false, message: passwordPolicy.message});
        }

        const existingUser = await findOneByEmail(userModel, email);
        if (existingUser) {
            if (!isAccountVerified(existingUser)) {
                try {
                    const response = await buildRegistrationVerificationResponse(existingUser);
                    return res.json({
                        ...response,
                        message: 'Account exists but is not verified. A new code was sent to your email.'
                    });
                } catch (error) {
                    return res.json({ success: false, message: error.message || 'Could not send verification codes' });
                }
            }
            return res.json({success: false, message: 'Email already registered'});
        }

        const existingPhone = await userModel.findOne({ phone });
        if (existingPhone) {
            return res.json({success: false, message: 'Phone number already registered'});
        }

        if (!verifySignupProof(body.emailVerificationToken, 'signup-email', email)) {
            return res.json({ success: false, message: 'Please verify your email using Verify now before creating an account' })
        }
        // Counter se ID lo
        const patientId = await getNextPatientId();

        console.log('New Patient ID:', patientId);

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userData = {
            name,
            email,
            phone,
            dob,
            password: hashedPassword,
            patientId: patientId,
            insurance: await buildInsuranceData(body, req.file, {}, 'patient'),
            emailVerified: true,
            phoneVerified: false,
            accountVerifiedAt: Date.now()
        };

        const newUser = new userModel(userData);
        const user = await newUser.save();

        const token = signPatientToken(user)
        return res.json({ success: true, token, message: 'Account created successfully' })

    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message});
    }
};




// API for user login
const loginUser = async (req,res) => {
    try {
        
      const body = req.body || {}
      const { password} = body
      const loginId = String(body.email || body.loginId || '').trim()

      if (!loginId || !password) {
        return res.json({ success: false, message: 'Email/phone and password are required' })
      }

      const phoneLookup = normalizePhone(loginId)
      const user = validator.isEmail(loginId)
        ? await findOneByEmail(userModel, loginId, {}, '+mfa.secret')
        : await userModel.findOne({ phone: phoneLookup }).select('+mfa.secret')

      if(!user){
       await logAudit({
        action: 'login_failed',
        status: 'failed',
        reason: 'User does not exist',
        entityType: 'user',
        metadata: { loginId },
        req
       })
       return res.json({success:false, message:'User does not exist'})
      }

      if(user.isActive === false) {
        await logAudit({
          action: 'login_failed',
          actorUserId: user._id,
          actorRole: 'patient',
          status: 'failed',
          reason: 'Patient account is deactivated',
          entityType: 'user',
          entityId: user._id,
          metadata: { loginId },
          req
        })
        return res.json({success:false, message:'Patient account is deactivated'})
      }

      const isMatch = await bcrypt.compare(password,user.password)

      if(isMatch) {
        if (!isAccountVerified(user)) {
          try {
            await issueVerificationCodes(user);
          } catch (error) {
            console.log('Verification resend on login:', error.message);
          }
          return res.json({
            success: false,
            verificationRequired: true,
            verificationToken: signVerificationToken(user._id),
            email: maskEmail(user.email),
            phone: maskPhone(user.phone),
            message: 'Verify your email before signing in. A new code was sent.'
          });
        }

        const security = await getSecuritySettings()
        const mfaRequired = isMfaRequiredForProfile(security, 'patient', user)
        const hasConfiguredMfa = Boolean(user.mfa?.enabled && user.mfa?.secret)

        if (mfaRequired && !hasConfiguredMfa) {
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
          return res.json({
            success: false,
            mfaSetupRequired: true,
            mfaToken: signPatientMfaToken(user, 'patient-mfa-setup'),
            setup: buildMfaSetupPayload({ secret, accountName: user.email }),
            message: 'Authenticator setup is required before login'
          })
        }

        if (mfaRequired && hasConfiguredMfa) {
          return res.json({
            success: false,
            mfaRequired: true,
            mfaToken: signPatientMfaToken(user),
            message: 'Enter your authenticator code'
          })
        }

        const token = signPatientToken(user)
        await logAudit({
          action: 'login_success',
          actorUserId: user._id,
          actorRole: 'patient',
          status: 'success',
          entityType: 'user',
          entityId: user._id,
          metadata: {
            username: user.name,
            loginId: user.patientId || user.email,
            email: user.email
          },
          req
        })
        res.json({success:true, token}) 
      } else {
        await logAudit({
          action: 'login_failed',
          actorUserId: user._id,
          actorRole: 'patient',
          status: 'failed',
          reason: 'Invalid credentials',
          entityType: 'user',
          entityId: user._id,
          metadata: { loginId },
          req
        })
        res.json({success:false, message:'Invalid credentails'})
      }

    } catch (error) {
      console.log(error)
      res.json({success:false,message:error.message})  
    }
}

const verifyPatientMfaLogin = async (req, res) => {
  try {
    const { mfaToken, code } = req.body
    const user = await getPatientFromMfaToken(mfaToken)
    if (!user || !user.mfa?.secret || !user.mfa?.enabled) {
      return res.json({ success: false, message: 'Invalid MFA session' })
    }

    if (user.isActive === false) {
      return res.json({ success: false, message: 'Patient account is deactivated' })
    }

    if (!verifyTotpCode(user.mfa.secret, code)) {
      await logAudit({
        action: 'mfa_login_failed',
        actorUserId: user._id,
        actorRole: 'patient',
        status: 'failed',
        reason: 'Invalid MFA code',
        entityType: 'user',
        entityId: user._id,
        req
      })
      return res.json({ success: false, message: 'Invalid authenticator code' })
    }

    const token = signPatientToken(user)
    await logAudit({
      action: 'login_success',
      actorUserId: user._id,
      actorRole: 'patient',
      status: 'success',
      entityType: 'user',
      entityId: user._id,
      metadata: { username: user.name, loginId: user.patientId || user.email, mfa: true },
      req
    })

    res.json({ success: true, token })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: 'MFA session expired. Please sign in again.' })
  }
}

const completePatientMfaLoginSetup = async (req, res) => {
  try {
    const { mfaToken, code } = req.body
    const user = await getPatientFromMfaToken(mfaToken, 'patient-mfa-setup')
    if (!user || !user.mfa?.secret) {
      return res.json({ success: false, message: 'Invalid MFA setup session' })
    }

    if (user.isActive === false) {
      return res.json({ success: false, message: 'Patient account is deactivated' })
    }

    if (!verifyTotpCode(user.mfa.secret, code)) {
      return res.json({ success: false, message: 'Invalid authenticator code' })
    }

    await userModel.findByIdAndUpdate(user._id, {
      'mfa.enabled': true,
      'mfa.configuredAt': Date.now()
    })

    const token = signPatientToken(user)
    await logAudit({
      action: 'mfa_enable',
      actorUserId: user._id,
      actorRole: 'patient',
      status: 'success',
      entityType: 'user',
      entityId: user._id,
      metadata: { source: 'required_login_setup' },
      req
    })

    res.json({ success: true, token, message: 'Authenticator MFA configured successfully' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: 'MFA setup session expired. Please sign in again.' })
  }
}




// Send OTP to email for password reset
export const sendPasswordResetOtp = async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    return res.json({ success: false, message: 'Email is required' });
  }

  try {
    // Check if user exists
    const user = await findOneByEmail(userModel, email);
    
    if (!user) {
      return res.json({ success: false, message: 'User not found with this email' });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Save OTP in database with expiry time (2 minutes)
    user.resetOtp = otp;
    user.resetOtpExpireAt = Date.now() + 2 * 60 * 1000; 
    await user.save();

    // Send OTP via email using Nodemailer
    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: 'Password Reset OTP',
      html: PASSWORD_RESET_TEMPLATE.replace('{{otp}}', otp)
        .replace('{{email}}', user.email)
        .replace('{{FOOTER_YEAR}}', String(new Date().getFullYear()))
        .replace('{{FOOTER_BRAND}}', getPublicAppBrand())
    };

    await transporter.sendMail(mailOptions);

    return res.json({ 
      success: true, 
      message: 'OTP sent to your email successfully' 
    });

  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};





// Verify the OTP entered by user
export const verifyPasswordResetOtp = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { otp } = req.body;

  if (!email || !otp) {
    return res.json({ success: false, message: 'Email and OTP are required' });
  }

  try {
    const user = await findOneByEmail(userModel, email);

    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    // Check if OTP is valid
    if (user.resetOtp === '' || user.resetOtp !== otp) {
      return res.json({ success: false, message: 'Invalid OTP' });
    }

    // Check if OTP is expired
    if (user.resetOtpExpireAt < Date.now()) {
      return res.json({ success: false, message: 'OTP has expired' });
    }

     // OTP VERIFIED - AB EXPIRY HATA DO
    user.resetOtpExpireAt = 0; // Expiry remove kar diya
    await user.save();

    return res.json({ 
      success: true, 
      message: 'OTP verified successfully' 
    });

  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};





// Reset password after OTP verification
export const resetPassword = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.json({ 
      success: false, 
      message: 'Email, OTP, and new password are required' 
    });
  }

  try {
    const user = await findOneByEmail(userModel, email);

    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    // Verify OTP again before resetting password
    if (user.resetOtp === '' || user.resetOtp !== otp) {
      return res.json({ success: false, message: 'Invalid OTP' });
    }
    const passwordPolicy = await validatePasswordAgainstPolicy(newPassword)
    if (!passwordPolicy.valid) {
      return res.json({ success: false, message: passwordPolicy.message })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP fields
    user.password = hashedPassword;
    user.resetOtp = '';
    user.resetOtpExpireAt = 0;

    await user.save();

    return res.json({ 
      success: true, 
      message: 'Password reset successfully' 
    });

  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};





// API to get user profile data
const getProfile = async (req,res) => {
  try {
    
   const { userId } = req.user
   const userData = await userModel.findById(userId).select('-password')

   res.json({success:true, userData})

  } catch (error) {
    console.log(error)
    res.json({success:false, message:error.message})
  }
}




// API to update user Profile
const updateProfile = async (req,res) => {
  try {
    
    const userId = req.user.userId; 
    const body = req.body || {}
    const { name, phone, address, dob, gender } = body;
    const imageFile = req.file

    if( !name || !phone || !dob ){
      return res.json({success: false, message:"Data Missing"})
    }

    if (!isPastDate(dob)) {
      return res.json({ success: false, message: 'Birth date must be in the past' })
    }

    const existingPhone = await userModel.findOne({ phone: normalizePhone(phone), _id: { $ne: userId } })
    if (existingPhone) {
      return res.json({ success: false, message: 'Phone number already registered' })
    }

    let parsedAddress = { line1: '', line2: '' }
    if (address) {
      parsedAddress = typeof address === 'string' ? JSON.parse(address) : address
    }

    await userModel.findByIdAndUpdate(userId,{
      name: String(name).trim(),
      phone: normalizePhone(phone),
      address: parsedAddress,
      dob,
      gender: normalizePatientGender(gender)
    })

    if(imageFile){
      
      // upload image to cloudinary
      const imageUpload = await cloudinary.uploader.upload(imageFile.path,{resource_type: 'image'})
      const imageURL = imageUpload.secure_url

      await userModel.findByIdAndUpdate(userId, {image:imageURL})
    }

    res.json({success: true, message:"Profile Updated"})

  } catch (error) {
    console.log(error)
    res.json({success:false, message:error.message})
  }
}

const updateInsurance = async (req, res) => {
  try {
    const userId = req.user.userId
    const user = await userModel.findById(userId).select('insurance')

    if (!user) {
      return res.json({ success: false, message: 'User not found' })
    }

    const insurance = await buildInsuranceData(req.body || {}, req.file, user.insurance || {}, 'patient')
    const updatedUser = await userModel.findByIdAndUpdate(userId, { insurance }, { new: true }).select('-password -resetOtp -resetOtpExpireAt')

    await logAudit({
      action: 'insurance_update',
      actorUserId: userId,
      actorRole: 'patient',
      status: 'success',
      targetUserId: userId,
      entityType: 'user',
      entityId: userId,
      metadata: { enabled: insurance.enabled },
      req
    })

    res.json({ success: true, message: 'Insurance updated', userData: updatedUser, insurance: updatedUser.insurance })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const getPatientMfaStatus = async (req, res) => {
  try {
    const userId = req.user.userId
    const user = await userModel.findById(userId).select('email mfa')
    const security = await getSecuritySettings()
    res.json({
      success: true,
      mfa: {
        enabled: Boolean(user?.mfa?.enabled),
        required: isMfaRequiredForProfile(security, 'patient', user),
        requiredByAdmin: Boolean(user?.mfa?.requiredByAdmin),
        canSelfManage: security.mfaAllowUserOptIn !== false
      }
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const startPatientMfaSetup = async (req, res) => {
  try {
    const userId = req.user.userId
    const user = await userModel.findById(userId).select('email mfa')
    const security = await getSecuritySettings()
    if (!isMfaRequiredForProfile(security, 'patient', user) && security.mfaAllowUserOptIn === false) {
      return res.json({ success: false, message: 'Self-service MFA is disabled by admin' })
    }

    const secret = generateMfaSecret()
    await userModel.findByIdAndUpdate(userId, { 'mfa.secret': secret, 'mfa.enabled': false })
    res.json({ success: true, setup: buildMfaSetupPayload({ secret, accountName: user.email }) })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const enablePatientMfa = async (req, res) => {
  try {
    const userId = req.user.userId
    const { code } = req.body
    const user = await userModel.findById(userId).select('+mfa.secret')
    if (!user?.mfa?.secret) return res.json({ success: false, message: 'Start MFA setup first' })
    if (!verifyTotpCode(user.mfa.secret, code)) return res.json({ success: false, message: 'Invalid authenticator code' })

    await userModel.findByIdAndUpdate(userId, { 'mfa.enabled': true, 'mfa.configuredAt': Date.now() })
    await logAudit({
      action: 'mfa_enable',
      status: 'success',
      actorUserId: userId,
      actorRole: 'patient',
      entityType: 'user',
      entityId: userId,
      req
    })
    res.json({ success: true, message: 'Authenticator MFA enabled' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const disablePatientMfa = async (req, res) => {
  try {
    const userId = req.user.userId
    const { code } = req.body
    const user = await userModel.findById(userId).select('+mfa.secret')
    const security = await getSecuritySettings()
    if (isMfaRequiredForProfile(security, 'patient', user)) {
      return res.json({ success: false, message: 'MFA is required by policy and cannot be disabled' })
    }
    if (user?.mfa?.secret && !verifyTotpCode(user.mfa.secret, code)) {
      return res.json({ success: false, message: 'Invalid authenticator code' })
    }

    await userModel.findByIdAndUpdate(userId, { 'mfa.enabled': false, 'mfa.secret': '', 'mfa.resetAt': Date.now() })
    await logAudit({
      action: 'mfa_disable',
      status: 'success',
      actorUserId: userId,
      actorRole: 'patient',
      entityType: 'user',
      entityId: userId,
      req
    })
    res.json({ success: true, message: 'Authenticator MFA disabled' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const medicalHistoryFields = ['conditions', 'allergies', 'surgeries', 'familyHistory', 'socialHistory', 'notes']

const normalizeMedicalHistory = (medicalHistory = {}) => {
  return medicalHistoryFields.reduce((acc, field) => {
    acc[field] = String(medicalHistory[field] || '').trim()
    return acc
  }, {})
}

// API to get current patient's medical history
const getMedicalHistory = async (req, res) => {
  try {
    const userId = req.user.userId
    const userData = await userModel.findById(userId).select('medicalHistory')

    if (!userData) {
      return res.json({ success: false, message: 'User not found' })
    }

    res.json({ success: true, medicalHistory: userData.medicalHistory || {} })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const saveMedicalHistory = async (req, res, message = 'Medical history saved') => {
  try {
    const userId = req.user.userId
    const nextHistory = normalizeMedicalHistory(req.body.medicalHistory || req.body)

    nextHistory.updatedAt = Date.now()
    nextHistory.updatedBy = 'patient'

    const userData = await userModel.findByIdAndUpdate(
      userId,
      { medicalHistory: nextHistory },
      { new: true }
    ).select('medicalHistory')

    if (!userData) {
      return res.json({ success: false, message: 'User not found' })
    }

    await logAudit({
      action: 'medical_history_update',
      actorUserId: userId,
      actorRole: 'patient',
      status: 'success',
      targetUserId: userId,
      entityType: 'user',
      entityId: userId,
      metadata: { changedFields: medicalHistoryFields },
      req
    })

    res.json({ success: true, message, medicalHistory: userData.medicalHistory })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// API to create/save current patient's medical history
const createMedicalHistory = async (req, res) => {
  return saveMedicalHistory(req, res, 'Medical history saved')
}

// API to update current patient's medical history
const updateMedicalHistory = async (req, res) => {
  return saveMedicalHistory(req, res, 'Medical history updated')
}

const getVisitFeeEligibility = async (req, res) => {
  try {
    const userId = req.user.userId
    const { docId } = req.params

    const docData = await doctorModel.findById(docId).select('fees name')
    if (!docData) {
      return res.json({ success: false, message: 'Doctor not found' })
    }

    const quote = await getVisitFeeQuote(docData, 'examination')
    const eligibility = await patientCanBookConsultation(userId, docId)

    res.json({
      success: true,
      canBookConsultation: eligibility.allowed,
      lastExaminationAt: eligibility.lastExaminationAt,
      consultationUntil: eligibility.consultationUntil,
      examinationFee: quote.examinationAmount,
      consultationFee: quote.consultationAmount,
      globalFeesEnabled: Boolean(quote.globalVisitFees?.enabled)
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

//  API to book appointment
const bookAppointment = async (req,res) => {

  let lockedSlot = null

  try {

    const userId = req.user.userId;
    const paymentMethod = String(req.body.paymentMethod || 'Cash').trim()

    if (paymentMethod === 'Visa') {
      // Reserving a slot as "Visa" without paying would hold it forever. Online payment has its own flow.
      return res.json({ success: false, message: 'Please complete online payment to book with Visa' })
    }
    if (!['Cash', 'Insurance'].includes(paymentMethod)) {
      return res.json({ success: false, message: 'Please choose Cash or Visa payment method' })
    }

    const booking = await validateBookingRequest({ userId, body: req.body, paymentMethod })
    if (booking.error) {
      return res.json({ success: false, message: booking.error })
    }
    const { docId, doctor, user, slotDate, slotTime, appointmentType } = booking

    const alreadyBooked = await findOwnActiveAppointment({ userId, docId, slotDate, slotTime })
    if (alreadyBooked) {
      // A double click or a retry after a lost response lands here. The patient has what they asked for.
      return res.json({
        success: true,
        alreadyBooked: true,
        message: 'Appointment Booked',
        appointmentId: alreadyBooked._id,
        appointment: toPatientAppointment(alreadyBooked)
      })
    }
    if (await findPatientClash({ userId, slotDate, slotTime })) {
      return res.json({ success: false, message: 'You already have another appointment at this time' })
    }

    const acquired = await acquireSlotForUser({ userId, docId, slotDate, slotTime, appointmentType })
    if (!acquired.ok) {
      return res.json({ success: false, message: 'Slot not available' })
    }
    lockedSlot = { docId, slotDate, slotTime, appointmentType, hold: acquired.hold }

    const created = await createAppointmentFromBooking(booking, {
      fields: { paymentStatus: 'Not Paid', paymentMethod }
    })
    if (created.slotConflict) {
      // The doctor document and the appointments disagreed. The unique index caught it, and the slot belongs to the other booking.
      lockedSlot = null
      return res.json({ success: false, message: 'Slot not available' })
    }
    lockedSlot = null

    const newAppointment = created.appointment
    await consumeHold(acquired.hold)
    await closeWaitlistAfterBooking({ userId, docId, slotDate })

    await logAudit({
      action: 'appointment_create',
      status: 'success',
      targetUserId: userId,
      entityType: 'appointment',
      entityId: newAppointment._id,
      metadata: {
        bookedBy: 'patient',
        patientId: userId,
        patientName: user.name,
        patientLoginId: user.patientId,
        doctorId: docId,
        doctorName: doctor.name,
        slotDate,
        slotTime,
        appointmentType
      },
      req
    })

    notifyAppointmentBooked({ appointment: newAppointment, bookedBy: 'Patient' })

    res.json({
      success: true,
      message: 'Appointment Booked',
      appointmentId: newAppointment._id,
      appointment: toPatientAppointment(newAppointment)
    })
  } catch (error) {
    console.log(error)
    if (lockedSlot) {
      if (lockedSlot.hold) await releaseHold(lockedSlot.hold).catch(() => {})
      else await unlockSlot(lockedSlot).catch(() => {})
    }
    res.json({success: false, message: error.message})
  }

}





// API to get user appointments for forntend my-appointments page
const listAppointment = async (req,res) => {
  try {

   const userId = req.user.userId;
   // A paid checkout whose confirm call was lost, or a refund that has settled, shows up here.
   await reconcileUserHolds(userId).catch((error) => console.error('reconcile', error.message))
   await refreshRefundsForUser(userId).catch((error) => console.error('refunds', error.message))

   const appointments = await appointmentModel.find({userId}).lean()
   const ratings = await ratingModel.find({
     userId,
     appointmentId: { $in: appointments.map((item) => item._id.toString()) }
   }).lean()
   const ratingsByAppointment = ratings.reduce((acc, rating) => {
     acc[rating.appointmentId] = rating
     return acc
   }, {})
   const now = Date.now()
   const appointmentsWithRatings = appointments.map((appointment) =>
     toPatientAppointment(appointment, { now, rating: ratingsByAppointment[appointment._id.toString()] || null })
   )

   res.json({ success: true, appointments: appointmentsWithRatings })

  } catch (error) {
    console.log(error)
    res.json({success: false, message: error.message})
  }
}





//API to cancel appointment
const cancelAppointment = async (req,res) => {
  try {

   const userId = req.user.userId;
   const { appointmentId } = req.body;

   if (!isValidId(appointmentId)) {
     return res.json({ success: false, message: 'Appointment not found' })
   }

   const appointmentData = await appointmentModel.findById(appointmentId)

   if (!appointmentData) {
     return res.json({ success: false, message: 'Appointment not found' })
   }

   // verify appointment user
   if(appointmentData.userId !== userId){
     await logAudit({
      action: 'cancel_appointment',
      status: 'failed',
      reason: 'Patient attempted to cancel another patient appointment',
      targetUserId: appointmentData.userId,
      entityType: 'appointment',
      entityId: appointmentId,
      metadata: { appointmentOwnerId: appointmentData.userId },
      req
     })
     return res.json({success: false, message: 'Unauthorized action'})
   }

   if (appointmentData.cancelled) {
     // Cancelling again must not release the slot a second time: someone else may have booked it since.
     return res.json({ success: true, alreadyCancelled: true, message: 'Appointment Cancelled' })
   }

   if (!toPatientAppointment(appointmentData).canCancel) {
     return res.json({ success: false, message: 'This appointment can no longer be cancelled' })
   }

   // Status first, money second: if the refund fails the visit is still cancelled and the refund retries.
   const claimed = await appointmentModel.findOneAndUpdate(
     { _id: appointmentId, userId, cancelled: false, isCompleted: false, appointmentStatus: 'Booked' },
     { cancelled: true, appointmentStatus: 'Cancelled', statusUpdatedAt: Date.now() },
     { new: true }
   )
   if (!claimed) {
     const latest = await appointmentModel.findById(appointmentId).select('cancelled').lean()
     if (latest?.cancelled) return res.json({ success: true, alreadyCancelled: true, message: 'Appointment Cancelled' })
     return res.json({ success: false, message: 'This appointment can no longer be cancelled' })
   }

   // releasing doctor slot
   const { docId, slotDate, slotTime, appointmentType } = claimed
   await unlockSlot({ docId, slotDate, slotTime, appointmentType })

   let refundMessage = ''
   if (claimed.paymentStatus === 'Paid' && claimed.paymentMethod === 'Visa') {
     try {
       const refundResult = await refundAppointmentPayment({ appointment: claimed, appointmentId, requestedBy: 'patient', req })
       refundMessage = refundResult.refunded ? ' Refund requested.' : ''
     } catch (error) {
       console.error('Refund failed after cancel', appointmentId, error.message)
       refundMessage = ' Your refund could not be completed yet. We will retry it.'
     }
   }

   await logAudit({
     action: 'appointment_cancel',
     status: 'success',
     targetUserId: userId,
     entityType: 'appointment',
     entityId: appointmentId,
     metadata: {
       cancelledBy: 'patient',
       patientId: userId,
       doctorId: docId,
       slotDate,
       slotTime
     },
     req
   })

   notifyAppointmentCancelled({ appointment: claimed, cancelledBy: 'patient' })

   await processWaitlistForDoctor(docId).catch((error) => console.error('waitlist', error.message))

   res.json({success: true, message:`Appointment Cancelled${refundMessage}`})


  } catch (error) {
    console.log(error)
    res.json({success: false, message: error.message})
  }
}




// API to get user's prescription/completed appointment details
const getUserPrescription = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const userId = req.user.userId; 

    if (!isValidId(appointmentId)) {
      return res.json({ success: false, message: 'Appointment ID required' });
    }

    // Find prescription by appointmentId field (not _id)
    const prescription = await prescriptionModel.findOne({ 
      appointmentId: appointmentId,  
      userId: userId 
    })

    if (!prescription) {
      return res.json({ success: false, message: 'Prescription not found' });
    }

    res.json({ success: true, prescription });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};




export { registerUser, loginUser, verifyPatientMfaLogin, completePatientMfaLoginSetup, getProfile, updateProfile, updateInsurance, getPatientMfaStatus, startPatientMfaSetup, enablePatientMfa, disablePatientMfa, getMedicalHistory, createMedicalHistory, updateMedicalHistory, getVisitFeeEligibility, bookAppointment, listAppointment, cancelAppointment, getUserPrescription, buildInsuranceData, getNextPatientId, isPastDate }
