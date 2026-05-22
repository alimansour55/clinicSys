import mongoose from "mongoose";
import dns from "dns";

if (!process.env.VERCEL) {
   dns.setServers(['8.8.8.8', '8.8.4.4']);
}

const connectDB = async () => {
   const uri = process.env.MONGODB_URI?.trim()
   if (!uri) {
      console.error('❌ Database Connection Error: MONGODB_URI is not set')
      if (!process.env.VERCEL) process.exit(1)
      return
   }

   if (mongoose.connection.readyState === 1) return

   const cache = global.mongooseCache ?? (global.mongooseCache = { promise: null })
   if (!cache.promise) {
      mongoose.connection.on('connected', () => console.log('✅ Database Connected Successfully'))
      cache.promise = mongoose.connect(uri).then(() => mongoose.connection)
   }

   try {
      await cache.promise
   } catch (error) {
      cache.promise = null
      console.error('❌ Database Connection Error:', error.message)
      if (!process.env.VERCEL) process.exit(1)
      throw error
   }
}

export default connectDB