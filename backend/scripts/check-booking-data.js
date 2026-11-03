/**
 * Checks live appointments before deploying the booking branch. Safe to run repeatedly.
 * From backend/:
 *   node scripts/check-booking-data.js                    reports, writes nothing
 *   node scripts/check-booking-data.js --scrub --apply    removes secrets copied into old appointments
 * Local databases only, unless --allow-remote is passed too.
 *
 * Reports:
 *   - two live appointments in one doctor slot. These stop the new unique index from building,
 *     and the duplicates are double bookings someone has to resolve by hand.
 *   - one Stripe payment on two appointments, which stops the payment index.
 *   - slot text in a non-standard form, which the double-booking check cannot match.
 *   - appointment copies of a doctor or patient that still carry passwords, MFA secrets,
 *     reset codes, pay settings or medical history.
 */
import '../config/env.js'
import connectDB from '../config/mongodb.js'
import appointmentModel from '../models/appointmentModel.js'
import { canonicalSlotDate, canonicalSlotTime } from '../services/clinicTimeService.js'
import { isLocalMongoUri } from '../utils/mongoUri.js'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const scrub = args.includes('--scrub')
const allowRemote = args.includes('--allow-remote')

const SNAPSHOT_SECRETS = {
  docData: ['password', 'mfa', 'financialCompensation'],
  userData: ['password', 'mfa', 'resetOtp', 'resetOtpExpireAt', 'emailVerifyOtp', 'phoneVerifyOtp', 'medicalHistory']
}

const secretFilter = () => ({
  $or: Object.entries(SNAPSHOT_SECRETS).flatMap(([copy, fields]) =>
    fields.map((field) => ({ [`${copy}.${field}`]: { $exists: true } })))
})

export const checkBookingData = async ({ log = console.log } = {}) => {
  const doubleBooked = await appointmentModel.aggregate([
    { $match: { cancelled: false } },
    { $group: { _id: { docId: '$docId', slotDate: '$slotDate', slotTime: '$slotTime' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } }
  ])
  log(`Doctor slots with more than one live appointment: ${doubleBooked.length}`)
  doubleBooked.forEach((row) => log(`  ${JSON.stringify(row._id)} -> ${row.ids.join(', ')}`))

  const sharedPayments = await appointmentModel.aggregate([
    { $match: { stripePaymentIntentId: { $gt: '' } } },
    { $group: { _id: '$stripePaymentIntentId', count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } }
  ])
  log(`Stripe payments recorded on more than one appointment: ${sharedPayments.length}`)
  sharedPayments.forEach((row) => log(`  ${row._id} -> ${row.ids.join(', ')}`))

  const live = await appointmentModel.find({ cancelled: false }).select('slotDate slotTime').lean()
  const oddFormat = live.filter((row) => canonicalSlotDate(row.slotDate) !== row.slotDate || canonicalSlotTime(row.slotTime) !== row.slotTime)
  log(`Live appointments with slot text in a non-standard form: ${oddFormat.length}`)
  oddFormat.slice(0, 20).forEach((row) => log(`  ${row._id}: "${row.slotDate}" "${row.slotTime}"`))

  const withSecrets = await appointmentModel.countDocuments(secretFilter())
  log(`Appointments whose doctor or patient copy holds secrets or medical history: ${withSecrets}`)

  return { doubleBooked: doubleBooked.length, sharedPayments: sharedPayments.length, oddFormat: oddFormat.length, withSecrets }
}

export const scrubSnapshots = async () => {
  const unset = Object.fromEntries(Object.entries(SNAPSHOT_SECRETS).flatMap(([copy, fields]) => fields.map((field) => [`${copy}.${field}`, ''])))
  const result = await appointmentModel.updateMany(secretFilter(), { $unset: unset })
  return result.modifiedCount
}

const run = async () => {
  if (!isLocalMongoUri(process.env.MONGODB_URI) && !allowRemote) {
    console.error('MONGODB_URI is not a local database. Refusing to run without --allow-remote.')
    process.exit(1)
  }
  await connectDB()
  await checkBookingData()

  if (scrub) {
    if (apply) console.log(`Removed secrets from ${await scrubSnapshots()} appointments.`)
    else console.log('Dry run: pass --scrub --apply to remove them.')
  }
  process.exit(0)
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  run().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
