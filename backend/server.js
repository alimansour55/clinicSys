import './config/env.js'
import connectDB from './config/mongodb.js'
import connectCloudinary from './config/cloudinary.js'
import app from './app.js'
import { printMobileAccessBanner } from './utils/lan-ip.js'

const port = process.env.PORT || 4000

connectDB()
connectCloudinary()

if (!process.env.VERCEL) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server Started on http://0.0.0.0:${port}`)
    printMobileAccessBanner({ apiPort: port })
  })
}

// Vercel @vercel/node expects the Express app as the default export (no app.listen).
export default app
