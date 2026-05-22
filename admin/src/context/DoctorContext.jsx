import { useState, useCallback, useEffect, useMemo } from "react";
import { createContext } from "react";
import axios from 'axios'
import { toast } from 'react-toastify'
import { resolveBackendUrl } from '../utils/resolveBackendUrl'

export const DoctorContext = createContext()

const DoctorContextProvider = (props) => {
    
    const backendUrl = resolveBackendUrl()


    const [dToken, setDToken] = useState(localStorage.getItem('dToken')? localStorage.getItem('dToken'): '')
    const [appointments, setAppointments] = useState([])
    const [history, setHistory] = useState([])
    const [dashData, setDashData] = useState(false)
    const [profileData, setProfileData] = useState(false)
    const [dashDataLoading, setDashDataLoading] = useState(false)

    const getAppointments = useCallback(async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/doctor/appointments', {headers: {dToken}})
            if(data.success){
               setAppointments(data.appointments)
               
            } else {
               toast.error(data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }, [dToken, backendUrl])


    const completeAppointment = async (appointmentId, formData) => {
    try {
    const { data } = await axios.post(backendUrl + '/api/doctor/complete-appointment', {
        appointmentId,
        diagnosis: formData.diagnosis,
        symptoms: formData.symptoms,
        medicationItems: formData.medicationItems,
        instructions: formData.instructions,
        nextVisit: formData.nextVisit,
        labTests: formData.labTests, 
        documentation: formData.documentation
    }, {headers: {dToken}})
    
    if(data.success){
      toast.success(data.message)
      getAppointments()
      getDashData()
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


    const cancelAppointment = async (appointmentId) => {
       try {
        const { data } = await axios.post(backendUrl + '/api/doctor/cancel-appointment', {appointmentId}, {headers: {dToken}})
        if(data.success){
          toast.success(data.message)
          getAppointments()
          getDashData()
        } else {
            toast.error(data.message)
        }
       } catch (error) {
        console.log(error)
        toast.error(error.message)
       }
    }


    const getpatienthistory = useCallback(async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/doctor/patient-history', {headers: {dToken}})
            if(data.success){
               setHistory(data.history)
            } else {
               toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }, [dToken, backendUrl])

    const editPrescription = async (prescriptionId, updatedFields) => {
    try {
    const { data } = await axios.post( backendUrl + '/api/doctor/edit-prescription', { prescriptionId, updatedFields }, { headers: { dToken } })
    
    if (data.success) {
      toast.success(data.message)
      return true
    } else {
      toast.error(data.message)  
    }
    } catch (error) {
    toast.error(error.message)    
    }
   }


    const updatePatientMedicalHistory = async (patientId, medicalHistory) => {
    try {
    const { data } = await axios.post( backendUrl + '/api/doctor/patient-medical-history', { patientId, medicalHistory }, { headers: { dToken } })

    if (data.success) {
      toast.success(data.message)
      return true
    } else {
      toast.error(data.message)
      return false
    }
    } catch (error) {
    toast.error(error.message)
    return false
    }
   }



    const getDashData = useCallback(async () => {
        try {
           const { data } = await axios.get(backendUrl + '/api/doctor/dashboard', {headers: {dToken}})
           if(data.success) {
             setDashData(data.dashData)
           } else {
            toast.error(data.message)
           }
        } catch (error) {
            toast.error(error.message)
        }
    }, [dToken, backendUrl])



    const getProfileData = useCallback(async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/doctor/profile', { headers: {dToken}})
            if(data.success){
               setProfileData(data.profileData)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }, [dToken, backendUrl])

    useEffect(() => {
        if (!dToken) {
            setDashData(false)
            setProfileData(false)
            setDashDataLoading(false)
            return undefined
        }
        let cancelled = false
        setDashDataLoading(true)
        Promise.all([getDashData(), getProfileData()]).finally(() => {
            if (!cancelled) setDashDataLoading(false)
        })
        return () => {
            cancelled = true
            setDashDataLoading(false)
        }
    }, [dToken, getDashData, getProfileData])

    const doctorNavSummary = useMemo(() => {
        if (!profileData || typeof profileData !== 'object') return null
        return {
            name: profileData.name || 'Doctor',
            image: profileData.image || '',
            speciality: profileData.speciality || ''
        }
    }, [profileData])

    const getDoctorRatings = async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/doctor/ratings', { headers: {dToken}})
            if(data.success) return data

            toast.error(data.message)
            return { summary: { averageRating: 0, ratingCount: 0 }, ratings: [] }
        } catch (error) {
            toast.error(error.message)
            return { summary: { averageRating: 0, ratingCount: 0 }, ratings: [] }
        }
    }

    const updateHomeVisitAddress = async (appointmentId, homeVisitAddress) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/doctor/home-visit-address', { appointmentId, homeVisitAddress }, { headers: { dToken } })
            if (data.success) {
                toast.success(data.message)
                getAppointments()
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
       dToken, setDToken,
       backendUrl, 
       appointments, setAppointments,
       getAppointments,completeAppointment,cancelAppointment, 
       history, setHistory, getpatienthistory,
       dashData, setDashData, getDashData, dashDataLoading,
       profileData, setProfileData,
       doctorNavSummary,
       getProfileData, getDoctorRatings, editPrescription, updatePatientMedicalHistory, updateHomeVisitAddress
    }

    return (
        <DoctorContext.Provider value={value}>
           {props.children}
        </DoctorContext.Provider>
    )
}

export default DoctorContextProvider
