import Stripe from 'stripe'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null

export const stripeCurrency = (process.env.STRIPE_CURRENCY || 'egp').toLowerCase()

export default stripe
