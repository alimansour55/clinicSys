import clinicModel, { defaultClinicNames } from '../models/clinicModel.js'
import doctorModel from '../models/doctorModel.js'
import { logAudit } from '../services/auditService.js'

const normalizeDoctorIds = (doctorIds) => {
  if (!doctorIds) return []
  if (Array.isArray(doctorIds)) return doctorIds.filter(Boolean)

  try {
    const parsed = JSON.parse(doctorIds)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

const normalizeClinicName = (name) => name?.trim()

const seedDefaultClinics = async () => {
  const existingClinics = await clinicModel.find({ name: { $in: defaultClinicNames } }).select('name').lean()
  const existingNames = existingClinics.map((clinic) => clinic.name)
  const missingClinics = defaultClinicNames
    .filter((name) => !existingNames.includes(name))
    .map((name) => ({ name, description: '', date: Date.now() }))

  if (missingClinics.length > 0) {
    await clinicModel.insertMany(missingClinics, { ordered: false })
  }
}

const getClinics = async (req, res) => {
  try {
    await seedDefaultClinics()

    const clinics = await clinicModel.find({}).sort({ name: 1 }).lean()
    const doctors = await doctorModel.find({}).select('-password').populate('clinics').lean()

    const clinicsWithDoctors = clinics.map((clinic) => ({
      ...clinic,
      doctors: doctors.filter((doctor) =>
        (doctor.clinics || []).some((assignedClinic) => assignedClinic?._id?.toString() === clinic._id.toString())
      )
    }))

    res.json({ success: true, clinics: clinicsWithDoctors, defaultClinics: defaultClinicNames })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const getPublicClinics = async (req, res) => {
  try {
    await seedDefaultClinics()

    const clinics = await clinicModel.find({ active: true }).sort({ name: 1 }).lean()
    res.json({ success: true, clinics, defaultClinics: defaultClinicNames })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const createClinic = async (req, res) => {
  try {
    const { description = '' } = req.body
    const name = normalizeClinicName(req.body.name)

    if (!name) {
      return res.json({ success: false, message: 'Clinic name is required' })
    }

    const existingClinic = await clinicModel.findOne({ name })
    if (existingClinic) {
      return res.json({ success: false, message: 'Clinic already exists' })
    }

    const clinic = await clinicModel.create({
      name,
      description,
      date: Date.now()
    })

    await logAudit({
      action: 'clinic_create',
      status: 'success',
      entityType: 'clinic',
      entityId: clinic._id,
      metadata: { clinicName: name },
      req
    })

    res.json({ success: true, message: 'Clinic created successfully' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const updateClinic = async (req, res) => {
  try {
    const { clinicId, description = '', active } = req.body
    const name = normalizeClinicName(req.body.name)

    if (!clinicId) {
      return res.json({ success: false, message: 'Clinic ID is required' })
    }

    const clinic = await clinicModel.findById(clinicId)
    if (!clinic) {
      return res.json({ success: false, message: 'Clinic not found' })
    }

    if (name && name !== clinic.name) {
      const existingClinic = await clinicModel.findOne({ name })
      if (existingClinic) {
        return res.json({ success: false, message: 'Clinic already exists' })
      }
      clinic.name = name
    }

    clinic.description = description
    if (typeof active !== 'undefined') {
      clinic.active = active === true || active === 'true'
    }

    await clinic.save()

    await logAudit({
      action: 'clinic_update',
      status: 'success',
      entityType: 'clinic',
      entityId: clinic._id,
      metadata: { clinicName: clinic.name },
      req
    })

    res.json({ success: true, message: 'Clinic updated successfully' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const deleteClinic = async (req, res) => {
  try {
    const { clinicId } = req.body

    if (!clinicId) {
      return res.json({ success: false, message: 'Clinic ID is required' })
    }

    const assignedDoctors = await doctorModel.countDocuments({ clinics: clinicId })
    if (assignedDoctors > 0) {
      return res.json({ success: false, message: 'Remove assigned doctors before deleting this clinic' })
    }

    const deletedClinic = await clinicModel.findByIdAndDelete(clinicId)
    if (!deletedClinic) {
      return res.json({ success: false, message: 'Clinic not found' })
    }

    await logAudit({
      action: 'clinic_delete',
      status: 'success',
      entityType: 'clinic',
      entityId: clinicId,
      metadata: { clinicName: deletedClinic.name },
      req
    })

    res.json({ success: true, message: 'Clinic deleted successfully' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const assignDoctorsToClinic = async (req, res) => {
  try {
    const { clinicId } = req.body
    const doctorIds = normalizeDoctorIds(req.body.doctorIds)

    if (!clinicId) {
      return res.json({ success: false, message: 'Clinic ID is required' })
    }

    const clinic = await clinicModel.findById(clinicId)
    if (!clinic) {
      return res.json({ success: false, message: 'Clinic not found' })
    }

    await doctorModel.updateMany({ clinics: clinicId }, { $pull: { clinics: clinicId } })

    if (doctorIds.length > 0) {
      await doctorModel.updateMany(
        { _id: { $in: doctorIds } },
        { $addToSet: { clinics: clinicId } }
      )
    }

    await logAudit({
      action: 'clinic_doctors_assign',
      status: 'success',
      entityType: 'clinic',
      entityId: clinicId,
      metadata: { clinicName: clinic.name, doctorIds },
      req
    })

    res.json({ success: true, message: 'Doctor assignments updated' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

export { getClinics, getPublicClinics, createClinic, updateClinic, deleteClinic, assignDoctorsToClinic }
