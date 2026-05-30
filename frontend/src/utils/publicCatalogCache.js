const DOCTORS_SESSION_KEY = 'clinivo_public_doctors_v1'
const DOCTORS_LOCAL_KEY = 'clinivo_public_doctors_local_v1'
const CLINICS_SESSION_KEY = 'clinivo_public_clinics_v1'
const CLINICS_LOCAL_KEY = 'clinivo_public_clinics_local_v1'

function parseList(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch (_) {
    return null
  }
}

function readCachedList(sessionKey, localKey) {
  if (typeof window === 'undefined') return null
  try {
    const fromSession = parseList(sessionStorage.getItem(sessionKey))
    if (fromSession?.length) return fromSession
    return parseList(localStorage.getItem(localKey))
  } catch (_) {
    return null
  }
}

function writeCachedList(sessionKey, localKey, list) {
  if (typeof window === 'undefined' || !Array.isArray(list)) return
  const serialized = JSON.stringify(list)
  try {
    sessionStorage.setItem(sessionKey, serialized)
  } catch (_) {}
  try {
    localStorage.setItem(localKey, serialized)
  } catch (_) {}
}

export function readCachedPublicDoctors() {
  return readCachedList(DOCTORS_SESSION_KEY, DOCTORS_LOCAL_KEY)
}

export function writeCachedPublicDoctors(doctors) {
  writeCachedList(DOCTORS_SESSION_KEY, DOCTORS_LOCAL_KEY, doctors)
}

export function readCachedPublicClinics() {
  return readCachedList(CLINICS_SESSION_KEY, CLINICS_LOCAL_KEY)
}

export function writeCachedPublicClinics(clinics) {
  writeCachedList(CLINICS_SESSION_KEY, CLINICS_LOCAL_KEY, clinics)
}
