import './config/env.js'
import connectDB from './config/mongodb.js'
import connectCloudinary from './config/cloudinary.js'
import { createApp } from './app.js'
import { printMobileAccessBanner } from './utils/lan-ip.js'

const port = process.env.PORT || 4000
const app = createApp()

connectCloudinary()

if (!process.env.VERCEL) {
  connectDB()
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server Started on http://0.0.0.0:${port}`)
    printMobileAccessBanner({ apiPort: port })
  })
}

export default app
