import { createContext, useCallback, useEffect, useState } from "react";
import axios from 'axios'
import { toast } from 'react-toastify'
import { readCachedPublicSiteSettings, writeCachedPublicSiteSettings } from '../utils/siteSettingsCache'
import { resolveBackendUrl } from '../utils/resolveBackendUrl'
import { getApiErrorMessage, isDatabaseConfig503 } from '../utils/apiErrorMessage'

export const AdminContext = createContext()

let publicSiteSettingsInflight = null
const fetchPublicSiteSettings = (backendUrl) => {
  if (!publicSiteSettingsInflight) {
    publicSiteSettingsInflight = axios
      .get(`${backendUrl}/api/user/site-settings`)
      .catch((error) => {
        console.error(error)
        if (isDatabaseConfig503(error)) {
          toast.error(
            'Server database is not configured. Add MONGODB_URI to the backend Vercel project (clinic-sys-eight) and redeploy.',
            { toastId: 'api-db-config' }
          )
        } else if (error?.response?.status === 503) {
          toast.error(getApiErrorMessage(error), { toastId: 'api-db-503' })
        }
        return { data: { success: false } }
      })
      .finally(() => {
        publicSiteSettingsInflight = null
      })
  }
  return publicSiteSettingsInflight
}

const AdminContextProvider = (props) => {

    const [aToken, setAToken] = useState(localStorage.getItem('aToken')? localStorage.getItem('aToken'): '')
    const [doctors, setDoctors] = useState([])
    const [appointments, setAppointments] = useState([])
    const [dashData, setDashData] = useState(false)
    const [membersHistory, setmembersHistory] = useState([])
    const [receptionists, setReceptionists] = useState([])
    const [clinics, setClinics] = useState([])
    const [allowedClinics, setAllowedClinics] = useState([])
    const [users, setUsers] = useState([])
    const [patients, setPatients] = useState([])
    const [siteSettings, setSiteSettings] = useState(() => readCachedPublicSiteSettings())
    const [adminNavSummary, setAdminNavSummary] = useState({
      email: '',
      name: 'Administrator',
      phone: '',
      image: '',
      jobTitle: 'Clinic Administrator'
    })

    const backendUrl = resolveBackendUrl()

    const refreshAdminNavSummary = useCallback(async () => {
      if (!aToken) return
      try {
        const { data } = await axios.get(`${backendUrl}/api/admin/profile`, { headers: { aToken } })
        if (data.success && data.profile) {
          setAdminNavSummary({
            email: data.profile.email || '',
            name: data.profile.name || 'Administrator',
            phone: data.profile.phone || '',
            image: data.profile.image || '',
            jobTitle: data.profile.jobTitle || 'Clinic Administrator'
          })
        }
      } catch {
        // Nav summary is optional; profile page shows errors
      }
    }, [aToken, backendUrl])

    useEffect(() => {
      if (aToken) refreshAdminNavSummary()
    }, [aToken, refreshAdminNavSummary])

    useEffect(() => {
      let cancelled = false
      fetchPublicSiteSettings(backendUrl).then((res) => {
        const { data } = res
        if (cancelled || !data.success || !data.settings) return
        setSiteSettings((prev) => {
          const incoming = data.settings
          if (!prev) return incoming
          return {
            ...prev,
            branding: incoming.branding ?? prev.branding,
            insuranceProviders: incoming.insuranceProviders ?? prev.insuranceProviders,
            languageAvailability: incoming.languageAvailability ?? prev.languageAvailability,
            languagePolicies: incoming.languagePolicies ?? prev.languagePolicies
          }
        })
      })
      return () => {
        cancelled = true
      }
    }, [backendUrl])

    useEffect(() => {
      if (siteSettings) writeCachedPublicSiteSettings(siteSettings)
    }, [siteSettings])

    const getAllDoctors = async () => {
       try {
        const { data } = await axios.post(backendUrl + '/api/admin/all-doctors', {} , {headers:{aToken}})
        if(data.success) {
            setDoctors(data.doctors)
        } else {
            toast.error(data.message)
        }

       } catch (error) {
        toast.error(error.message)
       }
    }


    const updateDoctorByAdmin = async (formData) => {
      try {
       const { data } = await axios.post(backendUrl + '/api/admin/update-doctor', formData,{headers: {aToken}})
       if (data.success) {
       toast.success(data.message)
       getAllDoctors() // context refresh
      } else {
      toast.error(data.message)
      }
    } catch (error) {
    toast.error(error.message)
    }  
    }



    
    const changeAvailability = async (docId, available) => {
        try {
        const payload = { docId }
        if (typeof available === 'boolean') payload.available = available
        const { data } = await axios.post(backendUrl + '/api/admin/change-availability', payload, {headers:{aToken}})
        if(data.success) {
            toast.success(data.message)
            getAllDoctors()
        } else {
            toast.error(data.message)
        }
        
        } catch (error) {
            toast.error(error.message)
        }
    }



    const getAllAppointments = async () => {
        try {        
          const { data } = await axios.get(backendUrl + '/api/admin/appointments', {headers: {aToken}})
          if(data.success){
            setAppointments(data.appointments)
          } else {
            toast.error(data.message)
          }

        } catch (error) {
            toast.error(error.message)
        }
    }



    const cancelAppointment = async (appointmentId) => {
       try {    
        const { data } = await axios.post(backendUrl+ '/api/admin/cancel-appointment', {appointmentId}, {headers:{aToken}})
        if(data.success) {
            toast.success(data.message)
            getAllAppointments()
        } else {
            toast.error(data.message)
        }
       } catch (error) {
         toast.error(error.message)
       }
    }



    const getDashData = async () => {
        try {        
           const { data } = await axios.get(backendUrl + '/api/admin/dashboard', {headers: {aToken} })
           if(data.success) {
            setDashData(data.dashData)
           } else {
            toast.error(data.message)
           }
        } catch (error) {
            toast.error(error.message)

        }
      }


    const getAppointmentsHistory = async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/admin/appointment-history', {headers: {aToken}})
            if(data.success){
               setmembersHistory(data.appointments)
            } else {
               toast.error(data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }


    const deleteAppointmentHistory = async (appointmentId) => {
      try {
      const { data } = await axios.post( backendUrl + '/api/admin/delete-appointment-history', { appointmentId },{ headers: { aToken } })
      if (data.success) {
      toast.success(data.message)
      getAppointmentsHistory() 
       } else {
      toast.error(data.message)
       }
    } catch (error) {
    toast.error(error.message)
      }
    }

    const getAllPatients = async () => {
      try {
        const { data } = await axios.get(backendUrl + '/api/admin/patients', {headers: {aToken}})
        if(data.success){
          setPatients(data.patients)
        } else {
          toast.error(data.message)
        }
      } catch (error) {
        toast.error(error.message)
      }
    }

    const getPatientDetails = async (patientId) => {
      try {
        const { data } = await axios.get(backendUrl + `/api/admin/patients/${patientId}`, {headers: {aToken}})
        if(data.success){
          return data
        }

        toast.error(data.message)
        return null
      } catch (error) {
        toast.error(error.message)
        return null
      }
    }

    const changePatientStatus = async (patientId) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/change-patient-status', {patientId}, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          getAllPatients()
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const deletePatient = async (patientId) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/delete-patient', {patientId}, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          getAllPatients()
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const normalizeAdminUser = (profileType, item) => ({
      _id: item._id,
      profileId: item._id,
      profileType,
      role: profileType,
      name: item.name || '',
      email: item.email || '',
      phone: item.phone || '',
      image: item.image || '',
      patientId: item.patientId || '',
      speciality: item.speciality || '',
      gender: item.gender || '',
      dob: item.dob || '',
      address: item.address || { line1: '', line2: '' },
      isActive: profileType === 'doctor' ? item.available !== false : item.isActive !== false,
      createdAt: item.createdAt || item.date || ''
    })

    const getUsersFromExistingEndpoints = async () => {
      const [patientsResult, doctorsResult, receptionistsResult] = await Promise.allSettled([
        axios.get(backendUrl + '/api/admin/patients', {headers: {aToken}}),
        axios.post(backendUrl + '/api/admin/all-doctors', {}, {headers: {aToken}}),
        axios.get(backendUrl + '/api/admin/receptionists', {headers: {aToken}})
      ])

      const fallbackUsers = [
        ...((patientsResult.value?.data?.patients || []).map((item) => normalizeAdminUser('patient', item))),
        ...((doctorsResult.value?.data?.doctors || []).map((item) => normalizeAdminUser('doctor', item))),
        ...((receptionistsResult.value?.data?.receptionists || []).map((item) => normalizeAdminUser('receptionist', item)))
      ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

      setUsers(fallbackUsers)
      return fallbackUsers
    }

    const getAllUsers = async () => {
      try {
        const { data } = await axios.get(backendUrl + '/api/admin/users', {headers: {aToken}})
        if(data.success){
          setUsers(data.users)
        } else {
          await getUsersFromExistingEndpoints()
          if (data.message) toast.error(data.message)
        }
      } catch (error) {
        const fallbackUsers = await getUsersFromExistingEndpoints()
        if (fallbackUsers.length === 0) toast.error(error.message)
      }
    }

    const createUserByAdmin = async (payload) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/create-user', payload, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          await getAllUsers()
          if (payload.profileType === 'patient') getAllPatients()
          if (payload.profileType === 'receptionist') getReceptionists()
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        try {
          if (payload.profileType === 'patient') {
            const { data } = await axios.post(backendUrl + '/api/user/register', payload)
            if (data.success) {
              toast.success('Patient created successfully')
              await getAllUsers()
              getAllPatients()
              return true
            }
            toast.error(data.message)
            return false
          }

          if (payload.profileType === 'receptionist') {
            const { data } = await axios.post(backendUrl + '/api/admin/add-receptionist', payload, {headers: {aToken}})
            if (data.success) {
              toast.success(data.message)
              await getAllUsers()
              getReceptionists()
              return true
            }
            toast.error(data.message)
            return false
          }
        } catch (fallbackError) {
          toast.error(fallbackError.message)
          return false
        }

        toast.error(error.message)
        return false
      }
    }

    const updateUserByAdmin = async (payload) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/update-user', payload, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          await getAllUsers()
          if (payload.profileType === 'patient') getAllPatients()
          if (payload.profileType === 'doctor') getAllDoctors()
          if (payload.profileType === 'receptionist') getReceptionists()
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const resetUserPassword = async (payload) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/reset-user-password', payload, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        if (payload.profileType === 'doctor') {
          try {
            const formData = new FormData()
            formData.append('docId', payload.profileId)
            formData.append('password', payload.password)
            const { data } = await axios.post(backendUrl + '/api/admin/update-doctor', formData, {headers: {aToken}})
            if (data.success) {
              toast.success('Password reset successfully')
              return true
            }
            toast.error(data.message)
            return false
          } catch (fallbackError) {
            toast.error(fallbackError.message)
            return false
          }
        }

        toast.error(error.message)
        return false
      }
    }

    const updateUserMfaRequirement = async (payload) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/update-user-mfa-requirement', payload, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          await getAllUsers()
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const resetUserMfa = async (payload) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/reset-user-mfa', payload, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          await getAllUsers()
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const deleteUserAccount = async (payload) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/delete-user-account', payload, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          await getAllUsers()
          if (payload.profileType === 'patient') getAllPatients()
          if (payload.profileType === 'doctor') getAllDoctors()
          if (payload.profileType === 'receptionist') getReceptionists()
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        try {
          const fallbackEndpoint = payload.profileType === 'patient'
            ? '/api/admin/delete-patient'
            : '/api/admin/delete-profile'
          const fallbackBody = payload.profileType === 'patient'
            ? { patientId: payload.profileId }
            : { profileType: payload.profileType, profileId: payload.profileId }
          const { data } = await axios.post(backendUrl + fallbackEndpoint, fallbackBody, {headers: {aToken}})

          if(data.success) {
            toast.success(data.message)
            await getAllUsers()
            if (payload.profileType === 'patient') getAllPatients()
            if (payload.profileType === 'doctor') getAllDoctors()
            if (payload.profileType === 'receptionist') getReceptionists()
            return true
          }

          toast.error(data.message)
          return false
        } catch (fallbackError) {
          toast.error(fallbackError.message || error.message)
          return false
        }
      }
    }

    const getReceptionists = async () => {
      try {
        const { data } = await axios.get(backendUrl + '/api/admin/receptionists', {headers: {aToken}})
        if(data.success) {
          setReceptionists(data.receptionists)
        } else {
          toast.error(data.message)
        }
      } catch (error) {
        toast.error(error.message)
      }
    }

    const changeReceptionistStatus = async (receptionistId) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/change-receptionist-status', {receptionistId}, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          getReceptionists()
        } else {
          toast.error(data.message)
        }
      } catch (error) {
        toast.error(error.message)
      }
    }

    const getReceptionistById = async (receptionistId) => {
      try {
        const { data } = await axios.get(`${backendUrl}/api/admin/receptionist/${receptionistId}`, { headers: { aToken } })
        if (data.success) return data.receptionist
        toast.error(data.message)
        return null
      } catch (error) {
        toast.error(error.response?.data?.message || error.message)
        return null
      }
    }

    const updateReceptionistByAdmin = async (formData) => {
      try {
        const { data } = await axios.post(`${backendUrl}/api/admin/update-receptionist`, formData, { headers: { aToken } })
        if (data.success) {
          toast.success(data.message)
          getReceptionists()
          return true
        }
        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.response?.data?.message || error.message)
        return false
      }
    }

    const getClinics = async () => {
      try {
        const { data } = await axios.get(backendUrl + '/api/admin/clinics', {headers: {aToken}})
        if(data.success) {
          setClinics(data.clinics)
          setAllowedClinics(data.defaultClinics || data.allowedClinics || [])
        } else {
          toast.error(data.message)
        }
      } catch (error) {
        toast.error(error.message)
      }
    }

    const createClinic = async (clinicData) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/create-clinic', clinicData, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          getClinics()
        } else {
          toast.error(data.message)
        }
      } catch (error) {
        toast.error(error.message)
      }
    }

    const updateClinic = async (clinicData) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/update-clinic', clinicData, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          getClinics()
        } else {
          toast.error(data.message)
        }
      } catch (error) {
        toast.error(error.message)
      }
    }

    const deleteClinic = async (clinicId) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/delete-clinic', {clinicId}, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          getClinics()
        } else {
          toast.error(data.message)
        }
      } catch (error) {
        toast.error(error.message)
      }
    }

    const assignDoctorsToClinic = async (clinicId, doctorIds) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/assign-clinic-doctors', {clinicId, doctorIds}, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          getClinics()
          getAllDoctors()
        } else {
          toast.error(data.message)
        }
      } catch (error) {
        toast.error(error.message)
      }
    }

    const getSiteSettings = async () => {
      try {
        const { data } = await axios.get(backendUrl + '/api/admin/site-settings', {headers: {aToken}})
        if(data.success) {
          setSiteSettings(data.settings)
        } else {
          toast.error(data.message)
        }
      } catch (error) {
        toast.error(error.message)
      }
    }

    const updateHomeHeroSettings = async (formData) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/site-settings/home-hero', formData, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          setSiteSettings(data.settings)
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const updateHomeBannerSettings = async (formData) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/site-settings/home-banner', formData, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          setSiteSettings(data.settings)
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const updateHomeServiceCardsSettings = async (formData) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/site-settings/home-service-cards', formData, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          setSiteSettings(data.settings)
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const updateFooterSettings = async (footerData) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/site-settings/footer', footerData, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          setSiteSettings(data.settings)
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const updateInsuranceProviders = async (providers) => {
      try {
        const { data } = await axios.post(
          backendUrl + '/api/admin/site-settings/insurance-providers',
          { providers },
          { headers: { aToken } }
        )
        if (data.success) {
          toast.success(data.message)
          setSiteSettings(data.settings)
          return true
        }
        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const updateBrandingSettings = async (payload) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/site-settings/branding', payload, { headers: { aToken } })
        if (data.success) {
          toast.success(data.message)
          try {
            const refreshed = await axios.get(backendUrl + '/api/admin/site-settings', { headers: { aToken } })
            if (refreshed.data?.success && refreshed.data.settings) {
              setSiteSettings(refreshed.data.settings)
            } else if (data.settings) {
              setSiteSettings(data.settings)
            }
          } catch {
            if (data.settings) setSiteSettings(data.settings)
          }
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const updateSecuritySettings = async (securityData) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/site-settings/security', securityData, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          setSiteSettings(data.settings)
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const updateLanguagePoliciesSettings = async (languagePolicies) => {
      try {
        const { data } = await axios.post(
          backendUrl + '/api/admin/site-settings/language-policies',
          { languagePolicies },
          { headers: { aToken } }
        )
        if (data.success) {
          toast.success(data.message)
          setSiteSettings(data.settings)
          return true
        }
        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const updateHomeVisitPricingSettings = async (homeVisitPricingData) => {
      try {
        const { data } = await axios.post(
          backendUrl + '/api/admin/site-settings/home-visit-pricing',
          homeVisitPricingData,
          { headers: { aToken } }
        )
        if (data.success) {
          toast.success(data.message)
          setSiteSettings(data.settings)
          return true
        }
        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const updateGlobalVisitFeesSettings = async (globalVisitFeesData) => {
      try {
        const { data } = await axios.post(
          backendUrl + '/api/admin/site-settings/global-visit-fees',
          globalVisitFeesData,
          { headers: { aToken } }
        )
        if (data.success) {
          toast.success(data.message)
          setSiteSettings(data.settings)
          return true
        }
        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    const getDoctorRatings = async (docId) => {
      try {
        const { data } = await axios.get(backendUrl + `/api/admin/doctor-ratings/${docId}`, {headers: {aToken}})
        if(data.success) return data

        toast.error(data.message)
        return { summary: { averageRating: 0, ratingCount: 0 }, ratings: [] }
      } catch (error) {
        toast.error(error.message)
        return { summary: { averageRating: 0, ratingCount: 0 }, ratings: [] }
      }
    }

    const deleteDoctorRating = async (ratingId) => {
      try {
        const { data } = await axios.post(backendUrl + '/api/admin/delete-rating', {ratingId}, {headers: {aToken}})
        if(data.success) {
          toast.success(data.message)
          await getAllDoctors()
          return true
        }

        toast.error(data.message)
        return false
      } catch (error) {
        toast.error(error.message)
        return false
      }
    }

    

    const value = {
       aToken, setAToken,
       adminNavSummary, refreshAdminNavSummary,
       backendUrl, doctors,
       getAllDoctors, 
       updateDoctorByAdmin,  
       changeAvailability,
       appointments, setAppointments,
       getAllAppointments,
       cancelAppointment,
       dashData, getDashData,
       users, getAllUsers, createUserByAdmin, updateUserByAdmin, resetUserPassword, updateUserMfaRequirement, resetUserMfa, deleteUserAccount,
       patients, getAllPatients, getPatientDetails, changePatientStatus, deletePatient,
       membersHistory, setmembersHistory, getAppointmentsHistory,
       deleteAppointmentHistory,
       receptionists, getReceptionists, changeReceptionistStatus, getReceptionistById, updateReceptionistByAdmin,
       clinics, allowedClinics, getClinics, createClinic, updateClinic, deleteClinic, assignDoctorsToClinic,
       siteSettings, getSiteSettings, updateHomeHeroSettings, updateHomeBannerSettings, updateHomeServiceCardsSettings, updateFooterSettings, updateBrandingSettings, updateInsuranceProviders, updateSecuritySettings, updateHomeVisitPricingSettings, updateGlobalVisitFeesSettings, updateLanguagePoliciesSettings,
       getDoctorRatings, deleteDoctorRating
    }

    return (
        <AdminContext.Provider value={value}>
           {props.children}
        </AdminContext.Provider>
    )
}

export default AdminContextProvider
