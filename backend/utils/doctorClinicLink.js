import clinicModel from '../models/clinicModel.js'

export const normalizePlaceKey = (value) => String(value || '').trim().toLowerCase()

/** Merge explicit clinic picks with clinics whose name matches the doctor speciality. */
export async function resolveClinicIdsForDoctor(speciality, explicitClinicIds = []) {
  const explicit = [...new Set((explicitClinicIds || []).filter(Boolean).map(String))]
  const specKey = normalizePlaceKey(speciality)
  if (!specKey) return explicit

  const clinics = await clinicModel.find({ active: { $ne: false } }).select('_id name').lean()
  const autoIds = clinics
    .filter((clinic) => normalizePlaceKey(clinic.name) === specKey)
    .map((clinic) => String(clinic._id))

  return [...new Set([...explicit, ...autoIds])]
}

const clinicIdStrings = (doctor) =>
  (doctor?.clinics || [])
    .map((clinic) => {
      if (clinic == null) return ''
      if (typeof clinic === 'object' && clinic._id != null) return String(clinic._id)
      return String(clinic).trim()
    })
    .filter(Boolean)

/** Ensure API payloads include the clinic row that matches doctor.speciality. */
export function enrichDoctorWithSpecialityClinic(doctor, clinicBySpecKey) {
  if (!doctor || !clinicBySpecKey?.size) return doctor

  const doc = typeof doctor.toObject === 'function' ? doctor.toObject() : { ...doctor }
  const specKey = normalizePlaceKey(doc.speciality)
  const matched = specKey ? clinicBySpecKey.get(specKey) : null
  if (!matched) return doc

  const matchedId = String(matched._id)
  if (clinicIdStrings(doc).includes(matchedId)) return doc

  return {
    ...doc,
    clinics: [...(doc.clinics || []), { _id: matched._id, name: matched.name }]
  }
}

export async function buildClinicBySpecialityMap() {
  const clinics = await clinicModel.find({ active: { $ne: false } }).select('_id name').lean()
  const map = new Map()
  for (const clinic of clinics) {
    const key = normalizePlaceKey(clinic.name)
    if (key && !map.has(key)) map.set(key, clinic)
  }
  return map
}
