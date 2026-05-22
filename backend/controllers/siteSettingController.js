import { v2 as cloudinary } from 'cloudinary'
import siteSettingModel from '../models/siteSettingModel.js'
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
  phoneNumber: '+92 343 2705821',
  emailLabel: 'Email',
  email: 'marqum987@gmail.com',
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

const getPublicSiteSettings = async (req, res) => {
  try {
    const settings = await getSettingsDocument()
    const payload = settings.toObject ? settings.toObject() : { ...settings }
    sanitizeLegacyPrescriptoInPayload(payload)
    payload.homeVisitPricing = normalizeHomeVisitPricing(payload.homeVisitPricing)
    payload.globalVisitFees = normalizeGlobalVisitFees(payload.globalVisitFees)
    payload.insuranceProviders = await getResolvedInsuranceProviders()
    payload.languagePolicies = normalizeLanguagePolicies(payload.languagePolicies, payload.languageAvailability)
    res.json({ success: true, settings: payload })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const listInsuranceProviders = async (req, res) => {
  try {
    const providers = await getResolvedInsuranceProviders()
    res.json({ success: true, providers })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

const normalizeInsuranceProvidersBody = (body) => {
  let list = body?.providers
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list)
    } catch {
      list = []
    }
  }
  if (!Array.isArray(list)) list = []
  return [...new Set(list.map((p) => String(p || '').trim()).filter(Boolean))]
}

const updateInsuranceProviders = async (req, res) => {
  try {
    const next = normalizeInsuranceProvidersBody(req.body || {})
    if (next.length < 1) {
      return res.json({ success: false, message: 'At least one insurance provider is required' })
    }

    const settings = await siteSettingModel.findOneAndUpdate(
      { key: SETTING_KEY },
      { $set: { insuranceProviders: next } },
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

    const payload = settings.toObject ? settings.toObject() : { ...settings }
    payload.insuranceProviders = await getResolvedInsuranceProviders()
    res.json({ success: true, message: 'Insurance providers updated', settings: payload })
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

const updateHomeHeroSettings = async (req, res) => {
  try {
    const currentSettings = await getSettingsDocument()
    const currentHero = currentSettings.homeHero || {}
    const filesByField = Object.entries(req.files || {}).reduce((acc, [fieldName, files]) => {
      acc[fieldName] = files?.[0]
      return acc
    }, {})

    const nextHero = {
      title: req.body.title?.trim() || currentHero.title,
      subtitle: req.body.subtitle?.trim() || currentHero.subtitle,
      backgroundColor: req.body.backgroundColor?.trim() || currentHero.backgroundColor,
      showGroupImage: booleanFromBody(req.body.showGroupImage, currentHero.showGroupImage),
      showBookButton: booleanFromBody(req.body.showBookButton, currentHero.showBookButton),
      bookButtonText: req.body.bookButtonText?.trim() || currentHero.bookButtonText,
      showAppointmentsButton: booleanFromBody(req.body.showAppointmentsButton, currentHero.showAppointmentsButton),
      appointmentsButtonText: req.body.appointmentsButtonText?.trim() || currentHero.appointmentsButtonText,
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

    res.json({ success: true, message: 'Home hero settings updated', settings })
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

    const nextBanner = {
      title: req.body.title?.trim() || currentBanner.title || fallbackTitle,
      backgroundColor: req.body.backgroundColor?.trim() || currentBanner.backgroundColor,
      showImage: booleanFromBody(req.body.showImage, currentBanner.showImage),
      showAppointmentsButton: booleanFromBody(req.body.showAppointmentsButton, currentBanner.showAppointmentsButton),
      appointmentsButtonText: req.body.appointmentsButtonText?.trim() || currentBanner.appointmentsButtonText,
      showProfileButton: booleanFromBody(req.body.showProfileButton, currentBanner.showProfileButton),
      profileButtonText: req.body.profileButtonText?.trim() || currentBanner.profileButtonText,
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

    res.json({ success: true, message: 'Home banner settings updated', settings })
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

    const nextCards = {
      teleconsultationTitle: req.body.teleconsultationTitle?.trim() || currentCards.teleconsultationTitle,
      teleconsultationDescription: req.body.teleconsultationDescription?.trim() || currentCards.teleconsultationDescription,
      teleconsultationButtonText: req.body.teleconsultationButtonText?.trim() || currentCards.teleconsultationButtonText,
      showTeleconsultation: booleanFromBody(req.body.showTeleconsultation, currentCards.showTeleconsultation),
      teleconsultationImage: currentCards.teleconsultationImage,
      homeVisitTitle: req.body.homeVisitTitle?.trim() || currentCards.homeVisitTitle,
      homeVisitDescription: req.body.homeVisitDescription?.trim() || currentCards.homeVisitDescription,
      homeVisitButtonText: req.body.homeVisitButtonText?.trim() || currentCards.homeVisitButtonText,
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

    res.json({ success: true, message: 'Home service cards updated', settings })
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

    const textFields = [
      'description',
      'companyTitle',
      'contactTitle',
      'homeLabel',
      'aboutLabel',
      'doctorsLabel',
      'contactLabel',
      'appointmentsLabel',
      'profileLabel',
      'privacyLabel',
      'phoneLabel',
      'phoneNumber',
      'emailLabel',
      'email',
      'copyrightText'
    ]

    const booleanFields = [
      'showHomeLink',
      'showAboutLink',
      'showDoctorsLink',
      'showContactLink',
      'showPatientLinks',
      'showPrivacyLink'
    ]

    const nextFooter = {}
    textFields.forEach((field) => {
      nextFooter[field] = req.body[field]?.trim() || currentFooter[field]
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

    res.json({ success: true, message: 'Footer settings updated', settings })
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

    const settingsPlain = settings.toObject ? settings.toObject({ flattenMaps: true }) : { ...settings }
    res.json({ success: true, message: 'Site logo updated', settings: settingsPlain })
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

    const payload = settings.toObject ? settings.toObject() : { ...settings }
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

    const payload = settings.toObject ? settings.toObject() : { ...settings }
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

    const payload = settings.toObject ? settings.toObject() : { ...settings }
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
    const nextSecurity = normalizeSecuritySettings({ ...currentSecurity, ...(req.body || {}) })

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

    res.json({ success: true, message: 'Security settings updated', settings, purgeResult })
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
