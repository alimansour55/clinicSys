import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Load backend/.env.test (does not override existing process.env). */
export function loadTestEnv() {
  dotenv.config({
    path: path.resolve(__dirname, '../../.env.test'),
    quiet: true,
  })
}
