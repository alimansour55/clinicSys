import React, { useContext, useEffect, useMemo, useState } from "react";
import { Building2, CalendarPlus, CreditCard, FileUp, Home, MapPin, Phone, Plus, Save, Search, UserPlus, Video, X } from "lucide-react";
import { toast } from "react-toastify";
import { ReceptionistContext } from "../../context/ReceptionistContext";
import { AppContext } from "../../context/AppContext";
import { buildDoctorSlots } from "../../utils/schedule";
import { RatingBadge, RatingsList, StarRow } from "../../components/DoctorRating";
import { emptyHomeVisitAddress, supportedHomeVisitAreas } from "../../utils/homeVisitAreas";

const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const today = new Date().toISOString().split("T")[0];

const ReceptionistBookAppointment = () => {
  const { rToken, doctors, patients, getReceptionistDoctors, getReceptionistPatients, bookAppointmentForPatient, createReceptionistPatient, updatePatientInsurance, getDoctorRatings, updateDoctorLocations } = useContext(ReceptionistContext);
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
  const [ratingsData, setRatingsData] = useState({ summary: { averageRating: 0, ratingCount: 0 }, ratings: [] });
  const [showRatings, setShowRatings] = useState(false);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [clinicLocation, setClinicLocation] = useState("");
  const [appointmentType, setAppointmentType] = useState("Clinic");
  const [homeVisitAddress, setHomeVisitAddress] = useState(emptyHomeVisitAddress);
  const [editingLocations, setEditingLocations] = useState(false);
  const [locationDrafts, setLocationDrafts] = useState([""]);

  useEffect(() => {
    if (rToken) {
      getReceptionistDoctors();
      getReceptionistPatients();
    }
  }, [rToken]);

  const selectedDoctor = useMemo(() => doctors.find((doctor) => doctor._id === docId), [doctors, docId]);
  const doctorLocations = useMemo(() => {
    if (!selectedDoctor) return [];
    const locations = selectedDoctor.locations?.length
      ? selectedDoctor.locations
      : (selectedDoctor.clinics || []).map((clinic) => clinic.name || clinic);
    return locations.filter(Boolean);
  }, [selectedDoctor]);
  const filteredPatients = useMemo(() => {
    const query = patientSearch.toLowerCase().trim();
    return patients.filter((patient) => !query || patient.name?.toLowerCase().includes(query) || patient.patientId?.toLowerCase().includes(query) || patient.email?.toLowerCase().includes(query));
  }, [patients, patientSearch]);

  const handleDoctorChange = (doctorId) => {
    const doctor = doctors.find((item) => item._id === doctorId);
    setDocId(doctorId);
    setSlotIndex(null);
    setSlotTime("");
    setShowRatings(false);
    setClinicLocation("");
    setAppointmentType("Clinic");
    setHomeVisitAddress(emptyHomeVisitAddress);
    setEditingLocations(false);
    setLocationDrafts(doctor?.locations?.length ? doctor.locations : [""]);
    setDocSlots(buildDoctorSlots(doctor));
  };

  useEffect(() => {
    if (doctorLocations.length === 1) setClinicLocation(doctorLocations[0]);
  }, [doctorLocations]);

  useEffect(() => {
    const loadRatings = async () => {
      if (!docId) {
        setRatingsData({ summary: { averageRating: 0, ratingCount: 0 }, ratings: [] });
        return;
      }
      setRatingsLoading(true);
      const data = await getDoctorRatings(docId);
      setRatingsData(data);
      setRatingsLoading(false);
    };
    loadRatings();
  }, [docId]);

  const handleBook = async () => {
    if (!patientId) return toast.warn("Please choose a patient");
    if (!docId) return toast.warn("Please choose a doctor");
    if (slotIndex === null) return toast.warn("Please choose a day");
    if (!slotTime) return toast.warn("Please choose a time");
    if (appointmentType === "Clinic" && doctorLocations.length > 1 && !clinicLocation) return toast.warn("Please choose clinic location");
    if (appointmentType === "Home Visit" && (!homeVisitAddress.area || !homeVisitAddress.street.trim())) return toast.warn("Please choose an area and enter street name and number");

    const date = docSlots[slotIndex].dateTime;
    const slotDate = `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`;

    setIsBooking(true);
    const success = await bookAppointmentForPatient({ patientId, docId, slotDate, slotTime, clinicLocation, appointmentType, homeVisitAddress });
    if (success) {
      getReceptionistDoctors();
      setPatientId("");
      setDocId("");
      setPatientSearch("");
      setDocSlots([]);
      setSlotIndex(null);
      setSlotTime("");
      setAppointmentType("Clinic");
      setClinicLocation("");
      setHomeVisitAddress(emptyHomeVisitAddress);
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

  const saveDoctorLocations = async () => {
    if (!docId) return;
    const saved = await updateDoctorLocations(docId, locationDrafts.map((location) => location.trim()).filter(Boolean));
    if (saved) {
      setLocationDrafts(saved.length ? saved : [""]);
      setClinicLocation(saved.length === 1 ? saved[0] : "");
      setEditingLocations(false);
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
              <div className="mt-4 rounded-lg bg-gray-50 border p-4">
                <div className="flex items-center gap-3">
                <div className="relative">
                  <img src={selectedDoctor.image} alt="" className="w-14 h-14 rounded-full object-cover bg-gray-200" />
                  <RatingBadge summary={selectedDoctor.ratingSummary || ratingsData.summary} className="absolute -left-2 -top-2" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{selectedDoctor.name}</p>
                  <p className="text-sm text-gray-500">{selectedDoctor.speciality} - {currency} {selectedDoctor.fees}</p>
                  <button type="button" onClick={() => setShowRatings((value) => !value)} className="mt-2 inline-flex items-center gap-2 rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                    <StarRow value={ratingsData.summary?.averageRating || selectedDoctor.ratingSummary?.averageRating} />
                    {showRatings ? "Hide ratings" : "Show ratings"}
                  </button>
                </div>
                </div>
                <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-3">
                  <p className="mb-3 text-sm font-semibold text-gray-800">Appointment type</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {[
                      { value: "Clinic", label: "In clinic", icon: Building2 },
                      { value: "Voice Call", label: "Voice call", icon: Phone },
                      { value: "Video Call", label: "Video call", icon: Video },
                      { value: "Home Visit", label: "Home visit", icon: Home }
                    ].map((option) => {
                      const Icon = option.icon;
                      return (
                        <button key={option.value} type="button" onClick={() => setAppointmentType(option.value)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${appointmentType === option.value ? "border-primary bg-white text-primary" : "border-sky-200 bg-white/70 text-gray-700"}`}>
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {appointmentType === "Clinic" && (
                <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      Clinic locations
                    </p>
                    <button type="button" onClick={() => setEditingLocations((value) => !value)} className="text-xs font-semibold text-blue-700">
                      {editingLocations ? "Cancel" : "Edit"}
                    </button>
                  </div>
                  {editingLocations ? (
                    <div className="mt-3 space-y-2">
                      {locationDrafts.map((location, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input value={location} onChange={(e) => setLocationDrafts((prev) => prev.map((item, itemIndex) => itemIndex === index ? e.target.value : item))} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g., Mohandseen" />
                          {locationDrafts.length > 1 && <button type="button" onClick={() => setLocationDrafts((prev) => prev.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg border border-red-200 p-2 text-red-600"><X className="h-4 w-4" /></button>}
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setLocationDrafts((prev) => [...prev, ""])} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-blue-700">
                          <Plus className="h-4 w-4" />
                          Add
                        </button>
                        <button type="button" onClick={saveDoctorLocations} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
                          <Save className="h-4 w-4" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : doctorLocations.length > 1 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {doctorLocations.map((location) => (
                        <button key={location} type="button" onClick={() => setClinicLocation(location)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${clinicLocation === location ? "border-primary bg-white text-primary" : "border-blue-200 bg-white/70 text-gray-700"}`}>
                          {location}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-600">{doctorLocations[0] || "No locations added yet"}</p>
                  )}
                </div>
                )}
                {appointmentType === "Home Visit" && (
                  <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <Home className="h-4 w-4 text-emerald-600" />
                      Home visit address
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <select value={homeVisitAddress.area} onChange={(e) => setHomeVisitAddress((prev) => ({ ...prev, area: e.target.value }))} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm">
                        <option value="">Choose supported area</option>
                        {supportedHomeVisitAreas.map((area) => <option key={area} value={area}>{area}</option>)}
                      </select>
                      <input value={homeVisitAddress.street} onChange={(e) => setHomeVisitAddress((prev) => ({ ...prev, street: e.target.value }))} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm" placeholder="Street name and number" />
                      <input value={homeVisitAddress.building} onChange={(e) => setHomeVisitAddress((prev) => ({ ...prev, building: e.target.value }))} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm" placeholder="Building" />
                      <input value={homeVisitAddress.floor} onChange={(e) => setHomeVisitAddress((prev) => ({ ...prev, floor: e.target.value }))} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm" placeholder="Floor" />
                      <input value={homeVisitAddress.apartment} onChange={(e) => setHomeVisitAddress((prev) => ({ ...prev, apartment: e.target.value }))} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm" placeholder="Apartment" />
                      <input value={homeVisitAddress.notes} onChange={(e) => setHomeVisitAddress((prev) => ({ ...prev, notes: e.target.value }))} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm" placeholder="Landmark or notes" />
                    </div>
                    <p className="mt-2 text-xs text-emerald-700">Only the listed Cairo, Giza, and nearby areas are supported.</p>
                  </div>
                )}
                {showRatings && (
                  <div className="mt-4">
                    {ratingsLoading ? <p className="text-sm text-gray-500">Loading ratings...</p> : <RatingsList ratings={ratingsData.ratings} />}
                  </div>
                )}
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
              <input type="date" max={today} value={newPatient.dob} onChange={(e) => setNewPatient((p) => ({ ...p, dob: e.target.value }))} className="border rounded-lg px-3 py-2.5" />
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
                <input type="date" max={today} value={newPatient.insuranceBirthDate} onChange={(e) => setNewPatient((p) => ({ ...p, insuranceBirthDate: e.target.value }))} className="border rounded-lg px-3 py-2.5" />
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
            <input type="date" max={today} value={insuranceForm.birthDate} onChange={(e) => setInsuranceForm((p) => ({ ...p, birthDate: e.target.value }))} className="border rounded-lg px-3 py-2.5" />
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
