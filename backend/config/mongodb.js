import mongoose from "mongoose";
import dns from "dns";

// Force Google DNS to bypass ISP blocking
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
   try {
      mongoose.connection.on('connected', () => console.log('✅ Database Connected Successfully'))

      await mongoose.connect(process.env.MONGODB_URI)
   } catch (error) {
      console.error('❌ Database Connection Error:', error.message)
      process.exit(1)
   }
}

export default connectDB