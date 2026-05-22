import mongoose from 'mongoose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { clearTestDatabase, connectTestDatabase, disconnectTestDatabase } from '../helpers/db.js'

describe('test database (in-memory)', () => {
  beforeAll(async () => {
    await connectTestDatabase({ memory: true })
  }, 120_000)

  afterAll(async () => {
    await disconnectTestDatabase()
  })

  it('connects to MongoDB', () => {
    expect(mongoose.connection.readyState).toBe(1)
  })

  it('can clear collections', async () => {
    await clearTestDatabase()
    expect(mongoose.connection.readyState).toBe(1)
  })
})
