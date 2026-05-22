import { resolveHeaderLogoUrl, resolveLogoAltText } from '../utils/siteSettingsBranding'
import { DEFAULT_APP_DISPLAY_NAME } from '../utils/appDisplayName'

/**
 * Header/footer logo: CMS image when set, otherwise Clinivo text (never legacy Prescripto SVG).
 */
export default function BrandLogo({ siteSettings, imgClassName, textClassName = 'text-lg font-bold tracking-tight text-primary sm:text-xl' }) {
  const src = resolveHeaderLogoUrl(siteSettings)
  const alt = resolveLogoAltText(siteSettings)

  if (src) {
    return <img src={src} alt={alt} className={imgClassName} />
  }

  return <span className={textClassName}>{DEFAULT_APP_DISPLAY_NAME}</span>
}
