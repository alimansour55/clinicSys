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

const parseMaybeJson = (value) => {
  if (value == null || value === '') return null
  if (typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return null
}

export const normalizeReceptionistAddress = (input) => {
  const parsed = parseMaybeJson(input) || {}
  const base = emptyAddress()
  return {
    line1: String(parsed.line1 ?? '').trim(),
    line2: String(parsed.line2 ?? '').trim(),
    city: String(parsed.city ?? '').trim(),
    state: String(parsed.state ?? '').trim(),
    postalCode: String(parsed.postalCode ?? '').trim(),
    country: String(parsed.country ?? '').trim()
  }
}

export const normalizeEmergencyContact = (input) => {
  const parsed = parseMaybeJson(input) || {}
  return {
    name: String(parsed.name ?? '').trim(),
    phone: String(parsed.phone ?? '').trim(),
    relationship: String(parsed.relationship ?? '').trim()
  }
}
