import '../config/env.js'
import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null

export const stripeCurrency = (process.env.STRIPE_CURRENCY || 'egp').toLowerCase()

export default stripe
