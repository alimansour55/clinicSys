import { authenticateRole } from './rbac.js'

const authReceptionist = authenticateRole('receptionist')

export default authReceptionist
