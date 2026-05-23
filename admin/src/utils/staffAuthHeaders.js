/** Auth header names must match backend middleware (rbac.js). */
export const buildAdminAuthHeaders = (token) => (token ? { atoken: token } : {})
export const buildDoctorAuthHeaders = (token) => (token ? { dtoken: token } : {})
export const buildReceptionistAuthHeaders = (token) => (token ? { rtoken: token } : {})

export const buildStaffAuthHeaders = ({ aToken, dToken, rToken } = {}) => {
  if (aToken) return buildAdminAuthHeaders(aToken)
  if (dToken) return buildDoctorAuthHeaders(dToken)
  if (rToken) return buildReceptionistAuthHeaders(rToken)
  return null
}
