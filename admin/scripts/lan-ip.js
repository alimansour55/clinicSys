import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

/**
 * First private IPv4 on the LAN (Wi‑Fi / Ethernet), for mobile dev URLs.
 */
export function getLanIPv4() {
  const nets = os.networkInterfaces()
  const candidates = []

  for (const name of Object.keys(nets)) {
    const ifaces = nets[name] || []
    for (const iface of ifaces) {
      if (iface.family !== 'IPv4' && iface.family !== 4) continue
      if (iface.internal) continue
      const ip = iface.address
      if (
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
      ) {
        candidates.push(ip)
      }
    }
  }

  return candidates[0] || null
}

export function printMobileAccessBanner({ apiPort = 4000, patientPort = 5173, staffPort = 5174 } = {}) {
  const ip = getLanIPv4()
  const line = '─'.repeat(56)

  console.log('')
  console.log(line)
  console.log('  Mobile access (same Wi‑Fi as this PC)')
  console.log(line)

  if (!ip) {
    console.log('  Could not detect LAN IP. Run: ipconfig')
    console.log('  Then open http://YOUR_IP:' + patientPort + ' on your phone.')
    console.log(line)
    console.log('')
    return null
  }

  console.log(`  PC IP:  ${ip}`)
  console.log('')
  console.log(`  Patient:  http://${ip}:${patientPort}`)
  console.log(`  Staff:    http://${ip}:${staffPort}`)
  console.log(`  API test: http://${ip}:${apiPort}/`)
  console.log('')
  console.log('  Do NOT use localhost on the phone.')
  console.log(line)
  console.log('')
  return ip
}

const isCli =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
if (isCli) {
  printMobileAccessBanner()
}
