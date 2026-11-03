import { v2 as cloudinary } from 'cloudinary'
import siteSettingModel, {
  footerBilingualFields,
  homeBannerBilingualFields,
  homeHeroBilingualFields,
  homeServiceCardsBilingualFields
} from '../models/siteSettingModel.js'
import { primaryOf, resolveBilingualFields, resolveBilingualValue } from '../services/bilingualContentService.js'
import { logAudit } from '../services/auditService.js'
import { normalizeSecuritySettings, purgeExpiredAuditLogs } from '../services/securityPolicyService.js'
import { getResolvedInsuranceProviders } from '../services/insuranceProvidersService.js'
import { normalizeHomeVisitPricing } from '../services/homeVisitPricingService.js'
import { normalizeGlobalVisitFees } from '../services/globalVisitFeesService.js'
import { getPublicAppBrand } from '../config/publicBrand.js'
import { normalizeLanguagePolicies } from '../utils/languageAvailability.js'

const SETTING_KEY = 'site-settings'

const defaultCopyrightLine = () => {
  const brand = getPublicAppBrand()
  return `Copyright ${new Date().getFullYear()} © ${brand} - All Rights Reserved.`
}

const DEFAULT_FOOTER = {
  description:
    "Simplifying healthcare access through smart appointment management. Book your doctor, anytime, anywhere with our intelligent scheduling system. No more long waits or booking hassles - just efficient, reliable, and patient-focused healthcare at your convenience.",
  companyTitle: 'Company',
  contactTitle: 'Get in touch',
  homeLabel: 'Home',
  aboutLabel: 'About',
  doctorsLabel: 'All doctors',
  contactLabel: 'Contact us',
  appointmentsLabel: 'My appointments',
  profileLabel: 'My profile',
  privacyLabel: 'Privacy Policy',
  phoneLabel: 'Phone',
  phoneNumber: '+20 101 881 1142',
  emailLabel: 'Email',
  email: 'contact@clinivo.com',
  copyrightText: defaultCopyrightLine(),
  showHomeLink: true,
  showAboutLink: true,
  showDoctorsLink: true,
  showContactLink: true,
  showPatientLinks: true,
  showPrivacyLink: true
}

const booleanFromBody = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  return value === 'true' || value === '1' || value === 'on'
}

const getSettingsDocument = async () => {
  const settings = await siteSettingModel.findOne({ key: SETTING_KEY })
  if (settings) return settings

  return siteSettingModel.create({ key: SETTING_KEY })
}

/** Replace legacy template branding in API responses (does not write to DB). */
const sanitizeLegacyPrescriptoInPayload = (payload) => {
  const brand = getPublicAppBrand()
  const year = new Date().getFullYear()
  const copyrightLine = `Copyright ${year} © ${brand} - All Rights Reserved.`

  if (payload.footer && typeof payload.footer === 'object') {
    const f = payload.footer
    if (f.copyrightText && /prescripto/i.test(String(f.copyrightText))) {
      f.copyrightText = copyrightLine
    }
    if (f.description && /prescripto/i.test(String(f.description))) {
      const b = brand
      f.description = String(f.description)
        .replace(/Prescripto's/gi, `${b}'s`)
        .replace(/Prescripto/gi, b)
    }
  }
  if (payload.branding && typeof payload.branding === 'object') {
    const alt = String(payload.branding.altText || '').trim()
    if (/^prescripto$/i.test(alt)) payload.branding.altText = brand
  }
}

const plainSettings = (settings) => (settings.toObject ? settings.toObject({ flattenMaps: true }) : { ...settings })

/** The MFA secret is only ever read on the server. An admin's own screens do not need it either. */
const forAdmin = (settings) => {
  const payload = plainSettings(settings)
  if (payload.security?.adminMfa) delete payload.security.adminMfa.secret
  return payload
}

/** One entry per active provider, in order: `{ name, en, ar, status }`. Built-in defaults have no stored text. */
const providerLabels = (names, stored = []) => {
  const list = Array.isArray(stored) ? stored : []
  return names.map((name) => {
    const match = list.find((item) => item?.en === name || item?.ar === name)
    return { name, en: match?.en || name, ar: match?.ar || '', source: match?.source || 'en', manual: match?.manual === true, status: match?.status === 'pending' ? 'pending' : 'complete' }
  })
}

const buildSettingsPayload = async (payload) => {
  sanitizeLegacyPrescriptoInPayload(payload)
  payload.homeVisitPricing = normalizeHomeVisitPricing(payload.homeVisitPricing)
  payload.globalVisitFees = normalizeGlobalVisitFees(payload.globalVisitFees)
  payload.insuranceProviders = await getResolvedInsuranceProviders()
  payload.insuranceProvidersI18n = providerLabels(payload.insuranceProviders, payload.insuranceProvidersI18n)
  payload.languagePolicies = normalizeLanguagePolicies(payload.languagePolicies, payload.languageAvailability)
  return payload
}

/** Anyone can read this route, so it must not carry security policy or the admin's own details. */
const getPublicSiteSettings = async (req, res) => {
  try {
    const settings = await getSettingsDocument()
    const payload = await buildSettingsPayload(plainSettings(settings))
    delete payload.security
    delete payload.adminProfile
    res.json({ success: true, settings: payload })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const getAdminSiteSettings = async (req, res) => {
  try {
    const settings = await getSettingsDocument()
    res.json({ success: true, settings: await buildSettingsPayload(forAdmin(settings)) })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const listInsuranceProviders = async (req, res) => {
  try {
    const providers = await getResolvedInsuranceProviders()
    const settings = await siteSettingModel.findOne({ key: SETTING_KEY }).select('insuranceProvidersI18n').lean()
    res.json({ success: true, providers, providersI18n: providerLabels(providers, settings?.insuranceProvidersI18n) })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const parseJsonList = (value) => {
  let list = value
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list)
    } catch {
      list = []
    }
  }
  return Array.isArray(list) ? list : []
}

const providerText = (row) => (typeof row === 'string' ? row.trim() : String(row?.en || row?.ar || '').trim())

/** `providersI18n` from the form, or the older `providers` list of plain names. */
const readInsuranceProviderInputs = (body = {}) => {
  const seen = new Set()
  return parseJsonList(body.providersI18n ?? body.providers).filter((row) => {
    const text = providerText(row)
    if (!text || seen.has(text)) return false
    seen.add(text)
    return true
  })
}

const updateInsuranceProviders = async (req, res) => {
  try {
    const inputs = readInsuranceProviderInputs(req.body || {})
    if (inputs.length < 1) {
      return res.json({ success: false, message: 'At least one insurance provider is required' })
    }

    const current = await getSettingsDocument()
    const stored = plainSettings(current).insuranceProvidersI18n || []
    const previousFor = (input) => stored.find((item) => item?.en === providerText(input) || item?.ar === providerText(input))
    const values = await Promise.all(
      inputs.map((input) => resolveBilingualValue({ previous: previousFor(input), input, kind: 'label' }))
    )
    const next = values.map(primaryOf)

    const settings = await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { insuranceProviders: next, insuranceProvidersI18n: values } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    await logAudit({
      action: 'insurance_providers_update',
      status: 'success',
      entityType: 'site_settings',
      entityId: settings._id,
      metadata: { count: next.length },
      req
    })

    res.json({ success: true, message: 'Insurance providers updated', settings: await buildSettingsPayload(forAdmin(settings)) })
  } catch (error) {
    console.log(error)
    await logAudit({
      action: 'insurance_providers_update',
      status: 'failed',
      reason: error.message,
      entityType: 'site_settings',
      req
    })
    res.json({ success: false, message: error.message })
  }
}

/**
 * Both languages for one section's text. A box left empty keeps what was saved, as before.
 * `plain` holds the old plain fields, `stored` what goes under `<section>.i18n`.
 */
const resolveSectionText = async (section, fields, body) => {
  const current = section?.toObject?.() || section || {}
  const previous = current.i18n || {}
  const resolved = await resolveBilingualFields({ previous, fields, body, keepBlank: true })
  const stored = { ...previous, ...resolved }
  const plain = Object.fromEntries(
    Object.keys(fields).map((field) => [field, resolved[field] ? primaryOf(resolved[field]) : current[field]])
  )
  return { plain, stored }
}

const updateHomeHeroSettings = async (req, res) => {
  try {
    const currentSettings = await getSettingsDocument()
    const currentHero = currentSettings.homeHero || {}
    const filesByField = Object.entries(req.files || {}).reduce((acc, [fieldName, files]) => {
      acc[fieldName] = files?.[0]
      return acc
    }, {})

    const text = await resolveSectionText(currentHero, homeHeroBilingualFields, req.body)

    const nextHero = {
      ...text.plain,
      i18n: text.stored,
      backgroundColor: req.body.backgroundColor?.trim() || currentHero.backgroundColor,
      showGroupImage: booleanFromBody(req.body.showGroupImage, currentHero.showGroupImage),
      showBookButton: booleanFromBody(req.body.showBookButton, currentHero.showBookButton),
      showAppointmentsButton: booleanFromBody(req.body.showAppointmentsButton, currentHero.showAppointmentsButton),
      heroImage: currentHero.heroImage,
      groupImage: currentHero.groupImage
    }

    if (filesByField.heroImage) {
      const upload = await cloudinary.uploader.upload(filesByField.heroImage.path, { resource_type: 'image' })
      nextHero.heroImage = upload.secure_url
    }

    if (filesByField.groupImage) {
      const upload = await cloudinary.uploader.upload(filesByField.groupImage.path, { resource_type: 'image' })
      nextHero.groupImage = upload.secure_url
    }

    const settings = await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { homeHero: nextHero } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    await logAudit({
      action: 'site_home_hero_update',
      status: 'success',
      entityType: 'site_settings',
      entityId: settings._id,
      metadata: {
        changedFields: Object.keys(nextHero)
      },
      req
    })

    res.json({ success: true, message: 'Home hero settings updated', settings: forAdmin(settings) })
  } catch (error) {
    console.log(error)
    await logAudit({
      action: 'site_home_hero_update',
      status: 'failed',
      reason: error.message,
      entityType: 'site_settings',
      req
    })
    res.json({ success: false, message: error.message })
  }
}

const updateHomeBannerSettings = async (req, res) => {
  try {
    const currentSettings = await getSettingsDocument()
    const currentBanner = currentSettings.homeBanner || {}
    const bannerImageFile = req.files?.bannerImage?.[0]
    const fallbackTitle = [currentBanner.titleLineOne, currentBanner.titleLineTwo].filter(Boolean).join('\n')

    const text = await resolveSectionText(currentBanner, homeBannerBilingualFields, req.body)

    const nextBanner = {
      ...text.plain,
      title: text.plain.title || fallbackTitle,
      i18n: text.stored,
      backgroundColor: req.body.backgroundColor?.trim() || currentBanner.backgroundColor,
      showImage: booleanFromBody(req.body.showImage, currentBanner.showImage),
      showAppointmentsButton: booleanFromBody(req.body.showAppointmentsButton, currentBanner.showAppointmentsButton),
      showProfileButton: booleanFromBody(req.body.showProfileButton, currentBanner.showProfileButton),
      bannerImage: currentBanner.bannerImage
    }

    if (bannerImageFile) {
      const upload = await cloudinary.uploader.upload(bannerImageFile.path, { resource_type: 'image' })
      nextBanner.bannerImage = upload.secure_url
    }

    const settings = await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { homeBanner: nextBanner } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    await logAudit({
      action: 'site_home_banner_update',
      status: 'success',
      entityType: 'site_settings',
      entityId: settings._id,
      metadata: {
        changedFields: Object.keys(nextBanner)
      },
      req
    })

    res.json({ success: true, message: 'Home banner settings updated', settings: forAdmin(settings) })
  } catch (error) {
    console.log(error)
    await logAudit({
      action: 'site_home_banner_update',
      status: 'failed',
      reason: error.message,
      entityType: 'site_settings',
      req
    })
    res.json({ success: false, message: error.message })
  }
}

const updateHomeServiceCardsSettings = async (req, res) => {
  try {
    const currentSettings = await getSettingsDocument()
    const currentCards = currentSettings.homeServiceCards || {}
    const filesByField = Object.entries(req.files || {}).reduce((acc, [fieldName, files]) => {
      acc[fieldName] = files?.[0]
      return acc
    }, {})

    const text = await resolveSectionText(currentCards, homeServiceCardsBilingualFields, req.body)

    const nextCards = {
      ...text.plain,
      i18n: text.stored,
      showTeleconsultation: booleanFromBody(req.body.showTeleconsultation, currentCards.showTeleconsultation),
      teleconsultationImage: currentCards.teleconsultationImage,
      showHomeVisit: booleanFromBody(req.body.showHomeVisit, currentCards.showHomeVisit),
      homeVisitImage: currentCards.homeVisitImage
    }

    if (filesByField.teleconsultationImage) {
      const upload = await cloudinary.uploader.upload(filesByField.teleconsultationImage.path, { resource_type: 'image' })
      nextCards.teleconsultationImage = upload.secure_url
    }

    if (filesByField.homeVisitImage) {
      const upload = await cloudinary.uploader.upload(filesByField.homeVisitImage.path, { resource_type: 'image' })
      nextCards.homeVisitImage = upload.secure_url
    }

    const settings = await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { homeServiceCards: nextCards } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    await logAudit({
      action: 'site_home_service_cards_update',
      status: 'success',
      entityType: 'site_settings',
      entityId: settings._id,
      metadata: { changedFields: Object.keys(nextCards) },
      req
    })

    res.json({ success: true, message: 'Home service cards updated', settings: forAdmin(settings) })
  } catch (error) {
    console.log(error)
    await logAudit({
      action: 'site_home_service_cards_update',
      status: 'failed',
      reason: error.message,
      entityType: 'site_settings',
      req
    })
    res.json({ success: false, message: error.message })
  }
}

const updateFooterSettings = async (req, res) => {
  try {
    const currentSettings = await getSettingsDocument()
    const currentFooter = { ...DEFAULT_FOOTER, ...(currentSettings.footer?.toObject?.() || currentSettings.footer || {}) }

    /* A phone number and an email address read the same in both languages */
    const untranslatedFields = ['phoneNumber', 'email']

    const booleanFields = [
      'showHomeLink',
      'showAboutLink',
      'showDoctorsLink',
      'showContactLink',
      'showPatientLinks',
      'showPrivacyLink'
    ]

    const text = await resolveSectionText(currentFooter, footerBilingualFields, req.body)
    const nextFooter = { ...text.plain, i18n: text.stored }
    untranslatedFields.forEach((field) => {
      const value = req.body[field]
      nextFooter[field] = (typeof value === 'string' && value.trim()) || currentFooter[field]
    })
    booleanFields.forEach((field) => {
      nextFooter[field] = booleanFromBody(req.body[field], currentFooter[field])
    })

    const settings = await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { footer: nextFooter } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    await logAudit({
      action: 'site_footer_update',
      status: 'success',
      entityType: 'site_settings',
      entityId: settings._id,
      metadata: {
        changedFields: Object.keys(nextFooter)
      },
      req
    })

    res.json({ success: true, message: 'Footer settings updated', settings: forAdmin(settings) })
  } catch (error) {
    console.log(error)
    await logAudit({
      action: 'site_footer_update',
      status: 'failed',
      reason: error.message,
      entityType: 'site_settings',
      req
    })
    res.json({ success: false, message: error.message })
  }
}

const updateBrandingLogo = async (req, res) => {
  try {
    const currentSettings = await getSettingsDocument()
    const current = currentSettings.branding?.toObject?.() || currentSettings.branding || {}
    let headerLogoUrl = String(current.headerLogoUrl || '').trim()

    if (booleanFromBody(req.body.clearHeaderLogo, false)) {
      headerLogoUrl = ''
    } else if (req.file) {
      const upload = await cloudinary.uploader.upload(req.file.path, { resource_type: 'image' })
      headerLogoUrl = upload.secure_url
    }

    const defaultBrand = getPublicAppBrand()
    const altText = String(req.body.altText ?? current.altText ?? defaultBrand).trim() || defaultBrand

    const nextBranding = { headerLogoUrl, altText, logoMaxWidthPx: 0, logoMaxHeightPx: 0 }

    const settings = await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { branding: nextBranding } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    await logAudit({
      action: 'site_branding_update',
      status: 'success',
      entityType: 'site_settings',
      entityId: settings._id,
      metadata: {
        clearedLogo: booleanFromBody(req.body.clearHeaderLogo, false),
        uploadedLogo: Boolean(req.file)
      },
      req
    })

    res.json({ success: true, message: 'Site logo updated', settings: forAdmin(settings) })
  } catch (error) {
    console.log(error)
    await logAudit({
      action: 'site_branding_update',
      status: 'failed',
      reason: error.message,
      entityType: 'site_settings',
      req
    })
    res.json({ success: false, message: error.message })
  }
}

const updateGlobalVisitFeesSettings = async (req, res) => {
  try {
    const body = req.body || {}
    const next = normalizeGlobalVisitFees({
      enabled: booleanFromBody(body.enabled, false),
      examinationFee: body.examinationFee,
      consultationFee: body.consultationFee
    })

    if (next.enabled) {
      if (next.examinationFee <= 0) {
        return res.json({ success: false, message: 'Examination fee must be greater than zero when global fees are enabled' })
      }
      if (next.consultationFee <= 0) {
        return res.json({ success: false, message: 'Follow-up consultation fee must be greater than zero when global fees are enabled' })
      }
      if (next.consultationFee >= next.examinationFee) {
        return res.json({
          success: false,
          message: 'Follow-up consultation fee must be lower than the examination fee'
        })
      }
    }

    const settings = await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { globalVisitFees: next } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    await logAudit({
      action: 'global_visit_fees_update',
      status: 'success',
      entityType: 'site_settings',
      entityId: settings._id,
      metadata: { globalVisitFees: next },
      req
    })

    const payload = forAdmin(settings)
    payload.globalVisitFees = normalizeGlobalVisitFees(payload.globalVisitFees)
    payload.homeVisitPricing = normalizeHomeVisitPricing(payload.homeVisitPricing)

    res.json({ success: true, message: 'Global visit fees updated', settings: payload })
  } catch (error) {
    console.log(error)
    await logAudit({
      action: 'global_visit_fees_update',
      status: 'failed',
      reason: error.message,
      entityType: 'site_settings',
      req
    })
    res.json({ success: false, message: error.message })
  }
}

const updateHomeVisitPricingSettings = async (req, res) => {
  try {
    const body = req.body || {}
    const next = normalizeHomeVisitPricing({
      pricingType: body.pricingType,
      percentageValue: body.percentageValue,
      fixedAmount: body.fixedAmount
    })

    if (next.pricingType === 'fixed' && next.fixedAmount <= 0) {
      return res.json({ success: false, message: 'Fixed home visit amount must be greater than zero' })
    }

    const settings = await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { homeVisitPricing: next } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    await logAudit({
      action: 'home_visit_pricing_update',
      status: 'success',
      entityType: 'site_settings',
      entityId: settings._id,
      metadata: { homeVisitPricing: next },
      req
    })

    const payload = forAdmin(settings)
    payload.homeVisitPricing = normalizeHomeVisitPricing(payload.homeVisitPricing)

    res.json({ success: true, message: 'Home visit pricing updated', settings: payload })
  } catch (error) {
    console.log(error)
    await logAudit({
      action: 'home_visit_pricing_update',
      status: 'failed',
      reason: error.message,
      entityType: 'site_settings',
      req
    })
    res.json({ success: false, message: error.message })
  }
}

const updateLanguagePoliciesSettings = async (req, res) => {
  try {
    const current = await getSettingsDocument()
    const legacy = current?.languageAvailability
    const languagePolicies = normalizeLanguagePolicies(req.body?.languagePolicies, legacy)

    const settings = await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { languagePolicies } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    await logAudit({
      action: 'language_policies_update',
      status: 'success',
      entityType: 'site_settings',
      entityId: settings._id,
      metadata: { languagePolicies },
      req
    })

    const payload = forAdmin(settings)
    payload.languagePolicies = normalizeLanguagePolicies(payload.languagePolicies, payload.languageAvailability)
    res.json({ success: true, message: 'Language settings updated', settings: payload })
  } catch (error) {
    console.log(error)
    await logAudit({
      action: 'language_policies_update',
      status: 'failed',
      reason: error.message,
      entityType: 'site_settings',
      req
    })
    res.json({ success: false, message: error.message })
  }
}

const updateSecuritySettings = async (req, res) => {
  try {
    const currentSettings = await getSettingsDocument()
    const currentSecurity = currentSettings.security?.toObject?.() || currentSettings.security || {}
    /* The admin's MFA has its own routes. A settings form must never be able to replace the secret. */
    const { adminMfa: _ignoredAdminMfa, ...incoming } = req.body || {}
    const nextSecurity = normalizeSecuritySettings({ ...currentSecurity, ...incoming })

    const settings = await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { security: nextSecurity } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    const purgeResult = await purgeExpiredAuditLogs()

    await logAudit({
      action: 'security_settings_update',
      status: 'success',
      entityType: 'site_settings',
      entityId: settings._id,
      metadata: {
        changedFields: Object.keys(nextSecurity),
        auditRetentionDays: nextSecurity.auditLogRetentionDays,
        dataRetentionDays: nextSecurity.dataRetentionDays,
        purgedAuditLogs: purgeResult.deletedCount
      },
      req
    })

    res.json({ success: true, message: 'Security settings updated', settings: forAdmin(settings), purgeResult })
  } catch (error) {
    console.log(error)
    await logAudit({
      action: 'security_settings_update',
      status: 'failed',
      reason: error.message,
      entityType: 'site_settings',
      req
    })
    res.json({ success: false, message: error.message })
  }
}

export {
  getPublicSiteSettings,
  getAdminSiteSettings,
  listInsuranceProviders,
  updateInsuranceProviders,
  updateHomeHeroSettings,
  updateHomeBannerSettings,
  updateHomeServiceCardsSettings,
  updateFooterSettings,
  updateBrandingLogo,
  updateLanguagePoliciesSettings,
  updateSecuritySettings,
  updateHomeVisitPricingSettings,
  updateGlobalVisitFeesSettings
}
