import { createContext, useState } from "react";
import axios from 'axios'
import { toast } from 'react-toastify'

export const AdminContext = createContext()

const AdminContextProvider = (props) => {

    const [aToken, setAToken] = useState(localStorage.getItem('aToken')? localStorage.getItem('aToken'): '')
    const [doctors, setDoctors] = useState([])
    const [appointments, setAppointments] = useState([])
    const [dashData, setDashData] = useState(false)
    const [membersHistory, setmembersHistory] = useState([])
    const [receptionists, setReceptionists] = useState([])
    const [clinics, setClinics] = useState([])
    const [allowedClinics, setAllowedClinics] = useState([])
    const [patients, setPatients] = useState([])
    const [siteSettings, setSiteSettings] = useState(null)

    const backendUrl = import.meta.env.VITE_BACKEND_URL

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



    
    const changeAvailability = async (docId) => {
        try {        
        const { data } = await axios.post(backendUrl + '/api/admin/change-availability', {docId}, {headers:{aToken}})
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

    

    const value = {
       aToken, setAToken,
       backendUrl, doctors,
       getAllDoctors, 
       updateDoctorByAdmin,  
       changeAvailability,
       appointments, setAppointments,
       getAllAppointments,
       cancelAppointment,
       dashData, getDashData,
       patients, getAllPatients, getPatientDetails, changePatientStatus, deletePatient,
       membersHistory, setmembersHistory, getAppointmentsHistory,
       deleteAppointmentHistory,
       receptionists, getReceptionists, changeReceptionistStatus,
       clinics, allowedClinics, getClinics, createClinic, updateClinic, deleteClinic, assignDoctorsToClinic,
       siteSettings, getSiteSettings, updateHomeHeroSettings
    }

    return (
        <AdminContext.Provider value={value}>
           {props.children}
        </AdminContext.Provider>
    )
}

export default AdminContextProvider
