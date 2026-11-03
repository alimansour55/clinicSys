import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { translateForAudit } from './auditDictionary'
import baseline from './missing-keys-baseline.json'

const srcDir = path.resolve(process.cwd(), 'src')

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'ui-gallery' ? [] : walk(full)
    return /\.jsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : []
  })

const literalKeys = () => {
  const keys = new Set()
  for (const file of walk(srcDir)) {
    const code = fs.readFileSync(file, 'utf8')
    for (const match of code.matchAll(/(?<![\w.])t\(\s*(['"])((?:(?!\1)[^\\\n])+)\1\s*\)/g)) {
      keys.add(match[2])
    }
  }
  return [...keys].filter((key) => /[A-Za-z]/.test(key)).sort()
}

const missing = literalKeys().filter((key) => !translateForAudit(key))

/* WRITE_I18N_BASELINE=1 npx vitest run src/i18n/missingKeys rewrites the list. Not for feature work. */
if (process.env.WRITE_I18N_BASELINE) {
  fs.writeFileSync(path.join(srcDir, 'i18n/missing-keys-baseline.json'), `${JSON.stringify(missing, null, 2)}\n`)
}

describe('translation coverage', () => {
  /*
   * A ratchet: strings that were already untranslated are listed in the baseline, and
   * anything new must have Arabic. Fix a string by adding it to your area file. Removing
   * it from the baseline is optional, so parallel work does not collide on that file.
   */
  it('every new t() string has Arabic', () => {
    expect(missing.filter((key) => !baseline.includes(key))).toEqual([])
  })
})
