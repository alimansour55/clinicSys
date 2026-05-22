import nodemailer from 'nodemailer'
import { isMicrosoftOAuthConfigured } from '../services/microsoftOAuthService.js'

const user = process.env.SENDER_EMAIL
const pass = process.env.APP_PASSWORD

const isHotmail =
  process.env.EMAIL_SERVICE === 'hotmail' || process.env.EMAIL_SERVICE === 'outlook'

/** SMTP send (not IMAP). Outlook.com / Hotmail with OAuth2 uses this host. */
const microsoftSmtpHost = process.env.MICROSOFT_SMTP_HOST || 'smtp-mail.outlook.com'
const microsoftSmtpPort = Number(process.env.MICROSOFT_SMTP_PORT) || 587

let transporter

if (isMicrosoftOAuthConfigured()) {
  const tenant = process.env.MICROSOFT_TENANT || 'common'
  transporter = nodemailer.createTransport({
    host: microsoftSmtpHost,
    port: microsoftSmtpPort,
    secure: false,
    requireTLS: true,
    auth: {
      type: 'OAuth2',
      user,
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || undefined,
      refreshToken: process.env.MICROSOFT_REFRESH_TOKEN,
      accessUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`
    }
  })
} else if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: true,
    auth: { user, pass }
  })
} else if (isHotmail) {
  transporter = nodemailer.createTransport({
    host: microsoftSmtpHost,
    port: microsoftSmtpPort,
    secure: false,
    requireTLS: true,
    auth: { user, pass }
  })
} else {
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: { user, pass }
  })
}

export default transporter
