import { createContext, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

export const ReceptionistContext = createContext();

const ReceptionistContextProvider = (props) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const [rToken, setRToken] = useState(localStorage.getItem("rToken") ? localStorage.getItem("rToken") : "");
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [dashData, setDashData] = useState(false);

  const getReceptionistDashboard = async () => {
    try {
      const { data } = await axios.get(backendUrl + "/api/receptionist/dashboard", { headers: { rToken } });
      if (data.success) setDashData(data.dashData);
      else toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
    }
  };

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
      if (data.success) setDoctors(data.doctors);
      else toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
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
        getReceptionistAppointments();
        getReceptionistDashboard();
      } else toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
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
      toast.error(error.message);
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

  const value = {
    rToken,
    setRToken,
    backendUrl,
    appointments,
    doctors,
    patients,
    dashData,
    getReceptionistDashboard,
    getReceptionistAppointments,
    getReceptionistDoctors,
    getReceptionistPatients,
    updateAppointmentStatus,
    checkInPatient,
    updatePayment,
    createReceptionistPatient,
    updatePatientInsurance,
    bookAppointmentForPatient,
  };

  return <ReceptionistContext.Provider value={value}>{props.children}</ReceptionistContext.Provider>;
};

export default ReceptionistContextProvider;
