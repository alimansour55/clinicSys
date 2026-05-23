import './config/env.js'
import express from 'express'
import cors from 'cors'
import connectDB, { MONGODB_URI_MISSING_MESSAGE } from './config/mongodb.js'
import { getCorsOriginConfig } from './config/corsOrigins.js'
import adminRouter from './routes/adminRoute.js'
import doctorRouter from './routes/doctorRoute.js'
import userRouter from './routes/userRoute.js'
import receptionistRouter from './routes/receptionistRoute.js'
import auditLogRouter from './routes/auditLogRoute.js'
import notificationRouter from './routes/notificationRoute.js'
import chatbotRouter from './routes/chatbotRoute.js'

/** Express app without listen/DB — used by server.js and integration tests. */
export function createApp() {
  const app = express()
  app.set('trust proxy', true)
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
      const message =
        error?.message === MONGODB_URI_MISSING_MESSAGE
          ? error.message
          : 'Database connection failed'
      res.status(503).json({ success: false, message })
    }
  })
  app.use((req, res, next) => {
    if (!req.body) req.body = {}
    next()
  })

  app.use('/api/admin', adminRouter)
  app.use('/api/doctor', doctorRouter)
  app.use('/api/user', userRouter)
  app.use('/api/receptionist', receptionistRouter)
  app.use('/api/audit-logs', auditLogRouter)
  app.use('/api/notifications', notificationRouter)
  app.use('/api/chatbot', chatbotRouter)

  app.get('/', (req, res) => {
    res.send('API WORKING')
  })

  return app
}

export default createApp()
