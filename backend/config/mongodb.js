import mongoose from "mongoose";
import dns from "dns";

if (!process.env.VERCEL) {
   dns.setServers(['8.8.8.8', '8.8.4.4']);
}

/**
 * Atlas connection limits (e.g. M0 ~500, M10 ~1500) are shared across every
 * client: each Vercel warm instance × maxPoolSize counts toward the cap.
 * Default mongoose maxPoolSize is 100 — many serverless instances exhaust Atlas fast.
 */
const isServerless = Boolean(process.env.VERCEL);

export const MONGODB_URI_MISSING_MESSAGE = 'MONGODB_URI is not set';

export const MONGODB_URI_MISSING_VERCEL_MESSAGE = 'MONGODB_URI is not configured on the server';

export function getMongoUriOrThrow() {
   const uri = process.env.MONGODB_URI?.trim();
   if (!uri) {
      throw new Error(isServerless ? MONGODB_URI_MISSING_VERCEL_MESSAGE : MONGODB_URI_MISSING_MESSAGE);
   }
   return uri;
}

const connectionOptions = {
   maxPoolSize: isServerless ? 1 : 10,
   minPoolSize: 0,
   serverSelectionTimeoutMS: 5000,
   socketTimeoutMS: 45000,
   maxIdleTimeMS: 10000,
   bufferCommands: false,
};

const connectDB = async () => {
   let uri;
   try {
      uri = getMongoUriOrThrow();
   } catch (error) {
      console.error(`❌ Database Connection Error: ${error.message}`);
      if (isServerless) throw error;
      process.exit(1);
   }

   if (mongoose.connection.readyState === 1) return;

   const cache = global.mongooseCache ?? (global.mongooseCache = { promise: null });
   if (!cache.promise) {
      mongoose.connection.on('connected', () => console.log('✅ Database Connected Successfully'));
      cache.promise = mongoose.connect(uri, connectionOptions).then(() => mongoose.connection);
   }

   try {
      await cache.promise;
   } catch (error) {
      cache.promise = null;
      console.error('❌ Database Connection Error:', error.message);
      if (!isServerless) process.exit(1);
      throw error;
   }
};

export default connectDB;
