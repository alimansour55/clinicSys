import React, { useContext, useEffect, useMemo, useState } from "react";
import { CalendarPlus, CreditCard, FileUp, Search, UserPlus } from "lucide-react";
import { toast } from "react-toastify";
import { ReceptionistContext } from "../../context/ReceptionistContext";
import { AppContext } from "../../context/AppContext";
import { buildDoctorSlots } from "../../utils/schedule";

const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const ReceptionistBookAppointment = () => {
  const { rToken, doctors, patients, getReceptionistDoctors, getReceptionistPatients, bookAppointmentForPatient, createReceptionistPatient, updatePatientInsurance } = useContext(ReceptionistContext);
  const { currency } = useContext(AppContext);
  const [docId, setDocId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [docSlots, setDocSlots] = useState([]);
  const [slotIndex, setSlotIndex] = useState(null);
  const [slotTime, setSlotTime] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: "", email: "", phone: "", dob: "", gender: "Not Selected", password: "", insuranceEnabled: false, insuranceFullName: "", insuranceBirthDate: "", insuranceIdNumber: "", insuranceExpiryDate: "" });
  const [newPatientCard, setNewPatientCard] = useState(null);
  const [insurancePatientId, setInsurancePatientId] = useState("");
  const [insuranceForm, setInsuranceForm] = useState({ enabled: true, fullName: "", birthDate: "", idNumber: "", expiryDate: "" });
  const [insuranceCard, setInsuranceCard] = useState(null);

  useEffect(() => {
    if (rToken) {
      getReceptionistDoctors();
      getReceptionistPatients();
    }
  }, [rToken]);

  const selectedDoctor = useMemo(() => doctors.find((doctor) => doctor._id === docId), [doctors, docId]);
  const filteredPatients = useMemo(() => {
    const query = patientSearch.toLowerCase().trim();
    return patients.filter((patient) => !query || patient.name?.toLowerCase().includes(query) || patient.patientId?.toLowerCase().includes(query) || patient.email?.toLowerCase().includes(query));
  }, [patients, patientSearch]);

  const handleDoctorChange = (doctorId) => {
    const doctor = doctors.find((item) => item._id === doctorId);
    setDocId(doctorId);
    setSlotIndex(null);
    setSlotTime("");
    setDocSlots(buildDoctorSlots(doctor));
  };

  const handleBook = async () => {
    if (!patientId) return toast.warn("Please choose a patient");
    if (!docId) return toast.warn("Please choose a doctor");
    if (slotIndex === null) return toast.warn("Please choose a day");
    if (!slotTime) return toast.warn("Please choose a time");

    const date = docSlots[slotIndex].dateTime;
    const slotDate = `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`;

    setIsBooking(true);
    const success = await bookAppointmentForPatient({ patientId, docId, slotDate, slotTime });
    if (success) {
      getReceptionistDoctors();
      setPatientId("");
      setDocId("");
      setPatientSearch("");
      setDocSlots([]);
      setSlotIndex(null);
      setSlotTime("");
    }
    setIsBooking(false);
  };

  const handleCreatePatient = async () => {
    const formData = new FormData();
    Object.entries(newPatient).forEach(([key, value]) => formData.append(key, value));
    formData.append("insuranceEnabled", newPatient.insuranceEnabled);
    formData.append("insuranceFullName", newPatient.insuranceFullName);
    formData.append("insuranceBirthDate", newPatient.insuranceBirthDate);
    formData.append("insuranceIdNumber", newPatient.insuranceIdNumber);
    formData.append("insuranceExpiryDate", newPatient.insuranceExpiryDate);
    if (newPatientCard) formData.append("insuranceCardPhoto", newPatientCard);

    const patient = await createReceptionistPatient(formData);
    if (patient) {
      setPatientId(patient._id);
      setShowNewPatient(false);
      setNewPatient({ name: "", email: "", phone: "", dob: "", gender: "Not Selected", password: "", insuranceEnabled: false, insuranceFullName: "", insuranceBirthDate: "", insuranceIdNumber: "", insuranceExpiryDate: "" });
      setNewPatientCard(null);
    }
  };

  const handleSaveExistingInsurance = async () => {
    if (!insurancePatientId) return toast.warn("Please choose a patient");
    const formData = new FormData();
    formData.append("patientId", insurancePatientId);
    formData.append("insuranceEnabled", insuranceForm.enabled);
    formData.append("insuranceFullName", insuranceForm.fullName);
    formData.append("insuranceBirthDate", insuranceForm.birthDate);
    formData.append("insuranceIdNumber", insuranceForm.idNumber);
    formData.append("insuranceExpiryDate", insuranceForm.expiryDate);
    if (insuranceCard) formData.append("insuranceCardPhoto", insuranceCard);
    const saved = await updatePatientInsurance(formData);
    if (saved) {
      setInsurancePatientId("");
      setInsuranceForm({ enabled: true, fullName: "", birthDate: "", idNumber: "", expiryDate: "" });
      setInsuranceCard(null);
    }
  };

  return (
    <div className="w-full p-3 sm:p-5 md:p-6 lg:p-8">
      <div className="max-w-6xl">
        <div className="mb-6">
          <h1 className="text-xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <CalendarPlus className="w-6 h-6 text-primary" />
            Book Appointment
          </h1>
          <p className="text-sm text-gray-600 mt-1 ml-8">Choose a patient, doctor, and available time slot</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
          <div className="bg-white border rounded-lg p-5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="block text-sm font-semibold text-gray-700">Find Patient</label>
              <button onClick={() => setShowNewPatient((value) => !value)} className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                <UserPlus className="w-4 h-4" />
                New Patient
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} className="w-full border rounded-lg pl-10 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search name, ID, or email" />
            </div>
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500" size={8}>
              {filteredPatients.map((patient) => <option key={patient._id} value={patient._id}>{patient.name} - {patient.patientId} - {patient.phone}</option>)}
            </select>
          </div>

          <div className="bg-white border rounded-lg p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Doctor</label>
            <select value={docId} onChange={(e) => handleDoctorChange(e.target.value)} className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select doctor</option>
              {doctors.map((doctor) => <option key={doctor._id} value={doctor._id}>{doctor.name} - {doctor.speciality}</option>)}
            </select>

            {selectedDoctor && (
              <div className="mt-4 rounded-lg bg-gray-50 border p-4 flex items-center gap-3">
                <img src={selectedDoctor.image} alt="" className="w-14 h-14 rounded-full object-cover bg-gray-200" />
                <div>
                  <p className="font-semibold text-gray-800">{selectedDoctor.name}</p>
                  <p className="text-sm text-gray-500">{selectedDoctor.speciality} - {currency} {selectedDoctor.fees}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {showNewPatient && (
          <div className="bg-white border rounded-lg p-5 mt-5">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-600" /> Add New Patient</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input value={newPatient.name} onChange={(e) => setNewPatient((p) => ({ ...p, name: e.target.value }))} placeholder="Full Name *" className="border rounded-lg px-3 py-2.5" />
              <input value={newPatient.email} onChange={(e) => setNewPatient((p) => ({ ...p, email: e.target.value }))} placeholder="Email *" className="border rounded-lg px-3 py-2.5" />
              <input value={newPatient.phone} onChange={(e) => setNewPatient((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone Number *" className="border rounded-lg px-3 py-2.5" />
              <input type="date" value={newPatient.dob} onChange={(e) => setNewPatient((p) => ({ ...p, dob: e.target.value }))} className="border rounded-lg px-3 py-2.5" />
              <select value={newPatient.gender} onChange={(e) => setNewPatient((p) => ({ ...p, gender: e.target.value }))} className="border rounded-lg px-3 py-2.5">
                <option value="Not Selected">Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <input type="password" value={newPatient.password} onChange={(e) => setNewPatient((p) => ({ ...p, password: e.target.value }))} placeholder="Temporary password *" className="border rounded-lg px-3 py-2.5" />
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={newPatient.insuranceEnabled} onChange={(e) => setNewPatient((p) => ({ ...p, insuranceEnabled: e.target.checked }))} className="accent-primary" />
              Add Insurance
            </label>
            {newPatient.insuranceEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
                <input value={newPatient.insuranceFullName} onChange={(e) => setNewPatient((p) => ({ ...p, insuranceFullName: e.target.value }))} placeholder="Insurance Full Name *" className="border rounded-lg px-3 py-2.5" />
                <input type="date" value={newPatient.insuranceBirthDate} onChange={(e) => setNewPatient((p) => ({ ...p, insuranceBirthDate: e.target.value }))} className="border rounded-lg px-3 py-2.5" />
                <input value={newPatient.insuranceIdNumber} onChange={(e) => setNewPatient((p) => ({ ...p, insuranceIdNumber: e.target.value }))} placeholder="ID Number *" className="border rounded-lg px-3 py-2.5" />
                <input type="date" value={newPatient.insuranceExpiryDate} onChange={(e) => setNewPatient((p) => ({ ...p, insuranceExpiryDate: e.target.value }))} className="border rounded-lg px-3 py-2.5" />
                <label className="flex items-center gap-2 border border-dashed rounded-lg px-3 py-2.5 text-sm cursor-pointer">
                  <FileUp className="w-4 h-4" />
                  <span className="truncate">{newPatientCard ? newPatientCard.name : "Medical Card *"}</span>
                  <input type="file" accept="image/*,.pdf" onChange={(e) => setNewPatientCard(e.target.files?.[0] || null)} hidden />
                </label>
              </div>
            )}
            <button onClick={handleCreatePatient} className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white">Save Patient</button>
          </div>
        )}

        <div className="bg-white border rounded-lg p-5 mt-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-emerald-600" /> Add Insurance for Existing Patient</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <select value={insurancePatientId} onChange={(e) => setInsurancePatientId(e.target.value)} className="border rounded-lg px-3 py-2.5 md:col-span-2">
              <option value="">Select patient</option>
              {patients.map((patient) => <option key={patient._id} value={patient._id}>{patient.name} - {patient.patientId}</option>)}
            </select>
            <input value={insuranceForm.fullName} onChange={(e) => setInsuranceForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="Full Name *" className="border rounded-lg px-3 py-2.5" />
            <input type="date" value={insuranceForm.birthDate} onChange={(e) => setInsuranceForm((p) => ({ ...p, birthDate: e.target.value }))} className="border rounded-lg px-3 py-2.5" />
            <input value={insuranceForm.idNumber} onChange={(e) => setInsuranceForm((p) => ({ ...p, idNumber: e.target.value }))} placeholder="ID Number *" className="border rounded-lg px-3 py-2.5" />
            <input type="date" value={insuranceForm.expiryDate} onChange={(e) => setInsuranceForm((p) => ({ ...p, expiryDate: e.target.value }))} className="border rounded-lg px-3 py-2.5" />
          </div>
          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <label className="flex items-center gap-2 border border-dashed rounded-lg px-3 py-2.5 text-sm cursor-pointer">
              <FileUp className="w-4 h-4" />
              <span className="truncate">{insuranceCard ? insuranceCard.name : "Attach medical card"}</span>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setInsuranceCard(e.target.files?.[0] || null)} hidden />
            </label>
            <button onClick={handleSaveExistingInsurance} className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white">Save Insurance</button>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-5 mt-5">
          <p className="font-semibold text-gray-700 mb-4">Available Slots</p>
          {selectedDoctor ? (
            <>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {docSlots.map((day, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSlotIndex(slotIndex === index ? null : index);
                      setSlotTime("");
                    }}
                    disabled={day.slots.length === 0}
                    className={`min-w-16 rounded-full px-4 py-4 text-sm font-medium disabled:opacity-40 disabled:bg-gray-100 disabled:text-gray-500 ${slotIndex === index ? "bg-primary text-white" : "border border-gray-200 text-gray-700"}`}
                  >
                    <p>{daysOfWeek[day.dateTime.getDay()]}</p>
                    <p>{day.dateTime.getDate()}</p>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 overflow-x-auto mt-4 pb-2">
                {slotIndex !== null && docSlots[slotIndex].slots.map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => setSlotTime(slotTime === slot.time ? "" : slot.time)}
                    disabled={!slot.available}
                    title={slot.reason}
                    className={`flex-shrink-0 rounded-full border px-5 py-2 text-sm ${
                      slot.time === slotTime
                        ? "bg-primary text-white border-primary"
                        : slot.available
                          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    }`}
                  >
                    {slot.time.toLowerCase()}
                  </button>
                ))}
                {slotIndex !== null && docSlots[slotIndex].slots.length === 0 && (
                  <p className="text-sm text-gray-500">No slots are configured for this day.</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Select a doctor to see available times.</p>
          )}

          <button onClick={handleBook} disabled={isBooking} className="mt-6 rounded-full bg-primary px-10 py-3 text-sm font-semibold text-white disabled:bg-gray-400">
            {isBooking ? "Booking..." : "Book Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceptionistBookAppointment;
