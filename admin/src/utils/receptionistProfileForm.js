export const emptyAddress = () => ({
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: ''
})

export const emptyEmergencyContact = () => ({
  name: '',
  phone: '',
  relationship: ''
})

export const mergeReceptionistFromApi = (raw) => {
  if (!raw) return null
  return {
    ...raw,
    address: { ...emptyAddress(), ...(raw.address || {}) },
    emergencyContact: { ...emptyEmergencyContact(), ...(raw.emergencyContact || {}) },
    jobTitle: raw.jobTitle || 'Receptionist',
    department: raw.department || '',
    employeeId: raw.employeeId || '',
    bio: raw.bio || '',
    image: raw.image || '',
    adminNotes: raw.adminNotes || ''
  }
}
