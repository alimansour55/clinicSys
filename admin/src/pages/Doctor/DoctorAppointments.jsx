import React, { useContext, useEffect, useState, useMemo, useCallback } from "react";
import { DoctorContext } from "../../context/DoctorContext";
import { AppContext } from "../../context/AppContext";
import { toast } from "react-toastify";
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ArrowLeft,
  Stethoscope,
  Thermometer,
  Pill,
  Calendar,
  FileText,
  Clipboard,
  Activity,
  FileCheck,
  Phone,
  Video,
  ExternalLink,
  MapPin,
  Building2,
  Home,
  RefreshCw,
  Download,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Ban,
  CircleCheck
} from "lucide-react";
import { emptyHomeVisitAddress, formatHomeVisitAddress, supportedHomeVisitAreas } from "../../utils/homeVisitAreas";

const parseAppointmentDate = (slotDate) => {
  const parts = String(slotDate || "").split("_").map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [day, month, year] = parts;
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getRowStatus = (item) => {
  if (item.cancelled || item.appointmentStatus === "Cancelled") return "cancelled";
  if (item.isCompleted || item.appointmentStatus === "Finished") return "completed";
  return "pending";
};

const DoctorAppointments = () => {
  const { dToken, appointments, getAppointments, completeAppointment, cancelAppointment, updateHomeVisitAddress} = useContext(DoctorContext);
  const { calculateAge, slotDateFormat, currency } = useContext(AppContext);

  const [showForm, setShowForm] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [diagnosis, setDiagnosis] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [medicationItems, setMedicationItems] = useState([{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  const [instructions, setInstructions] = useState("");
  const [nextVisit, setNextVisit] = useState("");
  const [labTests, setLabTests] = useState("");
  const [documentation, setDocumentation] = useState("");
  const [homeAddressDrafts, setHomeAddressDrafts] = useState({});

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    dateRange: "all",
    payment: "all",
    type: "all",
  });
  const [sortBy, setSortBy] = useState("date_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const getAppointmentMode = (appointment) => appointment.appointmentType || "Clinic";
  const isRemoteAppointment = (appointment) => ["Voice Call", "Video Call"].includes(getAppointmentMode(appointment));
  const isHomeVisit = (appointment) => getAppointmentMode(appointment) === "Home Visit";
  const getReservationNumber = (appointment) => appointment.reservationNumber || `RES-${String(appointment._id || "").slice(-6).toUpperCase()}`;
  const getHomeAddressDraft = (appointment) => homeAddressDrafts[appointment._id] || { ...emptyHomeVisitAddress, ...(appointment.homeVisitAddress || {}) };
  const setHomeAddressDraft = (appointmentId, patch) => setHomeAddressDrafts((prev) => ({ ...prev, [appointmentId]: { ...(prev[appointmentId] || {}), ...patch } }));

  const refreshList = useCallback(async () => {
    if (!dToken) return;
    setRefreshing(true);
    try {
      await getAppointments();
    } finally {
      setRefreshing(false);
    }
  }, [dToken, getAppointments]);

  useEffect(() => {
    const fetchData = async () => {
      if (dToken) {
        setLoading(true);
        await getAppointments();
        setLoading(false);
      }
    };
    fetchData();
  }, [dToken, getAppointments]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filters, sortBy, pageSize]);

  const filteredAppointments = useMemo(() => {
    let result = [...appointments];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.userData?.patientId?.toLowerCase().includes(query) ||
          item.userData?.name?.toLowerCase().includes(query) ||
          getReservationNumber(item).toLowerCase().includes(query) ||
          String(item.userData?.phone || "")
            .toLowerCase()
            .includes(query)
      );
    }

    if (filters.status !== "all") {
      result = result.filter((item) => {
        const s = getRowStatus(item);
        if (filters.status === "pending") return s === "pending";
        if (filters.status === "completed") return s === "completed";
        if (filters.status === "cancelled") return s === "cancelled";
        return true;
      });
    }

    if (filters.payment !== "all") {
      result = result.filter((item) => {
        if (filters.payment === "paid") return item.paymentStatus === "Paid";
        if (filters.payment === "unpaid") return item.paymentStatus !== "Paid";
        return true;
      });
    }

    if (filters.type !== "all") {
      result = result.filter((item) => getAppointmentMode(item) === filters.type);
    }

    if (filters.dateRange !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      result = result.filter((item) => {
        const appointmentDate = parseAppointmentDate(item.slotDate);
        if (!appointmentDate) return false;
        appointmentDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((appointmentDate - today) / (1000 * 60 * 60 * 24));

        if (filters.dateRange === "today") return daysDiff === 0;
        if (filters.dateRange === "tomorrow") return daysDiff === 1;
        if (filters.dateRange === "week") return daysDiff >= -7 && daysDiff <= 0;
        if (filters.dateRange === "15days") return daysDiff >= -15 && daysDiff <= 0;
        if (filters.dateRange === "month") return daysDiff >= -30 && daysDiff <= 0;
        if (filters.dateRange === "upcoming7") return daysDiff >= 0 && daysDiff <= 7;
        if (filters.dateRange === "upcoming30") return daysDiff >= 0 && daysDiff <= 30;

        return true;
      });
    }

    const sorted = [...result].sort((a, b) => {
      const da = parseAppointmentDate(a.slotDate)?.getTime() ?? 0;
      const db = parseAppointmentDate(b.slotDate)?.getTime() ?? 0;
      const ta = `${a.slotTime || ""}`;
      const tb = `${b.slotTime || ""}`;
      const nameA = (a.userData?.name || "").toLowerCase();
      const nameB = (b.userData?.name || "").toLowerCase();
      const amtA = Number(a.amount || 0);
      const amtB = Number(b.amount || 0);

      if (sortBy === "date_asc") {
        if (da !== db) return da - db;
        return ta.localeCompare(tb);
      }
      if (sortBy === "date_desc") {
        if (da !== db) return db - da;
        return tb.localeCompare(ta);
      }
      if (sortBy === "amount_desc") return amtB - amtA;
      if (sortBy === "amount_asc") return amtA - amtB;
      if (sortBy === "patient_asc") return nameA.localeCompare(nameB);
      return 0;
    });

    return sorted;
  }, [appointments, searchQuery, filters, sortBy]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredAppointments.length / pageSize)),
    [filteredAppointments.length, pageSize]
  );

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pagedAppointments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAppointments.slice(start, start + pageSize);
  }, [filteredAppointments, page, pageSize]);

  const stats = useMemo(() => {
    const pending = appointments.filter((a) => getRowStatus(a) === "pending").length;
    const completed = appointments.filter((a) => getRowStatus(a) === "completed").length;
    const cancelled = appointments.filter((a) => getRowStatus(a) === "cancelled").length;
    return { pending, completed, cancelled, total: appointments.length };
  }, [appointments]);

  const handleCompleteClick = (appointment) => {
    setSelectedAppointment(appointment);
    setShowForm(true);
    setDiagnosis("");
    setSymptoms("");
    setMedicationItems([{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
    setInstructions("");
    setNextVisit("");
    setLabTests("");
    setDocumentation("");
  };

  const onSubmitHandler = async () => {
    try {
      if (!diagnosis) {
        return toast.error("Please enter diagnosis");
      }
      if (!symptoms) {
        return toast.error("Please enter symptoms");
      }
      const completeMedicationItems = medicationItems.filter((item) => item.name || item.dosage || item.frequency || item.duration || item.instructions);
      if (completeMedicationItems.length === 0) {
        return toast.error("Please add at least one medicine");
      }
      if (completeMedicationItems.some((item) => !item.name || !item.dosage || !item.frequency || !item.duration)) {
        return toast.error("Please complete medicine name, dosage, frequency, and duration");
      }
      if (!instructions) {
        return toast.error("Please enter instructions");
      }
      if (!nextVisit) {
        return toast.error("Please enter next visit date");
      }
      if (!documentation) {
        return toast.error("Please enter written documentation");
      }

      setSubmitting(true);

      const formData = { diagnosis, symptoms, medicationItems: completeMedicationItems, instructions, nextVisit, labTests, documentation};

      const success = await completeAppointment(
        selectedAppointment._id,
        formData
      );

      if (success) {
        setShowForm(false);
        setSelectedAppointment(null);
        setDiagnosis("");
        setSymptoms("");
        setMedicationItems([{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
        setInstructions("");
        setNextVisit("");
        setLabTests("");
        setDocumentation("");
      }
    } catch (error) {
      toast.error(error.message);
      console.log(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setSelectedAppointment(null);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilters({
      status: "all",
      dateRange: "all",
      payment: "all",
      type: "all",
    });
  };

  const exportFilteredCsv = () => {
    if (!filteredAppointments.length) {
      toast.info("Nothing to export for current filters.");
      return;
    }
    const headers = ["Reservation", "Patient", "Patient ID", "Phone", "Date", "Time", "Type", "Status", "Payment", "Method", "Amount"];
    const rows = filteredAppointments.map((item) => {
      const st = getRowStatus(item);
      return [
        getReservationNumber(item),
        item.userData?.name || "",
        item.userData?.patientId || "",
        item.userData?.phone || "",
        slotDateFormat(item.slotDate),
        item.slotTime || "",
        getAppointmentMode(item),
        st,
        item.paymentStatus || "",
        item.paymentMethod || "",
        String(item.amount ?? "")
      ];
    });
    const escape = (cell) => `"${String(cell).replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `appointments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export ready");
  };

  const requestCancel = (item) => setConfirmCancel(item);
  const confirmCancelAppointment = async () => {
    if (!confirmCancel) return;
    await cancelAppointment(confirmCancel._id);
    setConfirmCancel(null);
  };

  const updateMedicationItem = (index, field, value) => {
    setMedicationItems((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  const addMedicationItem = () => {
    setMedicationItems((previous) => [...previous, { name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  };

  const removeMedicationItem = (index) => {
    setMedicationItems((previous) => previous.length === 1 ? previous : previous.filter((_, itemIndex) => itemIndex !== index));
  };

  if (showForm && selectedAppointment) {
    return (
      <div className="p-3 sm:p-5 md:p-6 lg:p-8 w-full">
        <div className="max-w-4xl">
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm sm:text-base mb-6"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-medium">Back to Appointments</span>
          </button>

          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-6 md:p-8 border border-gray-200">
            <div className="mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
                Complete Appointment
              </h2>
              <p className="text-sm sm:text-base text-gray-600">
                Fill in the patient consultation details
              </p>
            </div>

            {/* Patient Information Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg sm:rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 border border-blue-100">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                <div className="relative">
                  <img className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white shadow-md" src={selectedAppointment.userData.image} alt=""/>
                </div>
                <div className="flex-1 w-full">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                    {selectedAppointment.userData.name}
                  </h3>

                  <div className="flex items-center gap-2 mb-2 sm:mb-3 mt-1">
                    <span className="text-blue-800 text-xs sm:text-sm font-semibold">
                      Reservation: {getReservationNumber(selectedAppointment)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2 sm:mb-3 mt-1">
                    <span className="text-blue-800 text-xs sm:text-sm font-semibold">
                      Patient ID: {selectedAppointment.userData.patientId}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:gap-3 mt-2">
                    <span className="inline-flex items-center gap-2 bg-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm text-gray-700 border border-gray-200 shadow-sm">
                      {slotDateFormat(selectedAppointment.slotDate)}
                    </span>
                    <span className="inline-flex items-center gap-2 bg-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm text-gray-700 border border-gray-200 shadow-sm">
                      {selectedAppointment.slotTime}
                    </span>
                    <span className="inline-flex items-center gap-2 bg-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm text-gray-700 border border-gray-200 shadow-sm">
                      Age: {calculateAge(selectedAppointment.userData.dob)}{" "}
                      years
                    </span>
                    <span className={`inline-flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm border shadow-sm ${isRemoteAppointment(selectedAppointment) ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-white text-gray-700 border-gray-200"}`}>
                      {getAppointmentMode(selectedAppointment) === "Video Call" ? <Video className="h-4 w-4" /> : getAppointmentMode(selectedAppointment) === "Voice Call" ? <Phone className="h-4 w-4" /> : isHomeVisit(selectedAppointment) ? <Home className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                      {getAppointmentMode(selectedAppointment)}
                    </span>
                    {isRemoteAppointment(selectedAppointment) && selectedAppointment.teleconsultationLink && (
                      <a href={selectedAppointment.teleconsultationLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-blue-600 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm text-white shadow-sm">
                        Start call <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  {isHomeVisit(selectedAppointment) && (
                    <div className="mt-3 rounded-lg border border-emerald-100 bg-white/80 p-3 text-sm text-emerald-800">
                      <p className="font-semibold">Home visit address</p>
                      <p className="mt-1">{formatHomeVisitAddress(selectedAppointment.homeVisitAddress) || "Address needs confirmation"}</p>
                      {selectedAppointment.homeVisitAddress?.notes && <p className="mt-1">{selectedAppointment.homeVisitAddress.notes}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Vertical Form Layout */}
            <div className="space-y-6 sm:space-y-8">
              {/* Diagnosis */}
              <div className="border-l-4 border-primary pl-4">
                <div className="flex items-center gap-3 mb-3">
                  <Stethoscope className="w-5 h-5 text-primary" />
                  <label className="block text-gray-700 font-semibold text-sm sm:text-base">
                    Diagnosis
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                </div>
                <input
                  onChange={(e) => setDiagnosis(e.target.value)}
                  value={diagnosis}
                  className="w-full border border-gray-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                  type="text"
                  placeholder="Enter disease name"
                />
                <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">
                  Enter the primary diagnosis
                </p>
              </div>

              {/* Symptoms */}
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center gap-3 mb-3">
                  <Thermometer className="w-5 h-5 text-blue-500" />
                  <label className="block text-gray-700 font-semibold text-sm sm:text-base">
                    Symptoms
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                </div>
                <textarea
                  onChange={(e) => setSymptoms(e.target.value)}
                  value={symptoms}
                  className="w-full border border-gray-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 h-32 sm:h-40"
                  placeholder="Describe all symptoms in detail..."
                />
                <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">
                  Include duration and severity of symptoms
                </p>
              </div>

              {/* Medicines */}
              <div className="border-l-4 border-green-500 pl-4">
                <div className="flex items-center gap-3 mb-3">
                  <Pill className="w-5 h-5 text-green-500" />
                  <div className="flex-1 flex items-center justify-between gap-3">
                    <label className="block text-gray-700 font-semibold text-sm sm:text-base">
                      Prescribed Medicines
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <button type="button" onClick={addMedicationItem} className="px-3 py-1.5 text-xs sm:text-sm rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
                      Add medicine
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {medicationItems.map((item, index) => (
                    <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input value={item.name} onChange={(e) => updateMedicationItem(index, "name", e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Medicine name" />
                        <input value={item.dosage} onChange={(e) => updateMedicationItem(index, "dosage", e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Dosage" />
                        <input value={item.frequency} onChange={(e) => updateMedicationItem(index, "frequency", e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Frequency" />
                        <input value={item.duration} onChange={(e) => updateMedicationItem(index, "duration", e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Duration" />
                      </div>
                      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                        <input value={item.instructions} onChange={(e) => updateMedicationItem(index, "instructions", e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Medicine instructions" />
                        <button type="button" onClick={() => removeMedicationItem(index)} disabled={medicationItems.length === 1} className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm disabled:opacity-40">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className="border-l-4 border-purple-500 pl-4">
                <div className="flex items-center gap-3 mb-3">
                  <Clipboard className="w-5 h-5 text-purple-500" />
                  <label className="block text-gray-700 font-semibold text-sm sm:text-base">
                    Patient Instructions
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                </div>
                <textarea
                  onChange={(e) => setInstructions(e.target.value)}
                  value={instructions}
                  className="w-full border border-gray-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 h-32 sm:h-40"
                  placeholder="Diet, rest, activities, precautions..."
                />
                <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">
                  Guidelines for the patient to follow
                </p>
              </div>

              {/* Next Visit */}
              <div className="border-l-4 border-yellow-500 pl-4">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="w-5 h-5 text-yellow-500" />
                  <label className="block text-gray-700 font-semibold text-sm sm:text-base">
                    Follow-up Appointment
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                </div>
                <input
                  onChange={(e) => setNextVisit(e.target.value)}
                  value={nextVisit}
                  className="w-full border border-gray-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                  type="text"
                  placeholder="e.g., After 1 week, After 3 days"
                />
                <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">
                  Specify when the patient should visit next
                </p>
              </div>

              {/* Lab Tests */}
              <div className="border-l-4 border-red-500 pl-4">
                <div className="flex items-center gap-3 mb-3">
                  <Activity className="w-5 h-5 text-red-500" />
                  <label className="block text-gray-700 font-semibold text-sm sm:text-base">
                    Recommended Lab Tests (Optional)
                  </label>
                </div>
                <textarea
                  onChange={(e) => setLabTests(e.target.value)}
                  value={labTests}
                  className="w-full border border-gray-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 h-28 sm:h-32"
                  placeholder="Enter recommended laboratory tests..."
                />
                <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">
                  Add any recommended tests for the patient
                </p>
              </div>

              {/* Documentation */}
              <div className="border-l-4 border-indigo-500 pl-4">
                <div className="flex items-center gap-3 mb-3">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  <label className="block text-gray-700 font-semibold text-sm sm:text-base">
                    Documentation
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                </div>
                <textarea
                  onChange={(e) => setDocumentation(e.target.value)}
                  value={documentation}
                  className="w-full border border-gray-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 h-28 sm:h-32"
                  placeholder="Any additional observations or special instructions..."
                />
                <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">
                  Documentation
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 ">
                <button
                  onClick={onSubmitHandler}
                  disabled={submitting} // ⭐ Add this
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 sm:py-4 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-indigo-600" // ⭐ Add disabled classes
                >
                  {submitting ? ( // ⭐ Add loading spinner
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-5 h-5" />
                      Complete Appointment
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={submitting} // ⭐ Add this
                  className="px-6 sm:px-8 py-3 sm:py-4 border-2 border-gray-300 text-gray-700 rounded-lg sm:rounded-xl text-sm sm:text-base font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" // ⭐ Add disabled classes
                >
                  Cancel
                </button>
              </div>

              <div className="mt-4 sm:mt-6 flex items-center justify-center text-xs sm:text-sm text-gray-500">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500"></div>
                </div>
                Fields marked with <span className="text-red-500 mx-1">*</span>{" "}
                are required
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-slate-50/80 p-3 sm:p-5 md:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-800 ring-1 ring-blue-200/60">
              <LayoutGrid className="h-3.5 w-3.5" />
              Schedule
            </div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              Appointments
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Search, filter, export, and manage visits. Complete visits to record clinical notes; cancel only when necessary.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => refreshList()}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportFilteredCsv}
              disabled={!filteredAppointments.length}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Search + sort */}
        <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 sm:left-4" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, patient ID, reservation, or phone…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-10 text-sm font-medium text-slate-900 outline-none ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-blue-500 sm:pl-12 sm:pr-12 sm:text-base"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:right-4"
                aria-label="Clear search"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-600 sm:max-w-xs">
              <span className="shrink-0 font-semibold text-slate-700">Sort</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date_desc">Date (newest first)</option>
                <option value="date_asc">Date (oldest first)</option>
                <option value="patient_asc">Patient A–Z</option>
                <option value="amount_desc">Fee (high → low)</option>
                <option value="amount_asc">Fee (low → high)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-700">Rows / page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={8}>8</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Advanced filters</h3>
                <button type="button" onClick={clearFilters} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                  Clear all
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Date</label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All dates</option>
                    <option value="today">Today</option>
                    <option value="tomorrow">Tomorrow</option>
                    <option value="upcoming7">Next 7 days</option>
                    <option value="upcoming30">Next 30 days</option>
                    <option value="week">Past 7 days</option>
                    <option value="15days">Past 15 days</option>
                    <option value="month">Past 30 days</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Payment</label>
                  <select
                    value={filters.payment}
                    onChange={(e) => setFilters({ ...filters, payment: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Not paid</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Visit type</label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All types</option>
                    <option value="Clinic">Clinic</option>
                    <option value="Voice Call">Voice call</option>
                    <option value="Video Call">Video call</option>
                    <option value="Home Visit">Home visit</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-900">
                    “{searchQuery}”
                    <button type="button" onClick={() => setSearchQuery("")} className="rounded p-0.5 hover:bg-blue-200" aria-label="Remove search">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {filters.status !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                    {filters.status}
                    <button type="button" onClick={() => setFilters({ ...filters, status: "all" })} className="rounded p-0.5 hover:bg-amber-200" aria-label="Clear status">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {filters.dateRange !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-900">
                    {filters.dateRange === "today"
                      ? "Today"
                      : filters.dateRange === "tomorrow"
                        ? "Tomorrow"
                        : filters.dateRange === "week"
                          ? "Past 7d"
                          : filters.dateRange === "15days"
                            ? "Past 15d"
                            : filters.dateRange === "month"
                              ? "Past 30d"
                              : filters.dateRange === "upcoming7"
                                ? "Next 7d"
                                : filters.dateRange === "upcoming30"
                                  ? "Next 30d"
                                  : filters.dateRange}
                    <button type="button" onClick={() => setFilters({ ...filters, dateRange: "all" })} className="rounded p-0.5 hover:bg-violet-200" aria-label="Clear date filter">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {filters.payment !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                    {filters.payment}
                    <button type="button" onClick={() => setFilters({ ...filters, payment: "all" })} className="rounded p-0.5 hover:bg-emerald-200" aria-label="Clear payment filter">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {filters.type !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-800">
                    {filters.type}
                    <button type="button" onClick={() => setFilters({ ...filters, type: "all" })} className="rounded p-0.5 hover:bg-slate-300" aria-label="Clear type filter">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{stats.total}</p>
            <p className="mt-1 text-xs text-slate-500">In your practice</p>
          </div>
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/90 p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Pending</p>
            <p className="mt-1 text-2xl font-black text-amber-950">{stats.pending}</p>
            <p className="mt-1 text-xs text-amber-800/80">Action required</p>
          </div>
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/90 p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Completed</p>
            <p className="mt-1 text-2xl font-black text-emerald-950">{stats.completed}</p>
            <p className="mt-1 text-xs text-emerald-800/80">Closed visits</p>
          </div>
          <div className="rounded-2xl border border-rose-200/70 bg-rose-50/90 p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-rose-800">Cancelled</p>
            <p className="mt-1 text-2xl font-black text-rose-950">{stats.cancelled}</p>
            <p className="mt-1 text-xs text-rose-800/80">Did not occur</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-blue-200/80 bg-blue-50/80 p-4 shadow-sm sm:col-span-1 lg:col-span-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-800">Matching list</p>
            <p className="mt-1 text-2xl font-black text-blue-950">{filteredAppointments.length}</p>
            <p className="mt-1 text-xs text-blue-800/80">After search & filters</p>
          </div>
        </div>

        {/* Appointments Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-xs shadow-sm sm:text-sm max-h-[70vh] min-h-[40vh] overflow-y-auto overflow-x-auto sm:max-h-[78vh] sm:min-h-[44vh]">
          <div className="hidden lg:grid grid-cols-[0.5fr_2fr_1fr_0.5fr_1.5fr_1fr_1fr] gap-1 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6 sticky top-0 z-10">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">#</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Patient</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Patient ID</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Age</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Date & time</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Fees</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Action</p>
          </div>

          {loading ? (
            // Loading Skeleton
            <>
              {/* Mobile Skeleton */}
              <div className="lg:hidden">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-3 sm:p-4 border-b animate-pulse">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-200 rounded-full flex-shrink-0"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                      </div>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <div className="h-6 bg-gray-200 rounded w-20"></div>
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                      <div className="h-6 bg-gray-200 rounded w-12"></div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <div className="h-8 bg-gray-200 rounded w-20"></div>
                      <div className="h-8 bg-gray-200 rounded w-24"></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Skeleton */}
              <div className="hidden lg:block">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[0.5fr_2fr_1fr_0.5fr_1.5fr_1fr_1fr] gap-1 py-4 px-6 border-b animate-pulse"
                  >
                    <div className="h-4 bg-gray-200 rounded w-6"></div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                    <div className="h-4 bg-gray-200 rounded w-8"></div>
                    <div className="h-4 bg-gray-200 rounded w-36"></div>
                    <div className="h-4 bg-gray-200 rounded w-12"></div>
                    <div className="flex gap-1">
                      <div className="w-10 h-10 bg-gray-200 rounded"></div>
                      <div className="w-10 h-10 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : filteredAppointments.length === 0 ? (
            <div className="py-12 sm:py-16 text-center px-4">
              <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                <Search className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-gray-700 mb-2">
                No appointments found
              </h3>
              <p className="text-xs sm:text-sm text-gray-500">
                {searchQuery
                  ? "Try adjusting your search or filters"
                  : "No appointments scheduled yet"}
              </p>
              {(searchQuery || filters.status !== "all" || filters.dateRange !== "all" || filters.payment !== "all" || filters.type !== "all") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            pagedAppointments.map((item, index) => {
              const rowNum = (page - 1) * pageSize + index + 1;
              return (
              <div
                className="flex flex-col border-b border-slate-100 py-3 text-slate-600 transition hover:bg-slate-50/90 sm:py-4 px-3 sm:px-4 lg:grid lg:grid-cols-[0.5fr_2fr_1fr_0.5fr_1.5fr_1fr_1fr] lg:items-center lg:gap-1 lg:px-6"
                key={item._id}
              >
                {/* Mobile Card Layout */}
                <div className="lg:hidden w-full">
                  <div className="flex items-start gap-3 mb-3">
                    <img
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover flex-shrink-0"
                      src={item.userData.image}
                      alt=""
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm sm:text-base mb-1">
                        {item.userData.name}
                      </p>
                      <p className="text-xs font-semibold text-blue-700 mb-1">
                        Reservation: {getReservationNumber(item)}
                      </p>
                      <p className="text-xs text-gray-500 mb-1">
                        ID: {item.userData.patientId}
                      </p>
                      <p className="text-xs text-gray-500">
                        Age: {calculateAge(item.userData.dob)} years
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {slotDateFormat(item.slotDate)}
                    </span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {item.slotTime}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">
                      {currency}{Number(item.amount || 0).toLocaleString()}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${item.paymentStatus === "Paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {item.paymentStatus || "Not Paid"}{item.paymentMethod ? ` - ${item.paymentMethod}` : ""}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${isRemoteAppointment(item) ? "bg-sky-100 text-sky-700" : "bg-gray-100 text-gray-700"}`}>
                      {getAppointmentMode(item)}
                    </span>
                    {isRemoteAppointment(item) && item.teleconsultationLink && (
                      <a href={item.teleconsultationLink} target="_blank" rel="noreferrer" className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                        Start call
                      </a>
                    )}
                    {isHomeVisit(item) && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                        {formatHomeVisitAddress(item.homeVisitAddress) || "Home address missing"}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-end">
                    {getRowStatus(item) === "cancelled" ? (
                      <p className="text-red-500 text-xs font-medium px-3 py-1.5 bg-red-50 rounded-full">
                        Cancelled
                      </p>
                    ) : getRowStatus(item) === "completed" ? (
                      <p className="text-green-600 text-xs font-medium px-3 py-1.5 bg-green-50 rounded-full">
                        Completed
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => requestCancel(item)}
                          className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCompleteClick(item)}
                          className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                        >
                          <CircleCheck className="h-3.5 w-3.5" />
                          Complete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Desktop Grid Layout */}
                <p className="hidden tabular-nums text-slate-500 lg:block">{rowNum}</p>
                <div className="hidden lg:flex items-center gap-2">
                  <img className="w-8 sm:w-9 md:w-10 h-8 sm:h-9 md:h-10 rounded-full object-cover" src={item.userData.image} alt=""/>
                  <div className="min-w-0">
                    <p className="truncate">{item.userData.name}</p>
                    <p className="truncate text-[11px] font-semibold text-blue-700">{getReservationNumber(item)}</p>
                  </div>
                </div>
                <p className="hidden lg:block truncate">
                  {item.userData.patientId}
                </p>
                <p className="hidden lg:block">
                  {calculateAge(item.userData.dob)}
                </p>
                <p className="hidden lg:block text-xs xl:text-sm">
                  {slotDateFormat(item.slotDate)}, {item.slotTime}
                  <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isRemoteAppointment(item) ? "bg-sky-50 text-sky-700" : "bg-gray-100 text-gray-700"}`}>
                    {getAppointmentMode(item) === "Video Call" ? <Video className="h-3 w-3" /> : getAppointmentMode(item) === "Voice Call" ? <Phone className="h-3 w-3" /> : isHomeVisit(item) ? <Home className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                    {getAppointmentMode(item)}
                  </span>
                  {isRemoteAppointment(item) && item.teleconsultationLink && (
                    <a href={item.teleconsultationLink} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                      Start call
                    </a>
                  )}
                </p>
                <div className="hidden lg:block">
                  <p className="font-semibold text-slate-900">{currency}{Number(item.amount || 0).toLocaleString()}</p>
                  <p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.paymentStatus === "Paid" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                    {item.paymentStatus || "Not Paid"}{item.paymentMethod ? ` - ${item.paymentMethod}` : ""}
                  </p>
                  {item.refundStatus && item.refundStatus !== "Not Refunded" && (
                    <p className="mt-1 text-[11px] text-blue-700">{item.refundStatus}</p>
                  )}
                </div>
                <div className="hidden lg:block">
                  {isHomeVisit(item) && (() => {
                    const addressDraft = getHomeAddressDraft(item);
                    return (
                      <div className="mb-2 rounded-lg border border-emerald-100 bg-emerald-50 p-2">
                        <p className="mb-1 text-[11px] font-bold text-emerald-800">Home address</p>
                        <select value={addressDraft.area} onChange={(e) => setHomeAddressDraft(item._id, { area: e.target.value })} className="mb-1 w-full rounded border px-2 py-1 text-[11px]">
                          <option value="">Area</option>
                          {supportedHomeVisitAreas.map((area) => <option key={area} value={area}>{area}</option>)}
                        </select>
                        <input value={addressDraft.street} onChange={(e) => setHomeAddressDraft(item._id, { street: e.target.value })} className="mb-1 w-full rounded border px-2 py-1 text-[11px]" placeholder="Street" />
                        <button type="button" onClick={() => updateHomeVisitAddress(item._id, addressDraft)} className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white">Save</button>
                      </div>
                    );
                  })()}
                  {getRowStatus(item) === "cancelled" ? (
                    <p className="inline-block rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600">
                      Cancelled
                    </p>
                  ) : getRowStatus(item) === "completed" ? (
                    <p className="inline-block rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      Completed
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => requestCancel(item)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100"
                        title="Cancel appointment"
                        aria-label="Cancel appointment"
                      >
                        <Ban className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCompleteClick(item)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 transition hover:bg-emerald-100"
                        title="Complete appointment"
                        aria-label="Complete appointment"
                      >
                        <CircleCheck className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              );
            })
          )}
        </div>

        {filteredAppointments.length > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row sm:px-6">
            <p className="font-medium text-slate-700">
              Page <span className="tabular-nums text-slate-900">{page}</span> of <span className="tabular-nums text-slate-900">{totalPages}</span>
              <span className="mx-2 text-slate-300">·</span>
              <span className="tabular-nums">{filteredAppointments.length}</span> total
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {confirmCancel && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-appt-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setConfirmCancel(null);
            }}
          >
            <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h2 id="cancel-appt-title" className="text-lg font-bold text-slate-900">
                Cancel appointment?
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                This will mark the visit as cancelled for{" "}
                <strong>{confirmCancel.userData?.name}</strong> ({getReservationNumber(confirmCancel)}).
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setConfirmCancel(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Keep appointment
                </button>
                <button type="button" onClick={confirmCancelAppointment} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-rose-700">
                  Yes, cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorAppointments;
