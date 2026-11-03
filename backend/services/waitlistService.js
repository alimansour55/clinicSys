import doctorModel from '../models/doctorModel.js'
import slotHoldModel from '../models/slotHoldModel.js'
import waitlistModel from '../models/waitlistModel.js'
import { getAvailabilityForDoctor } from './availabilityService.js'
import { lockSlot, releaseHold } from './bookingService.js'
import { clinicTodaySlotDate, parseSlotDateParts } from './clinicTimeService.js'
import { pushNotification } from './notificationService.js'

export const WAITLIST_OFFER_MS = 15 * 60 * 1000
export const MAX_ACTIVE_WAITLIST_ENTRIES = 5
const WAITLIST_DAY_RANGE_LIMIT = 14

export const slotDateToNumber = (slotDate) => {
  const parts = parseSlotDateParts(slotDate)
  return parts ? parts.year * 10000 + parts.month * 100 + parts.day : 0
}

const slotKey = (slotDate, slotTime) => `${slotDate}|${slotTime}`

const entryAcceptsSlot = (entry, day, slot) =>
  slotDateToNumber(day.slotDate) >= entry.fromDateKey &&
  slotDateToNumber(day.slotDate) <= entry.toDateKey &&
  !entry.passedSlots.includes(slotKey(day.slotDate, slot.time))

const offerToEntry = async (entry, doctor, slotDate, slotTime, now) => {
  const locked = await lockSlot({ docId: entry.docId, slotDate, slotTime, appointmentType: entry.appointmentType })
  if (!locked) return false

  const expiresAt = now + WAITLIST_OFFER_MS
  const hold = await slotHoldModel.create({
    docId: entry.docId,
    userId: entry.userId,
    slotDate,
    slotTime,
    appointmentType: entry.appointmentType,
    kind: 'waitlist',
    expiresAt,
    waitlistEntryId: String(entry._id),
    draft: { clinicLocation: entry.clinicLocation, visitFeeType: entry.visitFeeType }
  })

  await waitlistModel.updateOne({ _id: entry._id }, {
    status: 'offered',
    offer: { slotDate, slotTime, expiresAt, holdId: String(hold._id) },
    updatedAt: now
  })

  const when = `${slotDate.replace(/_/g, '/')} ${slotTime}`
  await pushNotification({
    recipientRole: 'patient',
    recipientId: entry.userId,
    title: 'A slot opened for you',
    message: `Dr. ${doctor.name} has an opening (${when}). It is reserved for you for 15 minutes.`,
    type: 'waitlist_offer',
    meta: { docId: entry.docId, slotDate, slotTime },
    i18n: { templateId: 'patient_waitlist_offer', params: { doctorName: doctor.name, when } }
  })
  return true
}

/**
 * Offers open slots to the longest-waiting patients, one slot each. Reads availability instead of
 * reacting to cancel events, so a slot freed by reception, a doctor or an admin is picked up too.
 */
export const processWaitlistForDoctor = async (docId, { now = Date.now() } = {}) => {
  const todayNumber = slotDateToNumber(clinicTodaySlotDate(new Date(now)))
  await waitlistModel.updateMany(
    { docId, status: 'waiting', toDateKey: { $lt: todayNumber } },
    { status: 'expired', updatedAt: now }
  )

  const entries = await waitlistModel.find({ docId, status: 'waiting' }).sort({ createdAt: 1 }).limit(25)
  if (!entries.length) return 0

  const doctor = await doctorModel.findById(docId).select('-password')
  if (!doctor || doctor.available === false) return 0

  let offered = 0
  for (const entry of entries) {
    const availability = await getAvailabilityForDoctor(doctor, {
      appointmentType: entry.appointmentType,
      clinicLocation: entry.clinicLocation,
      now: new Date(now)
    })
    const day = availability.days.find((row) => row.slots.some((slot) => slot.available && entryAcceptsSlot(entry, row, slot)))
    if (!day) continue
    const slot = day.slots.find((row) => row.available && entryAcceptsSlot(entry, day, row))
    if (await offerToEntry(entry, doctor, day.slotDate, slot.time, now)) {
      offered += 1
      // The doctor document is stale once a slot is locked. Reload before the next patient.
      const fresh = await doctorModel.findById(docId).select('-password')
      if (fresh) {
        doctor.slots_booked = fresh.slots_booked
        doctor.home_visit_slots_booked = fresh.home_visit_slots_booked
      }
    }
  }
  return offered
}

export const expireWaitlistOffer = async (hold, { now = Date.now() } = {}) => {
  if (!hold.waitlistEntryId) return
  await waitlistModel.updateOne(
    { _id: hold.waitlistEntryId, status: 'offered', 'offer.holdId': String(hold._id) },
    {
      status: 'waiting',
      offer: { slotDate: '', slotTime: '', expiresAt: 0, holdId: '' },
      $addToSet: { passedSlots: slotKey(hold.slotDate, hold.slotTime) },
      updatedAt: now
    }
  )
}

export const markWaitlistBooked = async (hold) => {
  if (!hold?.waitlistEntryId) return
  await waitlistModel.updateOne(
    { _id: hold.waitlistEntryId },
    { status: 'booked', offer: { slotDate: '', slotTime: '', expiresAt: 0, holdId: '' }, updatedAt: Date.now() }
  )
}

/** Booking the same doctor any other way means the patient no longer needs the queue. */
export const closeWaitlistAfterBooking = async ({ userId, docId, slotDate }) => {
  const dateNumber = slotDateToNumber(slotDate)
  await waitlistModel.updateMany(
    { userId, docId, status: 'waiting', fromDateKey: { $lte: dateNumber }, toDateKey: { $gte: dateNumber } },
    { status: 'booked', updatedAt: Date.now() }
  )
}

export const joinWaitlist = async ({ userId, doctor, appointmentType, clinicLocation, visitFeeType, fromSlotDate, toSlotDate, now = new Date() }) => {
  const fromDateKey = slotDateToNumber(fromSlotDate)
  const toDateKey = slotDateToNumber(toSlotDate || fromSlotDate)
  if (!fromDateKey || !toDateKey || toDateKey < fromDateKey) return { error: 'Please choose a valid date' }

  const from = parseSlotDateParts(fromSlotDate)
  const to = parseSlotDateParts(toSlotDate || fromSlotDate)
  const spanDays = (Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / 86400000
  if (spanDays > WAITLIST_DAY_RANGE_LIMIT) return { error: 'Please choose a shorter date range' }
  if (toDateKey < slotDateToNumber(clinicTodaySlotDate(now))) return { error: 'Please choose a valid date' }

  const docId = String(doctor._id)
  const active = await waitlistModel.find({ userId, status: { $in: ['waiting', 'offered'] } }).lean()
  const existing = active.find((entry) =>
    entry.docId === docId &&
    entry.appointmentType === appointmentType &&
    entry.clinicLocation === clinicLocation &&
    entry.fromDateKey === fromDateKey &&
    entry.toDateKey === toDateKey)
  if (existing) return { entry: existing, alreadyJoined: true }
  if (active.length >= MAX_ACTIVE_WAITLIST_ENTRIES) return { error: 'You are already on the maximum number of waitlists' }

  const availability = await getAvailabilityForDoctor(doctor, { appointmentType, clinicLocation, now })
  const open = availability.days.find((day) =>
    slotDateToNumber(day.slotDate) >= fromDateKey && slotDateToNumber(day.slotDate) <= toDateKey && day.availableCount > 0)
  if (open) return { error: 'Slots are open on this date. You can book one now.', slotsOpen: true }

  const entry = await waitlistModel.create({
    userId,
    docId,
    appointmentType,
    clinicLocation,
    visitFeeType,
    fromDateKey,
    toDateKey,
    doctorName: doctor.name
  })
  return { entry }
}

export const leaveWaitlist = async ({ userId, entryId, now = Date.now() }) => {
  const entry = await waitlistModel.findOneAndUpdate(
    { _id: entryId, userId, status: { $in: ['waiting', 'offered'] } },
    { status: 'left', updatedAt: now },
    { new: false }
  )
  if (!entry) return false
  if (entry.offer?.holdId) {
    const hold = await slotHoldModel.findById(entry.offer.holdId)
    if (hold) await releaseHold(hold)
    await processWaitlistForDoctor(entry.docId, { now })
  }
  return true
}

export const listWaitlistForUser = async (userId) => {
  const entries = await waitlistModel
    .find({ userId, status: { $in: ['waiting', 'offered'] } })
    .sort({ createdAt: 1 })
    .lean()
  return Promise.all(entries.map(async (entry) => {
    const position = entry.status === 'waiting'
      ? await waitlistModel.countDocuments({ docId: entry.docId, status: 'waiting', createdAt: { $lte: entry.createdAt } })
      : 0
    return { ...entry, passedSlots: undefined, position }
  }))
}
