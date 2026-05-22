import { createContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { resolveBackendUrl } from "../utils/resolveBackendUrl";

export const ReceptionistContext = createContext();

const ReceptionistContextProvider = (props) => {
  const backendUrl = resolveBackendUrl();
  const [rToken, setRToken] = useState(localStorage.getItem("rToken") ? localStorage.getItem("rToken") : "");
  const [receptionistNavSummary, setReceptionistNavSummary] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [dashData, setDashData] = useState(false);
  const [dashDataLoading, setDashDataLoading] = useState(false);

  const getReceptionistDashboard = useCallback(async () => {
    try {
      const { data } = await axios.get(backendUrl + "/api/receptionist/dashboard", { headers: { rToken } });
      if (data.success) {
        setDashData(data.dashData);
        return true;
      }
      toast.error(data.message);
      return false;
    } catch (error) {
      toast.error(error.message);
      return false;
    }
  }, [rToken, backendUrl]);

  useEffect(() => {
    if (!rToken) {
      setDashData(false);
      setDashDataLoading(false);
      return undefined;
    }
    let cancelled = false;
    setDashDataLoading(true);
    getReceptionistDashboard().finally(() => {
      if (!cancelled) setDashDataLoading(false);
    });
    return () => {
      cancelled = true;
      setDashDataLoading(false);
    };
  }, [rToken, getReceptionistDashboard]);

  const getReceptionistAppointments = async () => {
    try {
      const { data } = await axios.get(backendUrl + "/api/receptionist/appointments", { headers: { rToken } });
      if (data.success) setAppointments(data.appointments);
      else toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const getReceptionistDoctors = async () => {
    try {
      const { data } = await axios.get(backendUrl + "/api/receptionist/doctors", { headers: { rToken } });
      if (data.success) {
        setDoctors(data.doctors);
        return { success: true, doctors: data.doctors };
      }
      toast.error(data.message);
      return { success: false, message: data.message };
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      toast.error(message);
      return { success: false, message, status: error.response?.status };
    }
  };

  const getReceptionistPatients = async () => {
    try {
      const { data } = await axios.get(backendUrl + "/api/receptionist/patients", { headers: { rToken } });
      if (data.success) setPatients(data.patients);
      else toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const getReceptionistPatientDetails = async (patientId) => {
    try {
      const { data } = await axios.get(backendUrl + `/api/receptionist/patients/${patientId}`, { headers: { rToken } });
      if (data.success) return data;
      toast.error(data.message);
      return null;
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  };

  const getReceptionistClinics = async () => {
    try {
      const { data } = await axios.get(backendUrl + "/api/receptionist/clinics", { headers: { rToken } });
      if (data.success) {
        setClinics(data.clinics);
        return { success: true, clinics: data.clinics };
      }
      toast.error(data.message);
      return { success: false, message: data.message };
    } catch (error) {
      const message = error.response?.status === 404
        ? "Clinic endpoint was not found. Restart or redeploy the backend so the receptionist clinic route is available."
        : error.response?.data?.message || error.message;
      toast.error(message);
      return { success: false, message, status: error.response?.status };
    }
  };

  const updateAppointmentStatus = async (appointmentId, appointmentStatus) => {
    try {
      const { data } = await axios.post(backendUrl + "/api/receptionist/appointment-status", { appointmentId, appointmentStatus }, { headers: { rToken } });
      if (data.success) {
        toast.success(data.message);
        getReceptionistAppointments();
        getReceptionistDashboard();
      } else toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const checkInPatient = async (appointmentId) => {
    try {
      const { data } = await axios.post(backendUrl + "/api/receptionist/check-in", { appointmentId }, { headers: { rToken } });
      if (data.success) {
        toast.success(data.message);
        getReceptionistAppointments();
        getReceptionistDashboard();
      } else toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const updatePayment = async (appointmentId, paymentStatus, paymentMethod) => {
    try {
      const payload = typeof paymentStatus === 'object'
        ? { appointmentId, ...paymentStatus }
        : { appointmentId, paymentStatus, paymentMethod };
      const { data } = await axios.post(backendUrl + "/api/receptionist/payment", payload, { headers: { rToken } });
      if (data.success) {
        toast.success(data.message);
        if (data.appointment) {
          setAppointments((previous) => previous.map((item) => item._id === appointmentId ? data.appointment : item));
        } else {
          getReceptionistAppointments();
        }
        getReceptionistDashboard();
        return data.appointment || true;
      } else toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
    }
    return null;
  };

  const updateHomeVisitAddress = async (appointmentId, homeVisitAddress) => {
    try {
      const { data } = await axios.post(backendUrl + "/api/receptionist/home-visit-address", { appointmentId, homeVisitAddress }, { headers: { rToken } });
      if (data.success) {
        toast.success(data.message);
        getReceptionistAppointments();
        return true;
      }
      toast.error(data.message);
      return false;
    } catch (error) {
      toast.error(error.message);
      return false;
    }
  };

  const createReceptionistPatient = async (formData) => {
    try {
      const { data } = await axios.post(backendUrl + "/api/receptionist/patients", formData, { headers: { rToken } });
      if (data.success) {
        toast.success(data.message);
        getReceptionistPatients();
        return data.patient;
      }
      toast.error(data.message);
      return null;
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return null;
    }
  };

  const updatePatientInsurance = async (formData) => {
    try {
      const { data } = await axios.post(backendUrl + "/api/receptionist/patient-insurance", formData, { headers: { rToken } });
      if (data.success) {
        toast.success(data.message);
        getReceptionistPatients();
        return data.insurance;
      }
      toast.error(data.message);
      return null;
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  };

  const verifyPatientInsurance = async (payload) => {
    try {
      const { data } = await axios.post(backendUrl + "/api/receptionist/patient-insurance-verify", payload, { headers: { rToken } });
      if (data.success) {
        toast.success(data.message);
        getReceptionistPatients();
        if (payload.appointmentId) getReceptionistAppointments();
        return data;
      }
      toast.error(data.message);
      return null;
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return null;
    }
  };

  const bookAppointmentForPatient = async (payload) => {
    try {
      const { data } = await axios.post(backendUrl + "/api/receptionist/book-appointment", payload, { headers: { rToken } });
      if (data.success) {
        toast.success(data.message);
        getReceptionistDoctors();
        getReceptionistAppointments();
        return true;
      }
      toast.error(data.message);
      return false;
    } catch (error) {
      toast.error(error.message);
      return false;
    }
  };

  const getDoctorRatings = async (docId) => {
    try {
      const { data } = await axios.get(backendUrl + `/api/receptionist/doctor-ratings/${docId}`, { headers: { rToken } });
      if (data.success) return data;
      toast.error(data.message);
      return { summary: { averageRating: 0, ratingCount: 0 }, ratings: [] };
    } catch (error) {
      toast.error(error.message);
      return { summary: { averageRating: 0, ratingCount: 0 }, ratings: [] };
    }
  };

  const updateDoctorLocations = async (docId, locations) => {
    try {
      const { data } = await axios.post(backendUrl + "/api/receptionist/doctor-locations", { docId, locations }, { headers: { rToken } });
      if (data.success) {
        toast.success(data.message);
        getReceptionistDoctors();
        return data.locations || [];
      }
      toast.error(data.message);
      return null;
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  };

  const getReceptionistProfile = async () => {
    try {
      const { data } = await axios.get(backendUrl + "/api/receptionist/profile", { headers: { rToken } });
      if (data.success) return data.receptionist;
      toast.error(data.message);
      return null;
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  };

  const refreshReceptionistNavSummary = useCallback(async () => {
    if (!rToken) {
      setReceptionistNavSummary(null);
      return;
    }
    try {
      const { data } = await axios.get(backendUrl + "/api/receptionist/profile", { headers: { rToken } });
      if (data.success && data.receptionist) {
        setReceptionistNavSummary({
          name: data.receptionist.name || "",
          image: data.receptionist.image || ""
        });
      }
    } catch (error) {
      console.log(error);
    }
  }, [rToken, backendUrl]);

  useEffect(() => {
    refreshReceptionistNavSummary();
  }, [refreshReceptionistNavSummary]);

  const updateReceptionistProfile = async (updateData) => {
    try {
      const { data } = await axios.post(backendUrl + "/api/receptionist/update-profile", updateData, { headers: { rToken } });
      if (data.success) {
        toast.success(data.message);
        return data.receptionist;
      }
      toast.error(data.message);
      return null;
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  };

  const getReceptionistMfaStatus = async () => {
    try {
      const { data } = await axios.get(backendUrl + "/api/receptionist/mfa/status", { headers: { rToken } });
      if (data.success) return data.mfa;
      return null;
    } catch (error) {
      console.log(error);
      return null;
    }
  };

  const value = {
    rToken,
    setRToken,
    backendUrl,
    receptionistNavSummary,
    refreshReceptionistNavSummary,
    appointments,
    doctors,
    patients,
    clinics,
    dashData,
    dashDataLoading,
    getReceptionistDashboard,
    getReceptionistAppointments,
    getReceptionistDoctors,
    getReceptionistPatients,
    getReceptionistPatientDetails,
    getReceptionistClinics,
    updateAppointmentStatus,
    checkInPatient,
    updatePayment,
    updateHomeVisitAddress,
    createReceptionistPatient,
    updatePatientInsurance,
    verifyPatientInsurance,
    bookAppointmentForPatient,
    getDoctorRatings,
    updateDoctorLocations,
    getReceptionistProfile,
    updateReceptionistProfile,
    getReceptionistMfaStatus,
  };

  return <ReceptionistContext.Provider value={value}>{props.children}</ReceptionistContext.Provider>;
};

export default ReceptionistContextProvider;
