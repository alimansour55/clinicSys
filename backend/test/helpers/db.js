import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

/** @type {MongoMemoryServer | undefined} */
let memoryServer

export async function startMemoryServer() {
  if (!memoryServer) {
    memoryServer = await MongoMemoryServer.create()
  }
  return memoryServer.getUri()
}

/**
 * Connect Mongoose for integration tests.
 * @param {{ memory?: boolean }} options - memory=true uses MongoDB Memory Server (default)
 */
export async function connectTestDatabase({ memory = true } = {}) {
  const uri = memory ? await startMemoryServer() : process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Check backend/.env.test or pass memory: true.')
  }
  if (mongoose.connection.readyState === 1) return uri
  await mongoose.connect(uri)
  return uri
}

export async function disconnectTestDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
  if (memoryServer) {
    await memoryServer.stop()
    memoryServer = undefined
  }
}

/** Remove all documents from every collection (between integration examples). */
export async function clearTestDatabase() {
  if (mongoose.connection.readyState !== 1) return
  const { collections } = mongoose.connection
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  )
}
