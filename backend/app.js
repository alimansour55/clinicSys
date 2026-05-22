import express from 'express'
import cors from 'cors'
import adminRouter from './routes/adminRoute.js'
import doctorRouter from './routes/doctorRoute.js'
import userRouter from './routes/userRoute.js'
import receptionistRouter from './routes/receptionistRoute.js'
import auditLogRouter from './routes/auditLogRoute.js'
import notificationRouter from './routes/notificationRoute.js'

/** Express app without listen/DB — used by server.js and integration tests. */
export function createApp() {
  const app = express()
  app.set('trust proxy', true)
  app.use(express.json())
  app.use(cors({
    origin: ['*',"https://clinic-sys-m878.vercel.app","https://admin-zeta-one-45.vercel.app"],
  }))
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

  app.get('/', (req, res) => {
    res.send('API WORKING')
  })

  return app
}

export default createApp()
