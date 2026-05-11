import appointmentModel from '../models/appointmentModel.js'
import doctorModel from '../models/doctorModel.js'
import ratingModel from '../models/ratingModel.js'
import { logAudit } from '../services/auditService.js'

const normalizeRating = (value) => {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) return null
  return numeric
}

const buildSummaryMap = async (doctorIds = []) => {
  const normalizedDoctorIds = doctorIds.map((id) => String(id)).filter(Boolean)
  if (normalizedDoctorIds.length === 0) return {}

  const summaries = await ratingModel.aggregate([
    { $match: { docId: { $in: normalizedDoctorIds } } },
    {
      $group: {
        _id: '$docId',
        averageRating: { $avg: '$rating' },
        ratingCount: { $sum: 1 }
      }
    }
  ])

  return summaries.reduce((acc, item) => {
    acc[item._id] = {
      averageRating: Number(item.averageRating.toFixed(1)),
      ratingCount: item.ratingCount
    }
    return acc
  }, {})
}

export const getDoctorRatingSummaryMap = buildSummaryMap

export const attachRatingSummariesToDoctors = async (doctors = []) => {
  const summaryMap = await buildSummaryMap(doctors.map((doctor) => doctor._id || doctor.id))
  return doctors.map((doctor) => {
    const plainDoctor = typeof doctor.toObject === 'function' ? doctor.toObject() : doctor
    return {
      ...plainDoctor,
      ratingSummary: summaryMap[String(plainDoctor._id)] || { averageRating: 0, ratingCount: 0 }
    }
  })
}

const getDoctorRatings = async (req, res) => {
  try {
    const { docId } = req.params
    const ratings = await ratingModel.find({ docId }).sort({ createdAt: -1 }).lean()
    const summaryMap = await buildSummaryMap([docId])

    res.json({
      success: true,
      summary: summaryMap[docId] || { averageRating: 0, ratingCount: 0 },
      ratings
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const createRating = async (req, res) => {
  try {
    const userId = req.user.userId
    const { appointmentId, rating, comment = '' } = req.body
    const normalizedRating = normalizeRating(rating)
    const normalizedComment = String(comment || '').trim()

    if (!appointmentId || !normalizedRating) {
      return res.json({ success: false, message: 'Please choose a rating from 1 to 5' })
    }

    if (normalizedComment.length > 1000) {
      return res.json({ success: false, message: 'Comment must be 1000 characters or less' })
    }

    const appointment = await appointmentModel.findById(appointmentId)
    if (!appointment || appointment.userId !== userId) {
      return res.json({ success: false, message: 'Appointment not found' })
    }

    if (appointment.cancelled || !appointment.isCompleted || appointment.appointmentStatus !== 'Finished') {
      return res.json({ success: false, message: 'You can rate only after the appointment is finished' })
    }

    const existingRating = await ratingModel.findOne({ appointmentId })
    if (existingRating) {
      return res.json({ success: false, message: 'You already rated this appointment' })
    }

    const newRating = await ratingModel.create({
      appointmentId,
      docId: appointment.docId,
      userId,
      rating: normalizedRating,
      comment: normalizedComment,
      patientName: appointment.userData?.name || '',
      doctorName: appointment.docData?.name || ''
    })

    await logAudit({
      action: 'doctor_rating_create',
      status: 'success',
      targetUserId: appointment.docId,
      entityType: 'rating',
      entityId: newRating._id,
      metadata: {
        appointmentId,
        patientId: userId,
        doctorId: appointment.docId,
        rating: normalizedRating
      },
      req
    })

    res.json({ success: true, message: 'Thank you for your rating', rating: newRating })
  } catch (error) {
    console.log(error)
    if (error?.code === 11000) {
      return res.json({ success: false, message: 'You already rated this appointment' })
    }
    res.json({ success: false, message: error.message })
  }
}

const getOwnDoctorRatings = async (req, res) => {
  try {
    const docId = req.doctor.docId
    const ratings = await ratingModel.find({ docId }).sort({ createdAt: -1 }).lean()
    const summaryMap = await buildSummaryMap([docId])

    res.json({
      success: true,
      summary: summaryMap[docId] || { averageRating: 0, ratingCount: 0 },
      ratings
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const getAllDoctorRatings = async (req, res) => {
  try {
    const doctors = await doctorModel.find({}).select('name speciality image').lean()
    const ratings = await ratingModel.find({}).sort({ createdAt: -1 }).lean()
    const summaryMap = await buildSummaryMap(doctors.map((doctor) => doctor._id))

    const groupedRatings = doctors.map((doctor) => ({
      doctor,
      summary: summaryMap[String(doctor._id)] || { averageRating: 0, ratingCount: 0 },
      ratings: ratings.filter((rating) => rating.docId === String(doctor._id))
    }))

    res.json({ success: true, groupedRatings })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const deleteRating = async (req, res) => {
  try {
    const { ratingId } = req.body
    if (!ratingId) return res.json({ success: false, message: 'Rating ID is required' })

    const deletedRating = await ratingModel.findByIdAndDelete(ratingId)
    if (!deletedRating) return res.json({ success: false, message: 'Rating not found' })

    await logAudit({
      action: 'doctor_rating_delete',
      status: 'success',
      targetUserId: deletedRating.userId,
      entityType: 'rating',
      entityId: ratingId,
      metadata: {
        appointmentId: deletedRating.appointmentId,
        patientId: deletedRating.userId,
        doctorId: deletedRating.docId,
        rating: deletedRating.rating
      },
      req
    })

    res.json({ success: true, message: 'Rating deleted successfully' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

export { createRating, deleteRating, getAllDoctorRatings, getDoctorRatings, getOwnDoctorRatings }
