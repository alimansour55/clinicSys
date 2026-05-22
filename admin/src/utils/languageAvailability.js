export const LANGUAGE_ROLES = ['patient', 'doctor', 'receptionist', 'admin']
export const DEFAULT_ROLE_LANGUAGE_POLICY = { en: true, ar: true }

export const LANGUAGE_AVAILABILITY_MODES = ['both', 'en', 'ar']
export const DEFAULT_LANGUAGE_AVAILABILITY = 'both'

export const normalizeLanguageAvailability = (value) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'en' || raw === 'english') return 'en'
  if (raw === 'ar' || raw === 'arabic') return 'ar'
  return 'both'
}

export const legacyAvailabilityToPolicy = (value) => {
  const mode = normalizeLanguageAvailability(value)
  if (mode === 'en') return { en: true, ar: false }
  if (mode === 'ar') return { en: false, ar: true }
  return { en: true, ar: true }
}

export const normalizeRoleLanguagePolicy = (input, fallback = DEFAULT_ROLE_LANGUAGE_POLICY) => {
  if (typeof input === 'string') return legacyAvailabilityToPolicy(input)

  const base = fallback && typeof fallback === 'object' ? fallback : DEFAULT_ROLE_LANGUAGE_POLICY
  const readBool = (key) => {
    if (input == null || input[key] === undefined || input[key] === '') return base[key]
    if (typeof input[key] === 'boolean') return input[key]
    return input[key] === true || input[key] === 'true' || input[key] === '1' || input[key] === 'on'
  }

  let en = readBool('en')
  let ar = readBool('ar')
  if (!en && !ar) en = true
  return { en, ar }
}

export const normalizeLanguagePolicies = (input, legacyAvailability) => {
  const legacyPolicy = legacyAvailabilityToPolicy(legacyAvailability)
  const source = input && typeof input === 'object' ? input : {}

  return LANGUAGE_ROLES.reduce((acc, role) => {
    acc[role] = normalizeRoleLanguagePolicy(source[role], legacyPolicy)
    return acc
  }, {})
}

export const getAllowedLanguagesFromPolicy = (policy) => {
  const normalized = normalizeRoleLanguagePolicy(policy)
  const allowed = []
  if (normalized.en) allowed.push('en')
  if (normalized.ar) allowed.push('ar')
  return allowed.length ? allowed : ['en']
}

export const getAllowedLanguages = (policy = DEFAULT_LANGUAGE_AVAILABILITY) =>
  getAllowedLanguagesFromPolicy(policy)

export const getPolicyForRole = (languagePolicies, role, legacyAvailability) => {
  const policies = normalizeLanguagePolicies(languagePolicies, legacyAvailability)
  const key = LANGUAGE_ROLES.includes(role) ? role : 'patient'
  return policies[key]
}

export const resolveLanguageForPolicy = (storedLang, policy = DEFAULT_ROLE_LANGUAGE_POLICY) => {
  const allowed = getAllowedLanguagesFromPolicy(policy)
  const lang = storedLang === 'ar' ? 'ar' : 'en'
  return allowed.includes(lang) ? lang : allowed[0]
}

/** Broadest policy for staff login screen (any role may need a language). */
export const getStaffLoginLanguagePolicy = (languagePolicies, legacyAvailability) => {
  const policies = normalizeLanguagePolicies(languagePolicies, legacyAvailability)
  return {
    en: LANGUAGE_ROLES.some((role) => policies[role]?.en),
    ar: LANGUAGE_ROLES.some((role) => policies[role]?.ar)
  }
}
