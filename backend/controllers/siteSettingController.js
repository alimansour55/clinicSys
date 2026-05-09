import { v2 as cloudinary } from 'cloudinary'
import siteSettingModel from '../models/siteSettingModel.js'
import { logAudit } from '../services/auditService.js'

const SETTING_KEY = 'site-settings'

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

export { getPublicSiteSettings, updateHomeHeroSettings }
