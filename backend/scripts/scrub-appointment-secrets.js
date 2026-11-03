/**
 * Removes passwords, MFA secrets and one-time codes from the patient and doctor copies stored on old
 * appointments. Bookings used to copy the whole account into appointment.userData and appointment.docData.
 *
 *   node scripts/scrub-appointment-secrets.js                  dry run: counts only, writes nothing
 *   node scripts/scrub-appointment-secrets.js --apply          writes
 *   node scripts/scrub-appointment-secrets.js --allow-remote   required for a non-local MONGODB_URI
 *
 * Safe to run repeatedly. It only unsets these fields and touches nothing else.
 */
import '../config/env.js'
import mongoose from 'mongoose'

const SECRET_PATHS = [
  'password',
  'resetOtp',
  'resetOtpExpireAt',
  'emailVerifyOtp',
  'phoneVerifyOtp',
  'mfa.secret',
  'mfa.recoveryCodes',
  'mfa.lastUsedStep'
]

export const scrubSpec = () => {
  const paths = SECRET_PATHS.flatMap((path) => [`userData.${path}`, `docData.${path}`])
  return {
    filter: { $or: paths.filter((path) => !path.endsWith('ExpireAt')).map((path) => ({ [path]: { $exists: true } })) },
    update: { $unset: Object.fromEntries(paths.map((path) => [path, ''])) }
  }
}

const isLocal = (uri) => /^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(uri)

const main = async () => {
  const apply = process.argv.includes('--apply')
  const uri = process.env.MONGODB_URI || ''
  if (!uri) throw new Error('MONGODB_URI is not set')
  if (!isLocal(uri) && !process.argv.includes('--allow-remote')) {
    throw new Error('Refusing a non-local MONGODB_URI without --allow-remote')
  }

  await mongoose.connect(uri)
  const appointments = mongoose.connection.collection('appointments')
  const { filter, update } = scrubSpec()

  const affected = await appointments.countDocuments(filter)
  console.log(`Appointments holding secrets: ${affected}`)

  if (apply && affected) {
    const result = await appointments.updateMany(filter, update)
    console.log(`Scrubbed: ${result.modifiedCount}`)
  } else if (!apply) {
    console.log('Dry run. Add --apply to write.')
  }

  await mongoose.disconnect()
}

if (process.argv[1] && process.argv[1].endsWith('scrub-appointment-secrets.js')) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
