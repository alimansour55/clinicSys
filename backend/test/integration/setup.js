import { vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { loadTestEnv } from '../helpers/loadTestEnv.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../helpers/db.js'
import { seedDatabase } from './helpers/seed.js'

loadTestEnv()

vi.mock('../../config/nodemailer.js', () => ({
  default: { sendMail: vi.fn().mockResolvedValue({ messageId: 'test' }) },
}))

vi.mock('../../services/twilioVerifyService.js', () => ({
  isTwilioVerifyConfigured: vi.fn(() => false),
  startPhoneVerification: vi.fn(),
  checkPhoneVerification: vi.fn(),
}))

vi.mock('../../services/smsService.js', () => ({
  sendSms: vi.fn().mockResolvedValue({ devMode: true }),
  toE164: (p) => (String(p).startsWith('+') ? p : '+201012345678'),
}))

/** @type {import('express').Express} */
let app

beforeAll(async () => {
  await connectTestDatabase({ memory: true })
  const mod = await import('../../app.js')
  app = mod.default
}, 120_000)

afterAll(async () => {
  await disconnectTestDatabase()
}, 30_000)

beforeEach(async () => {
  await clearTestDatabase()
  await seedDatabase()
})

export function getApp() {
  if (!app) throw new Error('Integration app not initialized')
  return app
}
