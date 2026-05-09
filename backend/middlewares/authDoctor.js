import { authenticateRole } from './rbac.js'

// Doctor authentication middleware
const authDoctor = authenticateRole('doctor')

export default authDoctor
