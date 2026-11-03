import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

/* The two apps deploy separately, so the design system is copied, and must stay identical. */
const frontendSrc = path.resolve(process.cwd(), 'src')
const adminSrc = path.resolve(process.cwd(), '../admin/src')

const SHARED = ['styles', 'components/ui', 'ui-gallery', 'i18n/mergeAreas.js', 'i18n/loadAreas.js', 'i18n/areas/ui.js', 'utils/theme.js', 'utils/theme.test.js']

const listFiles = (root, relative) => {
  const full = path.join(root, relative)
  if (!fs.statSync(full).isDirectory()) return [relative]
  return fs.readdirSync(full).flatMap((name) => listFiles(root, path.join(relative, name)))
}

const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')

describe.skipIf(!fs.existsSync(adminSrc))('design system sync', () => {
  it('has the same files in frontend and admin', () => {
    const files = (root) => SHARED.flatMap((entry) => listFiles(root, entry)).sort()
    expect(files(adminSrc)).toEqual(files(frontendSrc))
  })

  it.each(SHARED.flatMap((entry) => listFiles(frontendSrc, entry)))('%s is identical in both apps', (file) => {
    expect(read(adminSrc, file)).toBe(read(frontendSrc, file))
  })
})
