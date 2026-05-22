import path from 'path'
import { fileURLToPath } from 'url'
import { printMobileAccessBanner } from '../backend/utils/lan-ip.js'

export { getLanIPv4, printMobileAccessBanner } from '../backend/utils/lan-ip.js'

const isCli =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
if (isCli) {
  printMobileAccessBanner()
}
