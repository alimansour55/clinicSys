import { useEffect } from 'react'
import { DEFAULT_APP_DISPLAY_NAME } from '../../utils/appDisplayName'

const upsert = (selector, create, attrs) => {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value))
  return el
}

const meta = (key, content, attr = 'name') => {
  if (!content) {
    document.head.querySelector(`meta[${attr}="${key}"]`)?.remove()
    return
  }
  upsert(`meta[${attr}="${key}"]`, () => {
    const el = document.createElement('meta')
    el.setAttribute(attr, key)
    return el
  }, { content })
}

/** Absolute URL for the current origin, so canonical and share links follow the deployment. */
export const absoluteUrl = (path = '/') =>
  /^https?:\/\//.test(path) ? path : `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`

/**
 * Title, description, canonical, Open Graph and structured data for one page.
 * Crawlers that run JavaScript (Google) read these. Link previews in chat apps read
 * index.html instead, which is why the static defaults there matter too.
 */
export function applyPageMeta({ title, description, path, image, type = 'website', noindex = false, jsonLd = null, language = 'en' }) {
  const brand = DEFAULT_APP_DISPLAY_NAME
  const fullTitle = title && title !== brand ? `${title} · ${brand}` : brand
  const url = absoluteUrl(path ?? window.location.pathname)
  document.title = fullTitle
  meta('description', description)
  meta('robots', noindex ? 'noindex, nofollow' : 'index, follow')
  meta('og:title', fullTitle, 'property')
  meta('og:description', description, 'property')
  meta('og:type', type, 'property')
  meta('og:url', url, 'property')
  meta('og:site_name', brand, 'property')
  meta('og:locale', language === 'ar' ? 'ar_EG' : 'en_US', 'property')
  const shareImage = image ? absoluteUrl(image) : absoluteUrl('/og-image.png')
  meta('og:image', shareImage, 'property')
  meta('twitter:card', 'summary_large_image')
  meta('twitter:image', shareImage)
  meta('twitter:title', fullTitle)
  meta('twitter:description', description)
  upsert('link[rel="canonical"]', () => {
    const el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    return el
  }, { href: url })

  const existing = document.getElementById('page-jsonld')
  if (!jsonLd) {
    existing?.remove()
    return
  }
  const script = existing || Object.assign(document.createElement('script'), { id: 'page-jsonld', type: 'application/ld+json' })
  script.textContent = JSON.stringify(jsonLd)
  if (!existing) document.head.appendChild(script)
}

export function usePageMeta(options) {
  const key = JSON.stringify(options)
  useEffect(() => {
    applyPageMeta(JSON.parse(key))
  }, [key])
}
