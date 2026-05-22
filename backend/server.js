import 'dotenv/config'
import connectDB from './config/mongodb.js'
import connectCloudinary from './config/cloudinary.js'
import app from './app.js'

const port = process.env.PORT || 4000

connectDB()
connectCloudinary()

app.listen(port, '0.0.0.0', () => {
  console.log(`Server Started on http://0.0.0.0:${port}`)
})
