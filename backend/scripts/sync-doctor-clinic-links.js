/**
 * One-time (or occasional) sync: link each doctor to clinics whose name matches their speciality.
 * Run from backend/: node scripts/sync-doctor-clinic-links.js
 */
import 'dotenv/config'
import connectDB from '../config/mongodb.js'
import doctorModel from '../models/doctorModel.js'
import { resolveClinicIdsForDoctor } from '../utils/doctorClinicLink.js'

const run = async () => {
  await connectDB()
  const doctors = await doctorModel.find({}).select('_id name speciality clinics').lean()
  let updated = 0

  for (const doctor of doctors) {
    const current = (doctor.clinics || []).map((id) => String(id))
    const next = await resolveClinicIdsForDoctor(doctor.speciality, current)
    const changed =
      next.length !== current.length ||
      next.some((id) => !current.includes(id))

    if (changed) {
      await doctorModel.updateOne({ _id: doctor._id }, { $set: { clinics: next } })
      updated += 1
      console.log(`Updated ${doctor.name} (${doctor.speciality}) → clinics: ${next.join(', ')}`)
    }
  }

  console.log(`Done. ${updated} of ${doctors.length} doctors updated.`)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
