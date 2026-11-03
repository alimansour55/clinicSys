import './config/env.js'
import express from 'express'
import cors from 'cors'
import connectDB, {
  MONGODB_URI_MISSING_MESSAGE,
  MONGODB_URI_MISSING_VERCEL_MESSAGE,
} from './config/mongodb.js'
import { getCorsOriginConfig } from './config/corsOrigins.js'
import adminRouter from './routes/adminRoute.js'
import doctorRouter from './routes/doctorRoute.js'
import userRouter from './routes/userRoute.js'
import accountRouter, { patientAuthRouter } from './routes/accountRoute.js'
import receptionistRouter from './routes/receptionistRoute.js'
import auditLogRouter from './routes/auditLogRoute.js'
import notificationRouter from './routes/notificationRoute.js'
import chatbotRouter from './routes/chatbotRoute.js'
import patientSessionGuard from './middlewares/patientSessionGuard.js'

/** Express app without listen/DB — used by server.js and integration tests. */
export function createApp() {
  const app = express()
  // One proxy (Vercel). With `true`, req.ip comes from a header the client controls, which would defeat rate limits.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    // API answers can hold health data, so they must not sit in a shared or browser cache.
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.use(express.json())
  app.use(cors({
    origin: getCorsOriginConfig(),
  }))
  app.use(async (req, res, next) => {
    if (!req.path.startsWith('/api')) return next()
    try {
      await connectDB()
      next()
    } catch (error) {
      console.error('Database middleware:', error.message)
      const message = [MONGODB_URI_MISSING_MESSAGE, MONGODB_URI_MISSING_VERCEL_MESSAGE].includes(
        error?.message
      )
        ? error.message
        : 'Database connection failed'
      res.status(503).json({ success: false, message })
    }
  })
  app.use((req, res, next) => {
    if (!req.body) req.body = {}
    next()
  })
  app.use('/api', patientSessionGuard)

  app.use('/api/admin', adminRouter)
  app.use('/api/doctor', doctorRouter)
  app.use('/api/user', patientAuthRouter)
  app.use('/api/user', userRouter)
  app.use('/api/account', accountRouter)
  app.use('/api/receptionist', receptionistRouter)
  app.use('/api/audit-logs', auditLogRouter)
  app.use('/api/notifications', notificationRouter)
  app.use('/api/chatbot', chatbotRouter)

  app.get('/', (req, res) => {
    res.send('API WORKING')
  })

  // Express would otherwise answer a malformed body with an HTML page that includes a stack trace.
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    const badRequest = error.type === 'entity.parse.failed' || error.type === 'entity.too.large' || error.name === 'MulterError'
    if (!badRequest) console.error('Unhandled API error:', error.message)
    res.status(badRequest ? 400 : 500).json({
      success: false,
      message: badRequest ? 'The request could not be read' : 'Something went wrong. Please try again.'
    })
  })

  return app
}

export default createApp()
