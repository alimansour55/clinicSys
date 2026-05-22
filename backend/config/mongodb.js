import mongoose from "mongoose";
import dns from "dns";

// Force Google DNS to bypass ISP blocking
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
   if (!process.env.MONGODB_URI?.trim()) {
      console.error('❌ Database Connection Error: MONGODB_URI is not set')
      if (!process.env.VERCEL) process.exit(1)
      return
   }

   if (mongoose.connection.readyState === 1) return

   try {
      mongoose.connection.on('connected', () => console.log('✅ Database Connected Successfully'))
      await mongoose.connect(process.env.MONGODB_URI)
   } catch (error) {
      console.error('❌ Database Connection Error:', error.message)
      if (!process.env.VERCEL) process.exit(1)
   }
}

export default connectDB