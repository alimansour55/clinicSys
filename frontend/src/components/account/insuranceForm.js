const MAX_FILE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export const emptyInsurance = { provider: '', fullName: '', birthDate: '', idNumber: '', expiryDate: '' }

/** Returns an English error key, or '' when the file can be sent. */
export const checkCardFile = (file) => {
  if (!file) return ''
  if (!ALLOWED_TYPES.includes(file.type)) return 'Please attach a JPG, PNG, WebP or PDF file'
  if (file.size > MAX_FILE_BYTES) return 'File is too large. The limit is 5 MB.'
  return ''
}

export const insuranceProblem = (values, { file, hasExistingCard }) => {
  if (!values.provider) return 'Please select an insurance provider'
  if (!values.fullName || !values.birthDate || !values.idNumber || !values.expiryDate) return 'Please complete all insurance fields'
  if (!file && !hasExistingCard) return 'Please attach a photo of the medical card'
  return checkCardFile(file)
}
