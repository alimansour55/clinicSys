import { createContext, useEffect, useState } from "react";
import axios from 'axios'
import { toast } from "react-toastify";
import { useLanguage } from "../i18n";

export const AppContext = createContext()

const AppContextProvider = (props) => {

  const backendUrl = import.meta.env.VITE_BACKEND_URL
  const { language, t, tc } = useLanguage()
  const currencySymbol = language === 'ar' ? 'ج.م ' : 'EGP '
  
  const [doctors, setDoctors] = useState([])
  const [clinics, setClinics] = useState([])
  const [token, setToken] = useState(localStorage.getItem('token') ? localStorage.getItem('token') : false)
  const [userData, setUserData] = useState(false)
  const [appointments, setAppointments] = useState([])
  const [siteSettings, setSiteSettings] = useState(null)

  // UTILITY FUNCTIONS 
  const calculateAge = (dob) => {
    const today = new Date()
    const birthDate = new Date(dob)
    let age = today.getFullYear() - birthDate.getFullYear()
    return age
  }

  const months = language === 'ar'
    ? ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
    : ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  const slotDateFormat = (slotDate) => {
    const dateArray = slotDate.split('_')
    return dateArray[0] + " " + months[Number(dateArray[1])] + " " + dateArray[2]
  }

  
  // DOCTORS API 
  const getDoctorsData = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/doctor/list')
      if (data.success) {
        setDoctors(data.doctors)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  const getClinicsData = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/doctor/clinics')
      if (data.success) {
        setClinics(data.clinics)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  const getSiteSettings = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/user/site-settings')
      if (data.success) {
        setSiteSettings(data.settings)
      }
    } catch (error) {
      console.log(error)
    }
  }

  
  // USER PROFILE API 
  const loadUserProfileData = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/user/get-profile', { headers: { token } })
      if (data.success) {
        setUserData(data.userData)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  
  //  APPOINTMENTS API 
  const getUserAppointments = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/user/appointments', { headers: { token } })
      
      if (data.success) {
        setAppointments(data.appointments.reverse())
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }


  const cancelAppointment = async (appointmentId) => {
    try {
      const { data } = await axios.post(
        backendUrl + '/api/user/cancel-appointment',
        { appointmentId },
        { headers: { token } }
      )

      if (data.success) {
        toast.success(data.message)
        getUserAppointments() 
        getDoctorsData() 
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  
  // PRESCRIPTION API 
  const getUserPrescription = async (appointmentId) => {
    try {
      
      const { data } = await axios.post(
        backendUrl + '/api/user/get-prescription',
        { appointmentId },
        { headers: { token } }
      )

      console.log('📄 API Response:', data)

      if (data.success) {
        return data.prescription
      } else {
        toast.error(data.message)
        return null
      }
    } catch (error) {
      toast.error(error.message)
      return null
    }
  }

  const getMedicalHistory = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/user/medical-history', { headers: { token } })

      if (data.success) {
        return data.medicalHistory || {}
      } else {
        toast.error(data.message)
        return null
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
      return null
    }
  }

  const saveMedicalHistory = async (medicalHistory, method = 'put') => {
    try {
      const request = method === 'post' ? axios.post : axios.put
      const { data } = await request(
        backendUrl + '/api/user/medical-history',
        { medicalHistory },
        { headers: { token } }
      )

      if (data.success) {
        toast.success(data.message)
        await loadUserProfileData()
        return data.medicalHistory
      } else {
        toast.error(data.message)
        return null
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
      return null
    }
  }

  const saveInsurance = async (formData) => {
    try {
      const { data } = await axios.post(backendUrl + '/api/user/update-insurance', formData, { headers: { token } })

      if (data.success) {
        toast.success(data.message)
        setUserData(data.userData)
        return data.insurance
      }

      toast.error(data.message)
      return null
    } catch (error) {
      console.log(error)
      toast.error(error.message)
      return null
    }
  }




  //  PASSWORD RESET APIs 
  const sendPasswordResetOtp = async (email, navigate) => {
   try {
    const { data } = await axios.post(backendUrl + '/api/user/send-reset-otp', { email })
    
    if (data.success) {
      toast.success(data.message)
      navigate("/otp-verify", { state: { email } })
      return true
    } else {
      toast.error(data.message)
      return false
    }
   } catch (error) {
    console.log(error)
    toast.error(error.message)
    return false
   }
  } 

  const verifyPasswordResetOtp = async (email, otp, navigate) => {
   try {
    const { data } = await axios.post(backendUrl + '/api/user/verify-reset-otp', { email, otp })
    
    if (data.success) {
      toast.success(data.message)
      navigate("/reset-password", { state: { email, otp } })
      return true
    } else {
      toast.error(data.message)
      return false
    }
   } catch (error) {
    console.log(error)
    toast.error(error.message)
    return false
   }
  }

  const resetPassword = async (email, otp, newPassword, navigate) => {
   try {
    const { data } = await axios.post(backendUrl + '/api/user/reset-password', { 
      email, 
      otp, 
      newPassword 
    })
    
    if (data.success) {
      toast.success(data.message)
      // Navigate to login after 1 seconds
      setTimeout(() => {
        navigate("/login")
      }, 500)
      return true
    } else {
      toast.error(data.message)
      return false
    }
   } catch (error) {
    console.log(error)
    toast.error(error.message)
    return false
   }
  }




  // CONTEXT VALUE 
  const value = {
    // State
    doctors,
    clinics,
    token,
    setToken,
    userData,
    setUserData,
    appointments,
    siteSettings,
    currencySymbol,
    backendUrl,
    language,
    t,
    tc,

    // Utility Functions
    calculateAge,
    slotDateFormat,

    // API Functions
    getDoctorsData,
    getClinicsData,
    getSiteSettings,
    loadUserProfileData,
    getUserAppointments,
    cancelAppointment,
    getUserPrescription,
    getMedicalHistory,
    saveMedicalHistory,
    saveInsurance,
    
    sendPasswordResetOtp,
    verifyPasswordResetOtp,
    resetPassword,
  }

  //  EFFECTS 
  useEffect(() => {
    getDoctorsData()
    getClinicsData()
    getSiteSettings()
  }, [])

  useEffect(() => {
    if (token) {
      loadUserProfileData()
      getUserAppointments()
    } else {
      setUserData(false)
      setAppointments([])
    }
  }, [token])

  return (
    <AppContext.Provider value={value}>
      {props.children}
    </AppContext.Provider>
  )
}

export default AppContextProvider
