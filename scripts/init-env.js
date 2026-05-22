import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

for (const name of ['.env', '.env.prod']) {
  const target = path.join(root, name)
  const example = path.join(root, `${name}.example`)
  if (!fs.existsSync(target) && fs.existsSync(example)) {
    fs.copyFileSync(example, target)
    console.log(`Created ${name} from ${name}.example`)
  } else if (fs.existsSync(target)) {
    console.log(`${name} already exists`)
  } else {
    console.log(`Skip ${name} (no ${name}.example)`)
  }
}
