import validator from 'validator'
import bcrypt from 'bcrypt'
import userModel from '../models/userModel.js'
import jwt from 'jsonwebtoken'
import { v2 as cloudinary } from 'cloudinary'
import doctorModel from '../models/doctorModel.js'
import appointmentModel from '../models/appointmentModel.js'
import prescriptionModel from '../models/prescriptionModel.js'
import counterModel from '../models/counterModel.js'
import { PASSWORD_RESET_TEMPLATE } from "../config/EmailTemplates.js";
import transporter from "../config/nodemailer.js";
import { createJwtPayload } from '../middlewares/rbac.js'
import { logAudit } from '../services/auditService.js'
import { isSlotAllowedBySchedule } from '../services/scheduleService.js'



// Function to get next ID
const getNextPatientId = async () => {
    const counter = await counterModel.findByIdAndUpdate('patientId',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    
    return `PAT${counter.seq.toString().padStart(2, '0')}`;
};

const parseBoolean = (value) => value === true || value === 'true' || value === 'on' || value === '1'

const normalizePhone = (phone = '') => String(phone).trim()

const buildInsuranceData = async (body = {}, file, existingInsurance = {}, updatedBy = 'patient') => {
  const enabled = parseBoolean(body.insuranceEnabled)

  if (!enabled) {
    return {
      enabled: false,
      fullName: '',
      birthDate: '',
      idNumber: '',
      expiryDate: '',
      medicalCardPhoto: existingInsurance.medicalCardPhoto || '',
      updatedAt: Date.now(),
      updatedBy
    }
  }

  const insurance = {
    enabled: true,
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

  if (!file && !insurance.medicalCardPhoto) {
    throw new Error('Please attach a photo of the medical card')
  }

  if (file) {
    const upload = await cloudinary.uploader.upload(file.path, { resource_type: 'auto' })
    insurance.medicalCardPhoto = upload.secure_url
  }

  return insurance
}



// API to register user
const registerUser = async (req, res) => {
    try {
        const body = req.body || {}
        const { name, email, password, dob } = body;
        const phone = normalizePhone(body.phone)

        if (!name || !password || !email || !phone || !dob) {
            return res.json({success: false, message: 'Missing Details'});
        }

        if (!validator.isEmail(email)) {
            return res.json({success: false, message: 'Enter a valid email'});
        }

        if (password.length < 8) {
            return res.json({success: false, message: 'Enter a strong password'});
        }

        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.json({success: false, message: 'Email already registered'});
        }

        const existingPhone = await userModel.findOne({ phone });
        if (existingPhone) {
            return res.json({success: false, message: 'Phone number already registered'});
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
            insurance: await buildInsuranceData(body, req.file, {}, 'patient')
        };

        const newUser = new userModel(userData);
        const user = await newUser.save();

        const token = jwt.sign(createJwtPayload({ id: user._id, role: 'patient', email: user.email }), process.env.JWT_SECRET);

        res.json({success: true, token});

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

      const user = await userModel.findOne({ $or: [{ email: loginId }, { phone: loginId }] })

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
        const token = jwt.sign(createJwtPayload({ id: user._id, role: 'patient', email: user.email }), process.env.JWT_SECRET)
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




// Send OTP to email for password reset
export const sendPasswordResetOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.json({ success: false, message: 'Email is required' });
  }

  try {
    // Check if user exists
    const user = await userModel.findOne({ email });
    
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
      html: PASSWORD_RESET_TEMPLATE.replace('{{otp}}', otp).replace('{{email}}', user.email)
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
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.json({ success: false, message: 'Email and OTP are required' });
  }

  try {
    const user = await userModel.findOne({ email });

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
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.json({ 
      success: false, 
      message: 'Email, OTP, and new password are required' 
    });
  }

  try {
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    // Verify OTP again before resetting password
    if (user.resetOtp === '' || user.resetOtp !== otp) {
      return res.json({ success: false, message: 'Invalid OTP' });
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

    if( !name || !phone || !dob || !gender ){
      return res.json({success: false, message:"Data Missing"})
    }

    const existingPhone = await userModel.findOne({ phone: normalizePhone(phone), _id: { $ne: userId } })
    if (existingPhone) {
      return res.json({ success: false, message: 'Phone number already registered' })
    }

    await userModel.findByIdAndUpdate(userId,{name, phone: normalizePhone(phone), address: JSON.parse(address),dob, gender})

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




//  API to book appointment
const bookAppointment = async (req,res) => {

  try {
    
    const userId = req.user.userId; 
    const { docId, slotDate, slotTime } = req.body;
    const docData = await doctorModel.findById(docId).select('-password')

    const scheduleCheck = isSlotAllowedBySchedule(docData, slotDate, slotTime)
    if(!scheduleCheck.allowed){
      return res.json({success: false, message: scheduleCheck.reason})
    }


    const userData = await userModel.findById(userId).select('-password')

    if (!userData || userData.isActive === false) {
      return res.json({ success: false, message: 'Patient account is deactivated' })
    }
 
    const slotUpdate = await doctorModel.updateOne(
      { _id: docId, [`slots_booked.${slotDate}`]: { $ne: slotTime } },
      { $addToSet: { [`slots_booked.${slotDate}`]: slotTime } }
    )

    if (slotUpdate.modifiedCount === 0) {
      return res.json({success: false, message: 'Slot not available'})
    }

    const appointmentDocData = docData.toObject()
    delete appointmentDocData.slots_booked
    
    const appointmentData = {
      userId,
      docId,
      userData,
      docData: appointmentDocData,
      amount: Number(docData.fees),
      originalAmount: Number(docData.fees),
      slotTime, 
      slotDate,
      date: Date.now(),
      appointmentStatus: 'Booked',
      paymentStatus: 'Not Paid',
      bookedBy: 'Patient'
    }

    const newAppointment = new appointmentModel(appointmentData)

    await newAppointment.save()

    await logAudit({
      action: 'appointment_create',
      status: 'success',
      targetUserId: userId,
      entityType: 'appointment',
      entityId: newAppointment._id,
      metadata: {
        bookedBy: 'patient',
        patientId: userId,
        patientName: userData.name,
        patientLoginId: userData.patientId,
        doctorId: docId,
        doctorName: docData.name,
        slotDate,
        slotTime
      },
      req
    })

    res.json({success: true, message: 'Appointment Booked'})
  } catch (error) {
    console.log(error)
    res.json({success: false, message: error.message})
  }

}





// API to get user appointments for forntend my-appointments page
const listAppointment = async (req,res) => {
  try {
    
   const userId = req.user.userId;  
   const appointments = await appointmentModel.find({userId})
   
   res.json({ success: true, appointments })

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

   const appointmentData = await appointmentModel.findById(appointmentId)

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

   await appointmentModel.findByIdAndUpdate(appointmentId, {cancelled: true, appointmentStatus: 'Cancelled', statusUpdatedAt: Date.now()})

   // releasing doctor slot
   const { docId, slotDate, slotTime } = appointmentData
   const doctorData = await doctorModel.findById(docId)

   let slots_booked = doctorData.slots_booked

   slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)

   await doctorModel.findByIdAndUpdate(docId, {slots_booked})

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

   res.json({success: true, message:'Appointment Cancelled'})


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

    console.log('Searching for prescription with:', { appointmentId, userId })

    if (!appointmentId) {
      return res.json({ success: false, message: 'Appointment ID required' });
    }

    // Find prescription by appointmentId field (not _id)
    const prescription = await prescriptionModel.findOne({ 
      appointmentId: appointmentId,  
      userId: userId 
    })
    console.log('Found prescription:', prescription) 

    if (!prescription) {
      return res.json({ success: false, message: 'Prescription not found' });
    }

    res.json({ success: true, prescription });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};




export { registerUser, loginUser, getProfile, updateProfile, updateInsurance, getMedicalHistory, createMedicalHistory, updateMedicalHistory, bookAppointment, listAppointment, cancelAppointment, getUserPrescription, buildInsuranceData, getNextPatientId }
