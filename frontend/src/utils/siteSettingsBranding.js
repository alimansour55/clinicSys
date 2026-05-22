import { DEFAULT_APP_DISPLAY_NAME } from './appDisplayName'

const LEGACY_BRAND_RE = /prescripto/i

export function isLegacyPrescriptoBranding(value) {
  return LEGACY_BRAND_RE.test(String(value || ''))
}

/** Strip old template branding so cached settings never flash Prescripto. */
export function sanitizeLegacyBrandingInSiteSettings(settings) {
  if (!settings || typeof settings !== 'object') return settings

  const next = { ...settings }
  if (next.branding && typeof next.branding === 'object') {
    const branding = { ...next.branding }
    const alt = String(branding.altText || '').trim()
    const headerUrl = String(branding.headerLogoUrl || '').trim()
    const logoUrl = String(branding.logoUrl || '').trim()

    if (isLegacyPrescriptoBranding(alt)) {
      branding.altText = DEFAULT_APP_DISPLAY_NAME
    }
    if (isLegacyPrescriptoBranding(headerUrl)) {
      delete branding.headerLogoUrl
    }
    if (isLegacyPrescriptoBranding(logoUrl)) {
      delete branding.logoUrl
    }
    next.branding = branding
  }

  if (next.footer && typeof next.footer === 'object') {
    const footer = { ...next.footer }
    if (isLegacyPrescriptoBranding(footer.copyrightText)) {
      footer.copyrightText = `Copyright ${new Date().getFullYear()} © ${DEFAULT_APP_DISPLAY_NAME} - All Rights Reserved.`
    }
    if (isLegacyPrescriptoBranding(footer.description)) {
      footer.description = footer.description
        .replace(/Prescripto's/gi, `${DEFAULT_APP_DISPLAY_NAME}'s`)
        .replace(/Prescripto/gi, DEFAULT_APP_DISPLAY_NAME)
    }
    next.footer = footer
  }

  return next
}

/** CMS header logo URL, or null to use in-app Clinivo text mark (never legacy Prescripto SVG). */
export function resolveHeaderLogoUrl(siteSettings) {
  const url = String(siteSettings?.branding?.headerLogoUrl || '').trim()
  if (!url || isLegacyPrescriptoBranding(url)) return null
  return url
}

export function resolveLogoAltText(siteSettings) {
  const alt = String(siteSettings?.branding?.altText || '').trim()
  if (!alt || isLegacyPrescriptoBranding(alt)) return DEFAULT_APP_DISPLAY_NAME
  return alt
}
