import mongoose from 'mongoose'

export const FAMILY_RELATIONS = ['child', 'spouse', 'parent', 'sibling', 'other']
export const BLOOD_TYPES = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

/** Someone a patient looks after: a child or an elderly parent. Every query must filter by ownerId. */
const familyMemberSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, index: true },
  name: { type: String, required: true, maxlength: 120 },
  relation: { type: String, enum: FAMILY_RELATIONS, default: 'other' },
  dob: { type: String, default: '' },
  gender: { type: String, enum: ['Male', 'Female', 'Not Selected'], default: 'Not Selected' },
  bloodType: { type: String, enum: BLOOD_TYPES, default: '' },
  allergies: { type: String, default: '', maxlength: 2000 },
  conditions: { type: String, default: '', maxlength: 2000 },
  medications: { type: String, default: '', maxlength: 2000 },
  notes: { type: String, default: '', maxlength: 2000 }
}, { timestamps: true })

const familyMemberModel = mongoose.models.familyMember || mongoose.model('familyMember', familyMemberSchema)

export default familyMemberModel
