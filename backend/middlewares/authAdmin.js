import { authenticateRole } from './rbac.js'

// admin authentication middleware
const authAdmin = authenticateRole('admin')

export default authAdmin
