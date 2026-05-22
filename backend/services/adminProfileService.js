import siteSettingModel from '../models/siteSettingModel.js'
import { getSecuritySettings } from './securityPolicyService.js'
import { normalizeEgyptPhone } from '../utils/egyptPhone.js'

const SETTING_KEY = 'site-settings'

const DEFAULT_ADMIN_PROFILE = {
  name: 'Administrator',
  phone: '',
  image: '',
  jobTitle: 'Clinic Administrator',
  bio: ''
}

export const normalizeAdminProfile = (raw = {}) => ({
  name: String(raw?.name ?? DEFAULT_ADMIN_PROFILE.name).trim() || DEFAULT_ADMIN_PROFILE.name,
  phone: String(raw?.phone ?? '').trim(),
  image: String(raw?.image ?? '').trim(),
  jobTitle: String(raw?.jobTitle ?? DEFAULT_ADMIN_PROFILE.jobTitle).trim() || DEFAULT_ADMIN_PROFILE.jobTitle,
  bio: String(raw?.bio ?? '').trim().slice(0, 500)
})

export const getAdminProfileRecord = async () => {
  const doc = await siteSettingModel.findOne({ key: SETTING_KEY }).select('adminProfile').lean()
  return normalizeAdminProfile(doc?.adminProfile)
}

export const buildAdminProfileResponse = async (loginEmail) => {
  const [profile, security] = await Promise.all([
    getAdminProfileRecord(),
    getSecuritySettings()
  ])

  return {
    email: loginEmail,
    name: profile.name,
    phone: profile.phone,
    image: profile.image,
    jobTitle: profile.jobTitle,
    bio: profile.bio,
    role: 'admin',
    mfa: {
      enabled: Boolean(security.adminMfa?.enabled && security.adminMfa?.secret),
      configuredAt: Number(security.adminMfa?.configuredAt || 0)
    }
  }
}

export const parseAdminProfileUpdate = (body = {}) => {
  const update = {}

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return { error: 'Name is required' }
    if (name.length > 120) return { error: 'Name is too long' }
    update.name = name
  }

  if (body.phone !== undefined) {
    const raw = String(body.phone).trim()
    if (!raw) {
      update.phone = ''
    } else {
      const phone = normalizeEgyptPhone(raw)
      if (!phone) return { error: 'Enter a valid Egyptian mobile number (01xxxxxxxxx)' }
      update.phone = phone
    }
  }

  if (body.jobTitle !== undefined) {
    update.jobTitle = String(body.jobTitle).trim().slice(0, 80) || DEFAULT_ADMIN_PROFILE.jobTitle
  }

  if (body.bio !== undefined) {
    update.bio = String(body.bio).trim().slice(0, 500)
  }

  if (body.removeImage === true || body.removeImage === 'true') {
    update.image = ''
  }

  return { update }
}

export const saveAdminProfileFields = async (fields) => {
  const normalized = normalizeAdminProfile(fields)
  const $set = {}
  Object.entries(normalized).forEach(([key, value]) => {
    $set[`adminProfile.${key}`] = value
  })
  await siteSettingModel.findOneAndUpdate(
    { key: SETTING_KEY },
    { $set },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
  return normalized
}

export const patchAdminProfile = async (patch) => {
  const current = await getAdminProfileRecord()
  const merged = normalizeAdminProfile({ ...current, ...patch })
  const $set = Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [`adminProfile.${key}`, value])
  )
  await siteSettingModel.findOneAndUpdate(
    { key: SETTING_KEY },
    { $set },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
  return merged
}
