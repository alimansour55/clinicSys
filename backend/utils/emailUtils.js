/** Case-insensitive email handling (RFC 5321 local-part may differ; we normalize for login/lookup). */

const EMAIL_COLLATION = { locale: 'en', strength: 2 }

export const normalizeEmail = (email) => {
  if (email == null) return ''
  const value = String(email).trim()
  return value ? value.toLowerCase() : ''
}

export const findOneByEmail = (Model, email, extraFilter = {}, select = null) => {
  const normalized = normalizeEmail(email)
  if (!normalized) return Promise.resolve(null)
  const query = Model.findOne({ ...extraFilter, email: normalized }).collation(EMAIL_COLLATION)
  return select ? query.select(select) : query
}

export const emailExists = async (Model, email, excludeId = null) => {
  const filter = excludeId ? { _id: { $ne: excludeId } } : {}
  const doc = await findOneByEmail(Model, email, filter)
  return Boolean(doc)
}

export const adminEmailsMatch = (inputEmail, configuredEmail) =>
  normalizeEmail(inputEmail) === normalizeEmail(configuredEmail)
