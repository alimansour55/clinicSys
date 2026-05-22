/** Public-facing product name (emails, legacy footer migration). Override with PUBLIC_APP_BRAND in .env */
export const getPublicAppBrand = () => {
  const v = String(process.env.PUBLIC_APP_BRAND || process.env.APP_DISPLAY_NAME || '').trim()
  return v || 'Clinivo'
}
