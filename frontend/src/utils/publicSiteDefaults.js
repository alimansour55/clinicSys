import { DEFAULT_APP_DISPLAY_NAME } from './appDisplayName'

export const DEFAULT_FOOTER_DESCRIPTION =
  "Simplifying healthcare access through smart appointment management. Book your doctor, anytime, anywhere with Clinivo's intelligent scheduling system. No more long waits or booking hassles - just efficient, reliable, and patient-focused healthcare at your convenience."

/* Same shape as the server default: "Copyright 2026 © Clinivo - All Rights Reserved." */
/*
 * The server's old default address is on a domain the clinic does not own (the site is
 * clinivo.shop), so it counts as not set. No address is shown until an admin enters one.
 */
const PLACEHOLDER_EMAILS = new Set(['contact@clinivo.com'])

/** The contact email from footer settings, or '' when the admin has not set a real one. */
export const footerContactEmail = (footer) => {
  const email = String(footer?.email || '').trim()
  return email && !PLACEHOLDER_EMAILS.has(email.toLowerCase()) ? email : ''
}

export const DEFAULT_FOOTER_COPYRIGHT = `Copyright ${new Date().getFullYear()} © ${DEFAULT_APP_DISPLAY_NAME} - All Rights Reserved.`
