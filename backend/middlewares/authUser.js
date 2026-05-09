import { authenticateRole } from './rbac.js'

// user authentication middleware
const authUser = authenticateRole('patient')

export default authUser
