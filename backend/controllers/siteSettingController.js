import { v2 as cloudinary } from 'cloudinary'
import siteSettingModel from '../models/siteSettingModel.js'
import { logAudit } from '../services/auditService.js'

const SETTING_KEY = 'site-settings'

const DEFAULT_FOOTER = {
  description: "Simplifying healthcare access through smart appointment management. Book your doctor, anytime, anywhere with Prescripto's intelligent scheduling system. No more long waits or booking hassles - just efficient, reliable, and patient-focused healthcare at your convenience.",
  companyTitle: 'COMPANY',
  contactTitle: 'GET IN TOUCH',
  homeLabel: 'Home',
  aboutLabel: 'About',
  doctorsLabel: 'All Doctors',
  contactLabel: 'Contact Us',
  appointmentsLabel: 'My Appointments',
  profileLabel: 'My Profile',
  privacyLabel: 'Privacy Policy',
  phoneLabel: 'Phone',
  phoneNumber: '+92 343 2705821',
  emailLabel: 'Email',
  email: 'marqum987@gmail.com',
  copyrightText: 'Copyright 2026 © Prescripto - All Rights Reserved.',
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

const getPublicSiteSettings = async (req, res) => {
  try {
    const settings = await getSettingsDocument()
    res.json({ success: true, settings })
  } catch (error) {
    console.log(error)
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

export { getPublicSiteSettings, updateHomeHeroSettings, updateHomeBannerSettings, updateHomeServiceCardsSettings, updateFooterSettings }
