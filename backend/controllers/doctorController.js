import doctorModel from "../models/doctorModel.js"
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import appointmentModel from "../models/appointmentModel.js"
import prescriptionModel from "../models/prescriptionModel.js"
import userModel from "../models/userModel.js"
import { createJwtPayload } from "../middlewares/rbac.js"
import { logAudit } from "../services/auditService.js"
import { sanitizeSchedule } from "../services/scheduleService.js"
import { normalizeHomeVisitAddress, validateHomeVisitAddress } from "../services/homeVisitService.js"
import { attachRatingSummariesToDoctors } from "./ratingController.js"

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

const changeAvailability = async (req,res) => {
    try {
      const { docId } = req.body
       const docData = await doctorModel.findById(docId)
       await doctorModel.findByIdAndUpdate(docId,{available: !docData.available })
       res.json({success:true, message: 'Availability Changed'})

      } catch (error) {
       console.log(error)
       res.json({success:false, message:error.message}) 
      }
}


const doctorList = async (req,res) => {
   try {      
     const doctors = await doctorModel.find({}).select(['-password', '-email']).populate('clinics')
     const doctorsWithRatings = await attachRatingSummariesToDoctors(doctors)
     res.json({success:true, doctors: doctorsWithRatings})
   } catch (error) {
      console.log(error)
      res.json({success:false, message:error.message})
   }
}


// API for doctor login
const loginDoctor = async (req,res) => {
   try {
     const { email, password } = req.body
     const doctor = await doctorModel.findOne({email})

     if(!doctor){
        await logAudit({
         action: 'login_failed',
         status: 'failed',
         reason: 'Invalid doctor credentials',
         entityType: 'doctor',
         metadata: { email },
         req
        })
        return res.json({success: false, message: 'Invalid credentails'})
      }
   
      const isMatch = await bcrypt.compare(password, doctor.password)
      
      if(isMatch){
         const token = jwt.sign(createJwtPayload({ id: doctor._id, role: 'doctor', email: doctor.email }), process.env.JWT_SECRET)
         await logAudit({
            action: 'login_success',
            actorUserId: doctor._id,
            actorRole: 'doctor',
            status: 'success',
            entityType: 'doctor',
            entityId: doctor._id,
            metadata: {
               username: doctor.name,
               loginId: doctor.email,
               email: doctor.email
            },
            req
         })
         res.json({success: true, token})
      } else {
         await logAudit({
            action: 'login_failed',
            actorUserId: doctor._id,
            actorRole: 'doctor',
            status: 'failed',
            reason: 'Invalid doctor credentials',
            entityType: 'doctor',
            entityId: doctor._id,
            metadata: { email },
            req
         })
         res.json({success: false, message: 'Invalid credentials'})
      }
   } catch (error) {   
   }
} 



// APi to get doctor appointments for doctor panel
const appointmentsDoctor = async (req,res) => {
   try {
      const docId = req.doctor.docId;
      const appointments = await appointmentModel.find({ docId })

      res.json({success: true, appointments})

   } catch (error) {
      console.log(error)
      res.json({success:false, message:error.message})
   }
}



// API to mark appointment completed and save prescription for doctor panel
const appointmentComplete = async (req,res) => {
   try {
      
      const { appointmentId, diagnosis, symptoms, medicines, medicationItems, instructions, nextVisit, labTests, documentation } = req.body
      const docId = req.doctor.docId
      const normalizedMedicationItems = Array.isArray(medicationItems)
         ? medicationItems
            .map((item) => ({
               name: String(item?.name || '').trim(),
               dosage: String(item?.dosage || '').trim(),
               frequency: String(item?.frequency || '').trim(),
               duration: String(item?.duration || '').trim(),
               instructions: String(item?.instructions || '').trim()
            }))
            .filter((item) => item.name || item.dosage || item.frequency || item.duration || item.instructions)
         : []
      const medicinesText = medicines || normalizedMedicationItems
         .map((item) => `${item.name} - ${item.dosage} - ${item.frequency} - ${item.duration}${item.instructions ? ` - ${item.instructions}` : ''}`)
         .join('\n')
      
      // Validation - Required fields check (labTests aur notes optional hain)
      if (!appointmentId || !diagnosis || !symptoms || normalizedMedicationItems.length === 0 || !instructions || !nextVisit || !documentation) {
         await logAudit({
            action: 'prescription_create',
            status: 'failed',
            reason: 'Missing required prescription fields',
            entityType: 'appointment',
            entityId: appointmentId || '',
            metadata: { changedFields: ['diagnosis', 'symptoms', 'medicines', 'instructions', 'nextVisit', 'labTests', 'documentation'] },
            req
         })
         return res.json({
            success: false, 
            message: 'Please fill all required fields'
         })
      }

      const incompleteMedication = normalizedMedicationItems.some((item) => !item.name || !item.dosage || !item.frequency || !item.duration)
      if (incompleteMedication) {
         return res.json({ success: false, message: 'Please complete all medication item fields' })
      }

      const appointmentData = await appointmentModel.findById(appointmentId)

      // Check if appointment exists
      if (!appointmentData) {
         await logAudit({
            action: 'prescription_create',
            status: 'failed',
            reason: 'Appointment not found',
            entityType: 'appointment',
            entityId: appointmentId,
            metadata: { changedFields: ['diagnosis', 'symptoms', 'medicines', 'instructions', 'nextVisit', 'labTests', 'documentation'] },
            req
         })
         return res.json({success: false, message: 'Appointment not found'})
      }

      // Check if appointment belongs to this doctor
      if (appointmentData.docId !== docId) {
         await logAudit({
            action: 'prescription_create',
            status: 'failed',
            reason: 'Doctor attempted to complete another doctor appointment',
            targetUserId: appointmentData.userId,
            entityType: 'appointment',
            entityId: appointmentId,
            metadata: { patientId: appointmentData.userId, doctorId: docId, appointmentDoctorId: appointmentData.docId },
            req
         })
         return res.json({success: false, message: 'Unauthorized access'})
      }

      // Check if already completed with prescription
      const existingPrescription = await prescriptionModel.findOne({ appointmentId })
      if (existingPrescription) {
         await logAudit({
            action: 'prescription_create',
            status: 'failed',
            reason: 'Prescription already exists for appointment',
            targetUserId: appointmentData.userId,
            entityType: 'prescription',
            entityId: existingPrescription._id,
            metadata: { appointmentId, patientId: appointmentData.userId, doctorId: docId },
            req
         })
         return res.json({success: false, message: 'Prescription already exists for this appointment'})
      }

      // Prescription save karo with complete data
      const prescription = new prescriptionModel({
         appointmentId,
         userId: appointmentData.userId,
         docId,
         userData: appointmentData.userData,    // Patient details
         docData: appointmentData.docData,      // Doctor details
         slotDate: appointmentData.slotDate,    // Appointment date
         slotTime: appointmentData.slotTime,    // Appointment time
         amount: appointmentData.amount,        // Fees
         diagnosis,
         symptoms,
         medicines: medicinesText,
         medicationItems: normalizedMedicationItems,
         instructions,
         nextVisit,
         labTests,              
         documentation,                    
         isEdited: false,
         editHistory: []
      })

      await prescription.save()

      // Appointment complete karo
      await appointmentModel.findByIdAndUpdate(appointmentId, {isCompleted: true, appointmentStatus: 'Finished', statusUpdatedAt: Date.now()})

      await logAudit({
         action: 'prescription_create',
         status: 'success',
         targetUserId: appointmentData.userId,
         entityType: 'prescription',
         entityId: prescription._id,
         metadata: {
            appointmentId,
            patientId: appointmentData.userId,
            doctorId: docId,
            changedFields: ['diagnosis', 'symptoms', 'medicines', 'instructions', 'nextVisit', 'labTests', 'documentation']
         },
         req
      })
      
      return res.json({
         success: true, 
         message: 'Appointment completed',
         prescriptionId: prescription._id
      })

   } catch (error) {
      console.log(error)
      res.json({success: false, message: error.message})
   }
}


// API to cancel appointment completed for doctor panel
const appointmentCancel = async (req,res) => {
   try {
      const { appointmentId } = req.body
      const docId = req.doctor.docId
      
      const appointmentData = await appointmentModel.findById(appointmentId)

      if(appointmentData && appointmentData.docId === docId) {
         
        await appointmentModel.findByIdAndUpdate(appointmentId, {cancelled: true, appointmentStatus: 'Cancelled', statusUpdatedAt: Date.now()})
        await doctorModel.findByIdAndUpdate(docId, { $pull: { [`slots_booked.${appointmentData.slotDate}`]: appointmentData.slotTime } })
        await logAudit({
         action: 'appointment_cancel',
         status: 'success',
         targetUserId: appointmentData.userId,
         entityType: 'appointment',
         entityId: appointmentId,
         metadata: {
            cancelledBy: 'doctor',
            patientId: appointmentData.userId,
            doctorId: docId,
            slotDate: appointmentData.slotDate,
            slotTime: appointmentData.slotTime
         },
         req
        })
        return res.json({success: true, message:'Appointment Cancelled'})

      } else {
         return res.json({success: false, message:'cancellation failed'})
      }

   } catch (error) {
      console.log(error)
      res.json({success: false, message: error.message})
   }
}





// API to get doctor patient history for doctor panel
const patienthistory = async (req,res) => {
   try {
      const docId = req.doctor.docId;
      const history = await prescriptionModel.find({ docId }).lean()
      const userIds = [...new Set(history.map((item) => item.userId).filter(Boolean))]
      const users = await userModel.find({ _id: { $in: userIds } }).select('medicalHistory insurance').lean()
      const historyByUser = users.reduce((acc, user) => {
         acc[user._id.toString()] = {
            medicalHistory: user.medicalHistory || {},
            insurance: user.insurance || {}
         }
         return acc
      }, {})
      history.forEach((item) => {
         item.patientMedicalHistory = historyByUser[item.userId]?.medicalHistory || {}
         item.patientInsurance = historyByUser[item.userId]?.insurance || item.userData?.insurance || {}
      })
      res.json({success: true, history})  

   } catch (error) {
      console.log(error)
      res.json({success:false, message:error.message})
   }
}




const editPrescription = async (req, res) => {
   try {
      const docId = req.doctor.docId;
      const { prescriptionId, updatedFields } = req.body;

      if (!prescriptionId || !updatedFields) {
         await logAudit({
            action: 'prescription_update',
            status: 'failed',
            reason: 'Missing prescription update data',
            entityType: 'prescription',
            entityId: prescriptionId || '',
            req
         })
         return res.json({ success: false, message: 'Missing data' });
      }

      const prescription = await prescriptionModel.findOne({ 
         _id: prescriptionId,
         docId: docId
      });

      if (!prescription) {
         await logAudit({
            action: 'prescription_update',
            status: 'failed',
            reason: 'Prescription not found or not assigned to doctor',
            entityType: 'prescription',
            entityId: prescriptionId,
            metadata: { doctorId: docId },
            req
         })
         return res.json({ success: false, message: 'Prescription not found' });
      }

      // Check if already edited
      if (prescription.isEdited) {
         await logAudit({
            action: 'prescription_update',
            status: 'failed',
            reason: 'Prescription already edited once',
            targetUserId: prescription.userId,
            entityType: 'prescription',
            entityId: prescriptionId,
            metadata: { patientId: prescription.userId, doctorId: docId },
            req
         })
         return res.json({ success: false, message: 'Already edited once' });
      }

      // 24-hour check
      const hoursPassed = (Date.now() - new Date(prescription.createdAt)) / (1000 * 60 * 60);
      if (hoursPassed > 24) {
         await logAudit({
            action: 'prescription_update',
            status: 'failed',
            reason: 'Prescription edit window expired',
            targetUserId: prescription.userId,
            entityType: 'prescription',
            entityId: prescriptionId,
            metadata: { patientId: prescription.userId, doctorId: docId },
            req
         })
         return res.json({ success: false, message: 'Cannot edit after 24 hours' });
      }

      const allowed = ['diagnosis', 'symptoms', 'medicines', 'medicationItems', 'instructions', 'nextVisit', 'labTests', 'documentation'];
      const changes = {};
      const updateData = {};

      allowed.forEach(field => {
         const newValue = updatedFields[field];
         const oldValue = prescription[field] || '';
         
         const oldComparable = field === 'medicationItems' ? JSON.stringify(oldValue || []) : oldValue
         const newComparable = field === 'medicationItems' ? JSON.stringify(newValue || []) : newValue

         if (newValue !== undefined && oldComparable !== newComparable) {
            changes[field] = { old: oldValue, new: newValue };
            updateData[field] = newValue;
         }
      });

      if (updateData.medicationItems) {
         const normalizedMedicationItems = Array.isArray(updateData.medicationItems)
            ? updateData.medicationItems
               .map((item) => ({
                  name: String(item?.name || '').trim(),
                  dosage: String(item?.dosage || '').trim(),
                  frequency: String(item?.frequency || '').trim(),
                  duration: String(item?.duration || '').trim(),
                  instructions: String(item?.instructions || '').trim()
               }))
               .filter((item) => item.name || item.dosage || item.frequency || item.duration || item.instructions)
            : []

         if (normalizedMedicationItems.length === 0 || normalizedMedicationItems.some((item) => !item.name || !item.dosage || !item.frequency || !item.duration)) {
            return res.json({ success: false, message: 'Please complete all medication item fields' })
         }

         updateData.medicationItems = normalizedMedicationItems
         updateData.medicines = normalizedMedicationItems
            .map((item) => `${item.name} - ${item.dosage} - ${item.frequency} - ${item.duration}${item.instructions ? ` - ${item.instructions}` : ''}`)
            .join('\n')
      }

      if (Object.keys(changes).length === 0) {
         await logAudit({
            action: 'prescription_update',
            status: 'failed',
            reason: 'No changes detected',
            targetUserId: prescription.userId,
            entityType: 'prescription',
            entityId: prescriptionId,
            metadata: { patientId: prescription.userId, doctorId: docId },
            req
         })
         return res.json({ success: false, message: 'No changes detected' });
      }

      await prescriptionModel.findByIdAndUpdate(prescriptionId, {
         ...updateData,
         isEdited: true,
         $push: { 
            editHistory: { 
               changedFields: changes, 
               editedAt: Date.now(), 
               editedBy: docId
            } 
         }
      });

      await logAudit({
         action: 'prescription_update',
         status: 'success',
         targetUserId: prescription.userId,
         entityType: 'prescription',
         entityId: prescriptionId,
         metadata: {
            patientId: prescription.userId,
            doctorId: docId,
            changedFields: Object.keys(changes)
         },
         req
      })

      res.json({ success: true, message: 'Updated successfully' });
   } catch (error) {
      console.log(error);
      res.json({ success: false, message: error.message });
   }
};




// API to get dashboard data for doctor panel
const doctordashboard = async (req,res) => {
    try {
      const { docId } = req.doctor

      const appointments = await appointmentModel.find({ docId })

      let earnings = 0

      appointments.map((item) => {
         if(item.isCompleted || item.payment) {
            earnings += item.amount
         }
      })

      let patients = []

      appointments.map((item) => {
        if(!patients.includes(item.userId)){
           patients.push(item.userId)
        }
      })


      const dashData = {
         earnings,
         appointments: appointments.length,
         patients: patients.length,
         latestAppointments: appointments.reverse().slice(0,5)
      }
      res.json({success: true, dashData})

    } catch (error) {
      console.log(error)
      res.json({success: false, message: error.message})
    }
}



// API to get doctor profile for Doctor Panel
const doctorProfile = async (req,res) => {
   try {      
    const { docId } = req.doctor
    const profileData = await doctorModel.findById(docId).select('-password').lean()
    const [profileDataWithRatings] = await attachRatingSummariesToDoctors(profileData ? [profileData] : [])

    res.json({ success: true, profileData: profileDataWithRatings })

   } catch (error) {
      console.log(error)
      res.json({success: false, message: error.message})
   }
}



// API to update doctor profile data from Doctor panel
const updateDoctorprofile = async (req,res) => {
  try {
   const { docId } = req.doctor; 
   const { fees, address, available, schedule, locations } = req.body;
   const updateData = { fees, address, available, locations: normalizeDoctorLocations(locations) }

   if (schedule) {
      updateData.schedule = sanitizeSchedule(schedule)
   }

   await doctorModel.findByIdAndUpdate(docId, updateData)

   res.json({ success: true, message: 'Profile Updated'})

  } catch (error) {
   console.log(error)
   res.json({success: false, message: error.message})
  }

}

const updatePatientMedicalHistory = async (req, res) => {
   try {
      const docId = req.doctor.docId
      const { patientId, medicalHistory } = req.body

      if (!patientId || !medicalHistory) {
         return res.json({ success: false, message: 'Patient and medical history are required' })
      }

      const hasRelationship = await appointmentModel.exists({ docId, userId: patientId })
      if (!hasRelationship) {
         return res.json({ success: false, message: 'Patient is not assigned to this doctor' })
      }

      const allowed = ['conditions', 'allergies', 'surgeries', 'familyHistory', 'socialHistory', 'notes']
      const nextHistory = allowed.reduce((acc, field) => {
         acc[field] = String(medicalHistory[field] || '').trim()
         return acc
      }, {})

      nextHistory.updatedAt = Date.now()
      nextHistory.updatedBy = docId

      await userModel.findByIdAndUpdate(patientId, { medicalHistory: nextHistory })

      await logAudit({
         action: 'medical_history_update',
         status: 'success',
         targetUserId: patientId,
         entityType: 'user',
         entityId: patientId,
         metadata: { doctorId: docId, changedFields: allowed },
         req
      })

      res.json({ success: true, message: 'Patient medical history updated', medicalHistory: nextHistory })
   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}

const updateAppointmentHomeVisitAddress = async (req, res) => {
   try {
      const docId = req.doctor?.docId || req.user?.docId || req.user?.userId
      const { appointmentId } = req.body
      const homeVisitAddress = normalizeHomeVisitAddress(req.body.homeVisitAddress || {})
      const addressError = validateHomeVisitAddress(homeVisitAddress)

      if (!appointmentId || addressError) {
         return res.json({ success: false, message: addressError || 'Appointment is required' })
      }

      const appointment = await appointmentModel.findById(appointmentId)
      if (!appointment || appointment.docId !== docId) {
         return res.json({ success: false, message: 'Appointment not found' })
      }
      if (appointment.appointmentType !== 'Home Visit') {
         return res.json({ success: false, message: 'Only home visit appointments have a visit address' })
      }

      const updatedAddress = { ...homeVisitAddress, updatedBy: 'Doctor', updatedAt: Date.now() }
      await appointmentModel.findByIdAndUpdate(appointmentId, { homeVisitAddress: updatedAddress })

      await logAudit({
         action: 'home_visit_address_update',
         status: 'success',
         targetUserId: appointment.userId,
         entityType: 'appointment',
         entityId: appointmentId,
         metadata: { doctorId: docId, area: updatedAddress.area },
         req
      })

      res.json({ success: true, message: 'Home visit address updated', homeVisitAddress: updatedAddress })
   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}


export { changeAvailability, doctorList, loginDoctor, appointmentsDoctor, appointmentComplete, appointmentCancel, doctordashboard, doctorProfile, updateDoctorprofile, patienthistory, editPrescription, updatePatientMedicalHistory, updateAppointmentHomeVisitAddress}
