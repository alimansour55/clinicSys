import validator from 'validator'
import bcrypt from 'bcrypt'
import { v2 as cloudinary } from 'cloudinary'
import doctorModel from '../models/doctorModel.js'
import jwt from 'jsonwebtoken'
import appointmentModel from '../models/appointmentModel.js'
import userModel from '../models/userModel.js'
import prescriptionModel from '../models/prescriptionModel.js'
import receptionistModel from '../models/receptionistModel.js'
import clinicModel from '../models/clinicModel.js'
import { addReceptionist, allReceptionists, changeReceptionistStatus } from './receptionistController.js'
import { createJwtPayload } from '../middlewares/rbac.js'
import { logAudit } from '../services/auditService.js'
import { refundAppointmentPayment } from './paymentController.js'
import { attachRatingSummariesToDoctors } from './ratingController.js'

const normalizeClinicIds = (clinicIds) => {
  if (!clinicIds) return []
  if (Array.isArray(clinicIds)) return clinicIds.filter(Boolean)

  try {
    const parsed = JSON.parse(clinicIds)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

const normalizeDoctorLocations = (locations) => {
  if (!locations) return []
  const list = Array.isArray(locations) ? locations : (() => {
    try {
      const parsed = JSON.parse(locations)
      return Array.isArray(parsed) ? parsed : String(locations).split(',')
    } catch {
      return String(locations).split(',')
    }
  })()

  return [...new Set(list.map((location) => String(location || '').trim()).filter(Boolean))]
}

const parseSlotDate = (slotDate) => {
  if (!slotDate || typeof slotDate !== 'string') return null
  const [day, month, year] = slotDate.split('_').map(Number)
  if (!day || !month || !year) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatMonthKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const getWeekStartKey = (date) => {
  const weekStart = new Date(date)
  const day = weekStart.getDay()
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
  weekStart.setDate(diff)
  return formatDateKey(weekStart)
}

const incrementTrend = (map, key) => {
  if (!key) return
  map.set(key, (map.get(key) || 0) + 1)
}

const mapToSeries = (map, limit = 12) => Array.from(map.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .slice(-limit)
  .map(([label, count]) => ({ label, count }))


// API for adding doctor
const addDoctor = async (req,res) => {
   try {
    
    const { name, email, password, phone, speciality, degree, experience, about, fees, address } = req.body
    const clinicIds = normalizeClinicIds(req.body.clinicIds)
    const locations = normalizeDoctorLocations(req.body.locations)
    const imageFile = req.file

    // checking for all data to add doctor
    if( !name || !email || !password || !phone || !speciality || !degree || !experience || !about || !fees || !address ){
        return res.json({success: false, message: "Missing Details"})
    }

    // validating email format
    if(!validator.isEmail(email)) {
      return res.json({success: false, message:'please enter a valid email'})
    }

    // validating strong password
    if(password.length < 8){
       return res.json({success:false, message:'Please enter a strong password'})
    }

    // Check if email already exists
    const existingDoctor = await doctorModel.findOne({ email })
    if(existingDoctor) {
    return res.json({success: false, message: 'Doctor with this email already exists'}) 
    }

    // hashing doctor password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // upload image to cloudinary
    const imageUpload = await cloudinary.uploader.upload(imageFile.path, {resource_type: 'image'})
    const imageUrl = imageUpload.secure_url

    const doctorData = {
        name,
        email,
        image:imageUrl,
        password: hashedPassword,
        phone,
        speciality,
        degree,
        experience,
        about,
        fees,
        address:JSON.parse(address),
        locations,
        clinics: clinicIds,
        date:Date.now()
    }

    const newDoctor = new doctorModel(doctorData)
    await newDoctor.save()

    await logAudit({
      action: 'doctor_create',
      status: 'success',
      targetUserId: newDoctor._id,
      entityType: 'doctor',
      entityId: newDoctor._id,
      metadata: {
        doctorName: name,
        doctorEmail: email,
        speciality,
        clinicIds,
        createdByRole: req.user?.role || 'admin'
      },
      req
    })

    res.json({success:true, message: "Doctor Added"})


   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}



// API for admin to update doctor profile
const updateDoctorByAdmin = async (req, res) => {
  try {
    const { docId } = req.body
    const {
      name,
      email,
      phone,
      password, // Password optional hai
      speciality,
      degree,
      experience,
      about,
      fees,
      address,
      locations,
    } = req.body

    const imageFile = req.file

    if (!docId) {
      return res.json({ success: false, message: 'Doctor ID is required' })
    }

    // Check doctor exists
    const doctor = await doctorModel.findById(docId)
    if (!doctor) {
      return res.json({ success: false, message: 'Doctor not found' })
    }

    // Validate email if provided
    if (email && !validator.isEmail(email)) {
      return res.json({ success: false, message: 'Invalid email format' })
    }

    // Password validation ONLY if password is provided and not empty
    if (password && password.trim().length > 0 && password.length < 8) {
      return res.json({ success: false, message: 'Password must be at least 8 characters' })
    }

    let imageUrl = doctor.image

    // Upload new image if provided
    if (imageFile) {
      const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
        resource_type: 'image'
      })
      imageUrl = imageUpload.secure_url
    }

    //  Hash new password ONLY if provided
    let hashedPassword = doctor.password // Keep old password by default
    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10)
      hashedPassword = await bcrypt.hash(password, salt)
    }

    //  Parse address if it's a string
    let addressObj = doctor.address
    if (address) {
      addressObj = typeof address === 'string' ? JSON.parse(address) : address
    }
    const nextLocations = locations ? normalizeDoctorLocations(locations) : doctor.locations

    // Update data
    const updatedData = {
      name: name || doctor.name,
      email: email || doctor.email,
      password: hashedPassword,
      phone: phone || doctor.phone,
      speciality: speciality || doctor.speciality,
      degree: degree || doctor.degree,
      experience: experience || doctor.experience,
      about: about || doctor.about,
      fees: fees || doctor.fees,
      address: addressObj,  // Object me save hoga
      locations: nextLocations,
      image: imageUrl
    }

    await doctorModel.findByIdAndUpdate(docId, updatedData)

    await logAudit({
      action: 'doctor_update',
      status: 'success',
      targetUserId: docId,
      entityType: 'doctor',
      entityId: docId,
      metadata: {
        doctorName: updatedData.name,
        changedFields: Object.keys(updatedData).filter(field => field !== 'password')
      },
      req
    })

    res.json({ success: true, message: 'Doctor profile updated successfully' })

  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}




// API For admin login
const loginAdmin = async (req, res) => {
   try {
    
    const { email, password } = req.body

    if(email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD){
      
    const token = jwt.sign(createJwtPayload({ id: email, role: 'admin', email }), process.env.JWT_SECRET)
    await logAudit({
      action: 'login_success',
      actorUserId: email,
      actorRole: 'admin',
      status: 'success',
      entityType: 'admin',
      entityId: email,
      metadata: {
        username: 'Admin',
        loginId: email,
        email
      },
      req
    })
    res.json({success: true, token})  

    } else {
        await logAudit({
          action: 'login_failed',
          actorRole: 'admin',
          status: 'failed',
          reason: 'Invalid admin credentials',
          entityType: 'admin',
          metadata: { email },
          req
        })
        res.json({success:false, message: 'Invalid credentials'})
    }

   } catch (error) {
    console.log(error)
    res.json({success: false, message:error.message})
   }
}



// API to get all doctor list for admin panel
const allDoctors = async (req,res) => {
   try {
    const doctors = await doctorModel.find({}).select('-password').populate('clinics')
    const doctorsWithRatings = await attachRatingSummariesToDoctors(doctors)
    res.json({success: true, doctors: doctorsWithRatings})

   } catch (error) {
      console.log(error)
      res.json({success:false, message:error.message})
   }
}

// API to get all patients for admin panel
const allPatients = async (req, res) => {
  try {
    const patients = await userModel.find({}).select('-password -resetOtp -resetOtpExpireAt').sort({ createdAt: -1 }).lean()
    const patientIds = patients.map((patient) => patient._id.toString())

    const appointmentCounts = await appointmentModel.aggregate([
      { $match: { userId: { $in: patientIds } } },
      {
        $group: {
          _id: '$userId',
          appointments: { $sum: 1 },
          paidAppointments: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, 1, 0] }
          },
          revenue: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$amount', 0] }
          },
          lastAppointmentDate: { $max: '$date' }
        }
      }
    ])

    const statsByPatient = appointmentCounts.reduce((acc, item) => {
      acc[item._id] = item
      return acc
    }, {})

    const patientsWithStats = patients.map((patient) => ({
      ...patient,
      isActive: patient.isActive !== false,
      appointmentStats: {
        appointments: statsByPatient[patient._id.toString()]?.appointments || 0,
        paidAppointments: statsByPatient[patient._id.toString()]?.paidAppointments || 0,
        revenue: statsByPatient[patient._id.toString()]?.revenue || 0,
        lastAppointmentDate: statsByPatient[patient._id.toString()]?.lastAppointmentDate || 0
      }
    }))

    res.json({ success: true, patients: patientsWithStats })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// API to get one patient with appointments and medical history
const patientDetails = async (req, res) => {
  try {
    const { patientId } = req.params

    if (!patientId) {
      return res.json({ success: false, message: 'Patient ID is required' })
    }

    const patient = await userModel.findById(patientId).select('-password -resetOtp -resetOtpExpireAt').lean()
    if (!patient) {
      return res.json({ success: false, message: 'Patient not found' })
    }

    const appointments = await appointmentModel.find({ userId: patientId }).sort({ date: -1 }).lean()
    const prescriptions = await prescriptionModel.find({ userId: patientId }).sort({ createdAt: -1 }).lean()

    const totals = appointments.reduce((acc, appointment) => {
      acc.appointments += 1
      if (appointment.paymentStatus === 'Paid') {
        acc.paidAppointments += 1
        acc.revenue += Number(appointment.amount || 0)
      } else {
        acc.unpaidAppointments += 1
      }
      if (appointment.cancelled || appointment.appointmentStatus === 'Cancelled') acc.cancelledAppointments += 1
      if (appointment.isCompleted || appointment.appointmentStatus === 'Finished') acc.completedAppointments += 1
      return acc
    }, {
      appointments: 0,
      paidAppointments: 0,
      unpaidAppointments: 0,
      cancelledAppointments: 0,
      completedAppointments: 0,
      revenue: 0
    })

    res.json({
      success: true,
      patient: { ...patient, isActive: patient.isActive !== false },
      appointments,
      prescriptions,
      totals
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// API to activate/deactivate patient profile
const changePatientStatus = async (req, res) => {
  try {
    const { patientId } = req.body
    if (!patientId) {
      return res.json({ success: false, message: 'Patient ID is required' })
    }

    const patient = await userModel.findById(patientId)
    if (!patient) {
      return res.json({ success: false, message: 'Patient not found' })
    }

    const nextStatus = patient.isActive === false
    await userModel.findByIdAndUpdate(patientId, {
      isActive: nextStatus,
      deactivatedAt: nextStatus ? 0 : Date.now()
    })

    await logAudit({
      action: 'patient_status_update',
      status: 'success',
      targetUserId: patientId,
      entityType: 'patient',
      entityId: patientId,
      metadata: {
        patientName: patient.name,
        oldValue: { isActive: patient.isActive !== false },
        newValue: { isActive: nextStatus }
      },
      req
    })

    res.json({ success: true, message: `Patient ${nextStatus ? 'activated' : 'deactivated'} successfully` })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// API to permanently delete patient profile
const deletePatientProfile = async (req, res) => {
  try {
    const { patientId } = req.body
    if (!patientId) {
      return res.json({ success: false, message: 'Patient ID is required' })
    }

    const deletedPatient = await userModel.findByIdAndDelete(patientId)
    if (!deletedPatient) {
      return res.json({ success: false, message: 'Patient not found' })
    }

    await logAudit({
      action: 'patient_delete',
      status: 'success',
      targetUserId: deletedPatient._id,
      entityType: 'patient',
      entityId: deletedPatient._id,
      metadata: {
        patientName: deletedPatient.name,
        patientLoginId: deletedPatient.patientId
      },
      req
    })

    res.json({ success: true, message: 'Patient profile deleted successfully' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}


// API to get all appointments list
const appointmentsAdmin = async (req,res) => {
   try {
     const appointments = await appointmentModel.find({})
     res.json({success: true, appointments})

   } catch (error) {
      console.log(error)
      res.json({success: false, message:error.message})
   }
}


// API for appointment cancellation
const appointmentCancel = async (req,res) => {
  try {

   const { appointmentId } = req.body; // ✔ Only appointmentId comes from body

   const appointmentData = await appointmentModel.findById(appointmentId)

   let refundMessage = ''
   if (appointmentData.paymentStatus === 'Paid' && appointmentData.paymentMethod === 'Visa') {
    const refundResult = await refundAppointmentPayment({ appointment: appointmentData, appointmentId, requestedBy: 'admin', req })
    refundMessage = refundResult.refunded ? ' Refund requested.' : ''
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
    targetUserId: appointmentData.userId,
    entityType: 'appointment',
    entityId: appointmentId,
    metadata: {
      cancelledBy: 'admin',
      patientId: appointmentData.userId,
      doctorId: docId,
      slotDate,
      slotTime
    },
    req
   })

   res.json({success: true, message:`Appointment Cancelled${refundMessage}`})


  } catch (error) {
    console.log(error)
    res.json({success: false, message: error.message})
  }
}


// API to get all appointment history
const allAppointmentHistory = async (req, res) => {
  try {
    const appointments = await prescriptionModel.find({ });
    res.json({ success: true, appointments });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


// Delete appointment history record
const deleteAppointmentHistory = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    // Check if appointmentId is provided
    if (!appointmentId) {
      return res.json({ success: false, message: 'Appointment ID is required' });
    }

    // Find and delete the prescription/appointment record
    const deletedRecord = await prescriptionModel.findByIdAndDelete(appointmentId);

    if (!deletedRecord) {
      await logAudit({
        action: 'medical_history_delete',
        status: 'failed',
        reason: 'Record not found',
        entityType: 'prescription',
        entityId: appointmentId,
        req
      })
      return res.json({ success: false, message: 'Record not found' });
    }
    await logAudit({
      action: 'medical_history_delete',
      status: 'success',
      targetUserId: deletedRecord.userId,
      entityType: 'prescription',
      entityId: deletedRecord._id,
      metadata: {
        appointmentId: deletedRecord.appointmentId,
        patientId: deletedRecord.userId,
        doctorId: deletedRecord.docId
      },
      req
    })
    res.json({ success: true, message: 'Appointment record deleted successfully' });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const deleteProfile = async (req, res) => {
  try {
    const { profileType, profileId } = req.body

    if (!profileType || !profileId) {
      await logAudit({
        action: 'profile_delete',
        status: 'failed',
        reason: 'Missing profile type or profile ID',
        entityType: profileType || 'profile',
        entityId: profileId || '',
        req
      })
      return res.json({ success: false, message: 'Profile type and profile ID are required' })
    }

    const modelsByProfileType = {
      patient: userModel,
      doctor: doctorModel,
      receptionist: receptionistModel
    }

    const selectedModel = modelsByProfileType[profileType]
    if (!selectedModel) {
      await logAudit({
        action: 'profile_delete',
        status: 'failed',
        reason: 'Invalid profile type',
        entityType: profileType,
        entityId: profileId,
        req
      })
      return res.json({ success: false, message: 'Invalid profile type' })
    }

    const deletedProfile = await selectedModel.findByIdAndDelete(profileId)

    if (!deletedProfile) {
      await logAudit({
        action: 'profile_delete',
        status: 'failed',
        reason: 'Profile not found',
        entityType: profileType,
        entityId: profileId,
        req
      })
      return res.json({ success: false, message: 'Profile not found' })
    }

    await logAudit({
      action: 'profile_delete',
      status: 'success',
      targetUserId: deletedProfile._id,
      entityType: profileType,
      entityId: deletedProfile._id,
      metadata: { profileType },
      req
    })

    res.json({ success: true, message: 'Profile deleted successfully' })
  } catch (error) {
    console.log(error)
    await logAudit({
      action: 'profile_delete',
      status: 'failed',
      reason: error.message,
      entityType: req.body?.profileType || 'profile',
      entityId: req.body?.profileId || '',
      req
    })
    res.json({ success: false, message: error.message })
  }
}




// API to get dashboard data for admin panel
const adminDashboard = async (req,res) => {
   try {
     const doctors = await doctorModel.find({}).populate('clinics').lean()
     const users = await userModel.find({}).select('_id isActive').lean()
     const appointments = await appointmentModel.find({}).sort({ date: -1 }).lean()
     const clinics = await clinicModel.find({}).sort({ name: 1 }).lean()

     const doctorById = doctors.reduce((acc, doctor) => {
      acc[doctor._id.toString()] = doctor
      return acc
     }, {})

     const dailyTrend = new Map()
     const weeklyTrend = new Map()
     const monthlyTrend = new Map()
     const clinicStatsByName = new Map()

     clinics.forEach((clinic) => {
      clinicStatsByName.set(clinic.name, {
        clinicId: clinic._id,
        name: clinic.name,
        doctors: doctors.filter((doctor) =>
          (doctor.clinics || []).some((assignedClinic) => assignedClinic?._id?.toString() === clinic._id.toString())
        ).length,
        appointments: 0,
        revenue: 0,
        paidAppointments: 0,
        unpaidAppointments: 0,
        patients: new Set()
      })
     })

     let revenue = 0
     let paidAppointments = 0
     let unpaidAppointments = 0
     let cancelledAppointments = 0
     let completedAppointments = 0

     appointments.forEach((appointment) => {
      const amount = Number(appointment.amount || 0)
      const isPaid = appointment.paymentStatus === 'Paid'
      const isCancelled = appointment.cancelled || appointment.appointmentStatus === 'Cancelled'

      if (isPaid) {
        revenue += amount
        paidAppointments += 1
      } else if (!isCancelled) {
        unpaidAppointments += 1
      }

      if (isCancelled) cancelledAppointments += 1
      if (appointment.isCompleted || appointment.appointmentStatus === 'Finished') completedAppointments += 1

      const slotDate = parseSlotDate(appointment.slotDate)
      if (slotDate) {
        incrementTrend(dailyTrend, formatDateKey(slotDate))
        incrementTrend(weeklyTrend, getWeekStartKey(slotDate))
        incrementTrend(monthlyTrend, formatMonthKey(slotDate))
      }

      const doctor = doctorById[appointment.docId]
      const assignedClinics = doctor?.clinics?.length ? doctor.clinics : []
      const clinicNames = assignedClinics.length > 0
        ? assignedClinics.map((clinic) => clinic.name).filter(Boolean)
        : [appointment.docData?.speciality || 'Unassigned']

      clinicNames.forEach((clinicName) => {
        if (!clinicStatsByName.has(clinicName)) {
          clinicStatsByName.set(clinicName, {
            clinicId: '',
            name: clinicName,
            doctors: clinicName === 'Unassigned' ? 0 : doctors.filter((item) => item.speciality === clinicName).length,
            appointments: 0,
            revenue: 0,
            paidAppointments: 0,
            unpaidAppointments: 0,
            patients: new Set()
          })
        }

        const clinicStats = clinicStatsByName.get(clinicName)
        clinicStats.appointments += 1
        clinicStats.patients.add(appointment.userId)

        if (isPaid) {
          clinicStats.paidAppointments += 1
          clinicStats.revenue += amount
        } else if (!isCancelled) {
          clinicStats.unpaidAppointments += 1
        }
      })
     })

     const clinicStats = Array.from(clinicStatsByName.values())
      .map((clinic) => ({ ...clinic, patients: clinic.patients.size }))
      .filter((clinic) => clinic.doctors > 0 || clinic.appointments > 0)
      .sort((a, b) => b.appointments - a.appointments)

     const dashData = {
      doctors: doctors.length,
      appointments: appointments.length,
      patients: users.length,
      activePatients: users.filter((user) => user.isActive !== false).length,
      inactivePatients: users.filter((user) => user.isActive === false).length,
      revenue,
      paidAppointments,
      unpaidAppointments,
      cancelledAppointments,
      completedAppointments,
      appointmentTrends: {
        day: mapToSeries(dailyTrend, 14),
        week: mapToSeries(weeklyTrend, 12),
        month: mapToSeries(monthlyTrend, 12)
      },
      clinicStats,
      latestAppointments: appointments.slice(0,5)
     }

     res.json({success: true, dashData})
   } catch (error) {
     console.log(error)
     res.json({success: false, message: error.message}) 
   }

}


export { addDoctor, updateDoctorByAdmin, loginAdmin, allDoctors, allPatients, patientDetails, changePatientStatus, deletePatientProfile, appointmentsAdmin, appointmentCancel, adminDashboard, allAppointmentHistory, deleteAppointmentHistory, deleteProfile, addReceptionist, allReceptionists, changeReceptionistStatus }
