import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import {
  Building2,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileUp,
  Home,
  MapPin,
  Phone,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import { ReceptionistContext } from "../../context/ReceptionistContext";
import { AppContext } from "../../context/AppContext";
import { buildDoctorSlots, slotDateForCalendarOffset } from "../../utils/schedule";
import { usesClinicWeeklySchedule } from "../../utils/doctorBooking";
import { RatingBadge, RatingsList, StarRow } from "../../components/DoctorRating";
import { doctorOffersHomeVisit, emptyHomeVisitAddress, getDoctorHomeVisitAreas } from "../../utils/homeVisitAreas";
import { computeDoctorPromoDiscountAmount, computeHomeVisitSurcharge, getHomeVisitFeeLabel, normalizeHomeVisitPricing, percentageDiscountAmount } from "../../utils/promoPricing";
import { readCachedPublicSiteSettings } from "../../utils/siteSettingsCache";
import InsuranceVerificationPanel from "../../components/InsuranceVerificationPanel";
import InsuranceStatusBadge from "../../components/InsuranceStatusBadge";
import { getInsuranceStatus, INSURANCE_STATUS } from "../../utils/insuranceVerification";

const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const today = new Date().toISOString().split("T")[0];

/** Mirrors backend booking: promo + optional insurance % of list price + home visit surcharge */
const computeBookingPricing = (doctor, insurancePct, appointmentType = "Clinic", homeVisitPricing) => {
  const hvPricing = normalizeHomeVisitPricing(homeVisitPricing);
  const base = Number(doctor?.fees || 0);
  const pct = Math.min(100, Math.max(0, Number(insurancePct) || 0));
  const insuranceDiscount = pct > 0 ? percentageDiscountAmount(base, pct) : 0;
  const promo = doctor?.promoCode || {};
  let promoDiscount = 0;
  let promoCode = "";
  let promoReason = "";
  if (promo.active && promo.code) {
    promoDiscount = computeDoctorPromoDiscountAmount(base, promo);
    promoCode = String(promo.code || "").trim().toUpperCase();
    promoReason = `Promo code ${promoCode}`;
  }
  const baseMinor = Math.round(Math.max(0, base) * 100);
  const promoMinor = Math.round(promoDiscount * 100);
  const insMinor = Math.round(insuranceDiscount * 100);
  const totalDiscountMinor = Math.min(baseMinor, promoMinor + insMinor);
  const totalDiscount = totalDiscountMinor / 100;
  let discountReason = "";
  if (insuranceDiscount > 0 && promoDiscount > 0) discountReason = `${promoReason}; Insurance coverage (${pct}%)`;
  else if (insuranceDiscount > 0) discountReason = `Insurance coverage (${pct}%)`;
  else if (promoDiscount > 0) discountReason = promoReason;
  const consultAmount = Math.max(0, (baseMinor - totalDiscountMinor) / 100);
  const homeVisitSurcharge = appointmentType === "Home Visit" ? computeHomeVisitSurcharge(base, hvPricing) : 0;
  return {
    base,
    promoDiscount,
    insuranceDiscount,
    totalDiscount,
    consultAmount,
    homeVisitSurcharge,
    amount: consultAmount + homeVisitSurcharge,
    discountReason,
    promoCode,
  };
};

const ReceptionistBookAppointment = () => {
  const {
    rToken,
    backendUrl,
    doctors,
    patients,
    getReceptionistDoctors,
    getReceptionistPatients,
    bookAppointmentForPatient,
    createReceptionistPatient,
    updatePatientInsurance,
    verifyPatientInsurance,
    getDoctorRatings,
    updateDoctorLocations,
  } = useContext(ReceptionistContext);
  const { currency, t, slotDateFormat } = useContext(AppContext);
  const [searchParams] = useSearchParams();

  const [docId, setDocId] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [slotIndex, setSlotIndex] = useState(null);
  const [slotTime, setSlotTime] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [showAdminTools, setShowAdminTools] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    gender: "Not Selected",
    password: "",
    insuranceEnabled: false,
    insuranceProvider: "",
    insuranceFullName: "",
    insuranceBirthDate: "",
    insuranceIdNumber: "",
    insuranceExpiryDate: "",
  });
  const [newPatientCard, setNewPatientCard] = useState(null);
  const [insurancePatientId, setInsurancePatientId] = useState("");
  const [insuranceForm, setInsuranceForm] = useState({ enabled: true, provider: "", fullName: "", birthDate: "", idNumber: "", expiryDate: "" });
  const [insuranceCard, setInsuranceCard] = useState(null);
  const [insuranceProvidersList, setInsuranceProvidersList] = useState([]);
  const [deskIns, setDeskIns] = useState({ enabled: false, provider: "", fullName: "", birthDate: "", idNumber: "", expiryDate: "" });
  const [deskInsCard, setDeskInsCard] = useState(null);
  const [ratingsData, setRatingsData] = useState({ summary: { averageRating: 0, ratingCount: 0 }, ratings: [] });
  const [showRatings, setShowRatings] = useState(false);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [clinicLocation, setClinicLocation] = useState("");
  /** Branch where the current slotTime was chosen (for multi-branch hold). */
  const [slotBranch, setSlotBranch] = useState("");
  const [appointmentType, setAppointmentType] = useState("Clinic");
  const [homeVisitAddress, setHomeVisitAddress] = useState(emptyHomeVisitAddress);
  const [editingLocations, setEditingLocations] = useState(false);
  const [locationDrafts, setLocationDrafts] = useState([""]);
  const [insuranceCoveragePercent, setInsuranceCoveragePercent] = useState(0);
  const [insuranceVisitStatus, setInsuranceVisitStatus] = useState("");
  const [insuranceVisitNote, setInsuranceVisitNote] = useState("");
  const [insuranceVerifySaving, setInsuranceVerifySaving] = useState(false);
  const [homeVisitPricingSettings, setHomeVisitPricingSettings] = useState(() =>
    normalizeHomeVisitPricing(readCachedPublicSiteSettings()?.homeVisitPricing)
  );
  const slotsSectionRef = useRef(null);
  const prevPatientDoctorRef = useRef({ patientId: "", docId: "" });

  useEffect(() => {
    if (rToken) {
      getReceptionistDoctors();
      getReceptionistPatients();
    }
  }, [rToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [insRes, siteRes] = await Promise.all([
          axios.get(`${backendUrl}/api/user/insurance-providers`),
          axios.get(`${backendUrl}/api/user/site-settings`),
        ]);
        if (!cancelled && insRes.data.success && Array.isArray(insRes.data.providers)) {
          setInsuranceProvidersList(insRes.data.providers);
        }
        if (!cancelled && siteRes.data.success && siteRes.data.settings?.homeVisitPricing) {
          setHomeVisitPricingSettings(normalizeHomeVisitPricing(siteRes.data.settings.homeVisitPricing));
        }
      } catch {
        if (!cancelled) setInsuranceProvidersList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backendUrl]);

  useEffect(() => {
    const prefill = searchParams.get("patient");
    if (!prefill || !patients.length) return;
    if (patients.some((patient) => patient._id === prefill)) {
      setPatientId(prefill);
    }
  }, [searchParams, patients]);

  const selectedDoctor = useMemo(() => doctors.find((doctor) => doctor._id === docId), [doctors, docId]);
  const selectedPatient = useMemo(() => patients.find((patient) => patient._id === patientId), [patients, patientId]);

  useEffect(() => {
    if (!patientId || !selectedPatient) {
      setDeskIns({ enabled: false, provider: "", fullName: "", birthDate: "", idNumber: "", expiryDate: "" });
      setDeskInsCard(null);
      return;
    }
    const ins = selectedPatient.insurance || {};
    if (ins.enabled) {
      setDeskIns({
        enabled: true,
        provider: ins.provider || "",
        fullName: ins.fullName || "",
        birthDate: ins.birthDate || "",
        idNumber: ins.idNumber || "",
        expiryDate: ins.expiryDate || "",
      });
    } else {
      setDeskIns({ enabled: false, provider: "", fullName: "", birthDate: "", idNumber: "", expiryDate: "" });
    }
    setDeskInsCard(null);
    setInsuranceVisitStatus("");
    setInsuranceVisitNote("");
  }, [patientId, selectedPatient]);

  const doctorHomeVisitAreas = useMemo(
    () => (selectedDoctor ? getDoctorHomeVisitAreas(selectedDoctor) : []),
    [selectedDoctor]
  );
  const homeVisitAvailable = useMemo(
    () => Boolean(selectedDoctor && doctorOffersHomeVisit(selectedDoctor)),
    [selectedDoctor]
  );
  const voiceCallAvailable = selectedDoctor?.available && selectedDoctor?.acceptsVoiceCall !== false;
  const videoCallAvailable = selectedDoctor?.available && selectedDoctor?.acceptsVideoCall !== false;
  const isAppointmentTypeAvailable = (type) => {
    if (type === "Voice Call") return voiceCallAvailable;
    if (type === "Video Call") return videoCallAvailable;
    if (type === "Home Visit") return homeVisitAvailable;
    return true;
  };
  const fallbackAppointmentType =
    appointmentType === "Video Call" && voiceCallAvailable
      ? "Voice Call"
      : appointmentType === "Voice Call" && videoCallAvailable
        ? "Video Call"
        : "Clinic";
  const activeAppointmentType = isAppointmentTypeAvailable(appointmentType) ? appointmentType : fallbackAppointmentType;
  const pricingPreview = useMemo(
    () => computeBookingPricing(selectedDoctor, insuranceCoveragePercent, activeAppointmentType, homeVisitPricingSettings),
    [selectedDoctor, insuranceCoveragePercent, activeAppointmentType, homeVisitPricingSettings]
  );
  const homeVisitFeeLabel = useMemo(
    () => getHomeVisitFeeLabel(homeVisitPricingSettings, t, currency),
    [homeVisitPricingSettings, t, currency]
  );

  useEffect(() => {
    if (!homeVisitAddress.area) return;
    if (!doctorHomeVisitAreas.includes(homeVisitAddress.area)) {
      setHomeVisitAddress((prev) => ({ ...prev, area: "" }));
    }
  }, [docId, doctorHomeVisitAreas, homeVisitAddress.area]);
  const doctorLocations = useMemo(() => {
    if (!selectedDoctor) return [];
    const locations = selectedDoctor.locations?.length
      ? selectedDoctor.locations
      : (selectedDoctor.clinics || []).map((clinic) => clinic.name || clinic);
    return locations.filter(Boolean);
  }, [selectedDoctor]);
  const selectedClinicLocation = clinicLocation || (doctorLocations.length === 1 ? doctorLocations[0] : "");
  const crossBranchHold = useMemo(() => {
    if (!usesClinicWeeklySchedule(activeAppointmentType) || doctorLocations.length < 2 || slotIndex === null || !slotTime || !slotBranch) return null;
    return {
      slotDate: slotDateForCalendarOffset(slotIndex),
      slotTime,
      sourceLocation: slotBranch,
    };
  }, [activeAppointmentType, doctorLocations.length, slotIndex, slotTime, slotBranch]);

  const docSlots = useMemo(
    () => (selectedDoctor ? buildDoctorSlots(selectedDoctor, 31, activeAppointmentType, selectedClinicLocation, crossBranchHold) : []),
    [selectedDoctor, activeAppointmentType, selectedClinicLocation, crossBranchHold]
  );
  const selectedDay = slotIndex !== null ? docSlots[slotIndex] : null;

  const filteredPatients = useMemo(() => {
    const query = patientSearch.toLowerCase().trim();
    return patients.filter((patient) => {
      if (!query) return true;
      const blob = [patient.name, patient.patientId, patient.phone, patient.email].filter(Boolean).join(" ").toLowerCase();
      return blob.includes(query);
    });
  }, [patients, patientSearch]);

  const filteredDoctors = useMemo(() => {
    const query = doctorSearch.toLowerCase().trim();
    return doctors.filter((doctor) => {
      if (!query) return true;
      const blob = [doctor.name, doctor.speciality, doctor.email].filter(Boolean).join(" ").toLowerCase();
      return blob.includes(query);
    });
  }, [doctors, doctorSearch]);

  const handleDoctorChange = (doctorId) => {
    const doctor = doctors.find((item) => item._id === doctorId);
    setDocId(doctorId);
    setSlotIndex(null);
    setSlotTime("");
    setShowRatings(false);
    setClinicLocation("");
    setSlotBranch("");
    setAppointmentType("Clinic");
    setHomeVisitAddress(emptyHomeVisitAddress);
    setEditingLocations(false);
    setLocationDrafts(doctor?.locations?.length ? doctor.locations : [""]);
    setInsuranceCoveragePercent(0);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable API from context
  }, [docId]);

  /** Step 2 grows tall after doctor pick; align columns to top and scroll to slots when both are chosen. */
  useEffect(() => {
    if (!patientId || !docId) {
      prevPatientDoctorRef.current = { patientId: patientId || "", docId: docId || "" };
      return;
    }
    const prev = prevPatientDoctorRef.current;
    if (prev.patientId === patientId && prev.docId === docId) return;
    prevPatientDoctorRef.current = { patientId, docId };
    const el = slotsSectionRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [patientId, docId]);

  const handleBook = async () => {
    if (!patientId) return toast.warn(t("Please choose a patient"));
    if (!docId) return toast.warn(t("Please choose a doctor"));
    if (slotIndex === null) return toast.warn(t("Please choose a day"));
    if (!slotTime) return toast.warn(t("Please choose a time"));
    const bookingClinicLocation =
      usesClinicWeeklySchedule(activeAppointmentType) && slotBranch ? slotBranch : selectedClinicLocation;
    if (usesClinicWeeklySchedule(activeAppointmentType) && doctorLocations.length > 0 && !bookingClinicLocation)
      return toast.warn(t("Please choose clinic location"));
    if (activeAppointmentType === "Home Visit" && (!homeVisitAddress.area || !homeVisitAddress.street.trim()))
      return toast.warn(t("Please choose an area and enter street name and number"));

    const patientHasInsurance = Boolean(selectedPatient?.insurance?.enabled);
    const needsVisitCheck = patientHasInsurance || insuranceCoveragePercent > 0;
    if (needsVisitCheck && !["approved", "declined"].includes(insuranceVisitStatus)) {
      return toast.warn(t("Please confirm insurance status for this visit before booking."));
    }
    if (needsVisitCheck && insuranceVisitStatus === "declined" && !insuranceVisitNote.trim()) {
      return toast.warn(t("Please provide a reason when declining insurance for this visit."));
    }

    const date = docSlots[slotIndex].dateTime;
    const slotDate = `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`;

    setIsBooking(true);
    const success = await bookAppointmentForPatient({
      patientId,
      docId,
      slotDate,
      slotTime,
      clinicLocation: bookingClinicLocation,
      appointmentType: activeAppointmentType,
      homeVisitAddress,
      insuranceCoveragePercent,
      insuranceVisitStatus: needsVisitCheck ? insuranceVisitStatus : "",
      insuranceVisitNote: needsVisitCheck ? insuranceVisitNote : "",
    });
    if (success) {
      getReceptionistDoctors();
      setPatientId("");
      setDocId("");
      setPatientSearch("");
      setDoctorSearch("");
      setSlotIndex(null);
      setSlotTime("");
      setSlotBranch("");
      setAppointmentType("Clinic");
      setClinicLocation("");
      setHomeVisitAddress(emptyHomeVisitAddress);
      setInsuranceCoveragePercent(0);
      setInsuranceVisitStatus("");
      setInsuranceVisitNote("");
    }
    setIsBooking(false);
  };

  const handleBookingInsuranceVerify = async (payload) => {
    if (payload.visitStatus) {
      setInsuranceVisitStatus(payload.visitStatus);
      setInsuranceVisitNote(payload.insuranceVisitNote || payload.declineReason || "");
      if (payload.visitStatus === "approved" && getInsuranceStatus(selectedPatient?.insurance) === INSURANCE_STATUS.PENDING) {
        setInsuranceVerifySaving(true);
        await verifyPatientInsurance({
          patientId,
          status: "approved",
        });
        setInsuranceVerifySaving(false);
      }
      return;
    }
    if (!patientId) return;
    setInsuranceVerifySaving(true);
    await verifyPatientInsurance({
      patientId,
      status: payload.status,
      declineReason: payload.declineReason,
    });
    setInsuranceVerifySaving(false);
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
      setNewPatient({
        name: "",
        email: "",
        phone: "",
        dob: "",
        gender: "Not Selected",
        password: "",
        insuranceEnabled: false,
        insuranceProvider: "",
        insuranceFullName: "",
        insuranceBirthDate: "",
        insuranceIdNumber: "",
        insuranceExpiryDate: "",
      });
      setNewPatientCard(null);
    }
  };

  const handleSaveExistingInsurance = async () => {
    if (!insurancePatientId) return toast.warn(t("Please choose a patient"));
    const formData = new FormData();
    formData.append("patientId", insurancePatientId);
    formData.append("insuranceEnabled", insuranceForm.enabled);
    formData.append("insuranceProvider", insuranceForm.provider);
    formData.append("insuranceFullName", insuranceForm.fullName);
    formData.append("insuranceBirthDate", insuranceForm.birthDate);
    formData.append("insuranceIdNumber", insuranceForm.idNumber);
    formData.append("insuranceExpiryDate", insuranceForm.expiryDate);
    if (insuranceCard) formData.append("insuranceCardPhoto", insuranceCard);
    const saved = await updatePatientInsurance(formData);
    if (saved) {
      setInsurancePatientId("");
      setInsuranceForm({ enabled: true, provider: "", fullName: "", birthDate: "", idNumber: "", expiryDate: "" });
      setInsuranceCard(null);
    }
  };

  const handleSaveDeskInsurance = async () => {
    if (!patientId) return toast.warn(t("Please choose a patient"));
    if (deskIns.enabled) {
      if (!deskIns.provider) return toast.warn(t("Please select an insurance provider"));
      if (!deskIns.fullName.trim() || !deskIns.birthDate || !deskIns.idNumber.trim() || !deskIns.expiryDate) {
        return toast.warn(t("Please complete all insurance fields"));
      }
      if (!deskInsCard && !selectedPatient?.insurance?.medicalCardPhoto) {
        return toast.warn(t("Please attach a photo of the medical card"));
      }
    }
    const formData = new FormData();
    formData.append("patientId", patientId);
    formData.append("insuranceEnabled", deskIns.enabled);
    formData.append("insuranceProvider", deskIns.provider);
    formData.append("insuranceFullName", deskIns.fullName);
    formData.append("insuranceBirthDate", deskIns.birthDate);
    formData.append("insuranceIdNumber", deskIns.idNumber);
    formData.append("insuranceExpiryDate", deskIns.expiryDate);
    if (deskInsCard) formData.append("insuranceCardPhoto", deskInsCard);
    const saved = await updatePatientInsurance(formData);
    if (saved) {
      setDeskInsCard(null);
      getReceptionistPatients();
    }
  };

  const saveDoctorLocations = async () => {
    if (!docId) return;
    const saved = await updateDoctorLocations(
      docId,
      locationDrafts.map((location) => location.trim()).filter(Boolean)
    );
    if (saved) {
      setLocationDrafts(saved.length ? saved : [""]);
      setClinicLocation(saved.length === 1 ? saved[0] : "");
      setEditingLocations(false);
    }
  };

  const steps = [
    { key: "patient", label: t("Patient"), done: Boolean(selectedPatient) },
    { key: "doctor", label: t("Doctor"), done: Boolean(selectedDoctor) },
    { key: "slot", label: t("Slot"), done: Boolean(slotTime) },
  ];
  const currentStepIndex = steps.findIndex((s) => !s.done);

  const slotDateLabel =
    selectedDay && slotTime
      ? `${slotDateFormat(`${selectedDay.dateTime.getDate()}_${selectedDay.dateTime.getMonth() + 1}_${selectedDay.dateTime.getFullYear()}`)} · ${slotTime}`
      : null;

  return (
    <div className="w-full min-w-0 overflow-x-hidden bg-gradient-to-b from-slate-50 to-white p-3 sm:p-5 lg:p-8">
      <div className="mx-auto min-w-0 max-w-[1600px] space-y-6">
        {/* Hero */}
        <header className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-6 bg-gradient-to-r from-slate-900 via-slate-800 to-primary/90 p-6 text-white sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/90 ring-1 ring-white/20">
                <CalendarPlus className="h-3.5 w-3.5" />
                {t("Reception desk")}
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("Book appointment")}</h1>
              <p className="mt-2 max-w-xl text-sm text-white/80">{t("Select patient and doctor, preview fees including insurance, then confirm the slot.")}</p>
            </div>
            <div className="flex w-full min-w-0 max-w-md flex-col gap-2 rounded-xl bg-white/10 p-3 ring-1 ring-white/15 sm:flex-row">
              {steps.map((step, i) => {
                const isCurrent = i === currentStepIndex;
                return (
                <div
                  key={step.key}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${
                    step.done
                      ? "bg-emerald-500/20 text-emerald-100"
                      : isCurrent
                        ? "bg-sky-500/30 text-white ring-2 ring-white/35"
                        : "bg-white/5 text-white/70"
                  }`}
                >
                  {step.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" /> : <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px]">{i + 1}</span>}
                  <span className="truncate">{step.label}</span>
                </div>
              );
              })}
            </div>
          </div>
        </header>

        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 space-y-6">
            {/* Step 1 + 2 */}
            <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
              {/* Patient */}
              <section className="h-fit min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t("Step")} 1</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">{t("Find patient")}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewPatient((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-95"
                  >
                    <UserPlus className="h-4 w-4" />
                    {t("New Patient")}
                  </button>
                </div>
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
                    placeholder={t("Search name, patient ID, phone, or email")}
                  />
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {filteredPatients.length > 0 ? (
                    filteredPatients.map((patient) => (
                      <button
                        key={patient._id}
                        type="button"
                        onClick={() => setPatientId(patient._id)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                          patientId === patient._id ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {patient.image ? (
                          <img src={patient.image} alt="" className="h-11 w-11 shrink-0 rounded-full bg-slate-100 object-cover ring-2 ring-white" />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 ring-2 ring-white">
                            {(patient.name || "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{patient.name}</p>
                          <p className="truncate text-xs text-slate-500">
                            {patient.patientId || t("No patient ID")} · {patient.phone || "—"}
                          </p>
                          {patient.email && <p className="mt-0.5 truncate text-xs text-slate-400">{patient.email}</p>}
                        </div>
                        {patientId === patient._id && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                      </button>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
                      <p className="font-semibold text-slate-800">{t("No patient found")}</p>
                      <p className="mt-1 text-sm text-slate-500">{t("Create a new patient to continue booking.")}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Doctor */}
              <section className="h-fit min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t("Step")} 2</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">{t("Choose doctor")}</h2>
                </div>
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
                    placeholder={t("Search doctor or speciality")}
                  />
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {filteredDoctors.map((doctor) => (
                    <button
                      key={doctor._id}
                      type="button"
                      onClick={() => handleDoctorChange(doctor._id)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                        docId === doctor._id ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <img src={doctor.image} alt="" className="h-11 w-11 shrink-0 rounded-full bg-slate-100 object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">{doctor.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {doctor.speciality} · {currency}
                          {doctor.fees}
                        </p>
                      </div>
                      {docId === doctor._id && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                    </button>
                  ))}
                </div>

                {selectedDoctor && (
                  <div className="mt-4 min-w-0 space-y-4 border-t border-slate-100 pt-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="relative shrink-0">
                        <img src={selectedDoctor.image} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-slate-100" />
                        <RatingBadge summary={selectedDoctor.ratingSummary || ratingsData.summary} className="absolute -left-1 -top-1" />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="break-words font-semibold text-slate-900">{selectedDoctor.name}</p>
                        <p className="break-words text-sm text-slate-500">{selectedDoctor.speciality}</p>
                        <button
                          type="button"
                          onClick={() => setShowRatings((v) => !v)}
                          className="mt-2 inline-flex max-w-full min-w-0 flex-wrap items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-100"
                        >
                          <StarRow value={ratingsData.summary?.averageRating || selectedDoctor.ratingSummary?.averageRating} />
                          <span className="min-w-0 truncate">{showRatings ? t("Hide ratings") : t("Show ratings")}</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{t("Visit type")}</p>
                      <div className="grid min-w-0 grid-cols-2 gap-2">
                        {[
                          { value: "Clinic", label: t("In clinic"), icon: Building2 },
                          { value: "Voice Call", label: t("Voice call"), icon: Phone },
                          { value: "Video Call", label: t("Video call"), icon: Video },
                          { value: "Home Visit", label: t("Home visit"), icon: Home },
                        ].map((option) => {
                          const disabled = !isAppointmentTypeAvailable(option.value);
                          const Icon = option.icon;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              disabled={disabled}
                              title={disabled ? t("Not available for this doctor") : option.label}
                              onClick={() => {
                                if (disabled) return;
                                setAppointmentType(option.value);
                                setSlotIndex(null);
                                setSlotTime("");
                                setSlotBranch("");
                              }}
                              className={`flex min-w-0 items-center gap-2 overflow-hidden rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
                                disabled
                                  ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                                  : activeAppointmentType === option.value
                                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-primary/40"
                              }`}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 truncate">{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {usesClinicWeeklySchedule(activeAppointmentType) && (
                      <div className="min-w-0 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
                        <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
                          <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-800">
                            <MapPin className="h-4 w-4 shrink-0 text-sky-600" />
                            <span className="truncate">{t("Clinic locations")}</span>
                          </p>
                          <button type="button" onClick={() => setEditingLocations((v) => !v)} className="text-xs font-bold text-sky-700 hover:underline">
                            {editingLocations ? t("Cancel") : t("Edit")}
                          </button>
                        </div>
                        {editingLocations ? (
                          <div className="space-y-2">
                            {locationDrafts.map((location, index) => (
                              <div key={index} className="flex min-w-0 gap-2">
                                <input
                                  value={location}
                                  onChange={(e) => setLocationDrafts((prev) => prev.map((item, i) => (i === index ? e.target.value : item)))}
                                  className="h-10 min-w-0 flex-1 rounded-lg border border-sky-200 bg-white px-3 text-sm outline-none"
                                  placeholder={t("e.g. Mohandseen")}
                                />
                                {locationDrafts.length > 1 && (
                                  <button type="button" onClick={() => setLocationDrafts((prev) => prev.filter((_, i) => i !== index))} className="rounded-lg border border-rose-200 p-2 text-rose-600">
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => setLocationDrafts((prev) => [...prev, ""])} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-sky-800">
                                <Plus className="h-4 w-4" />
                                {t("Add")}
                              </button>
                              <button type="button" onClick={saveDoctorLocations} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white">
                                <Save className="h-4 w-4" />
                                {t("Save")}
                              </button>
                            </div>
                          </div>
                        ) : doctorLocations.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {doctorLocations.map((location) => {
                              const previewSlots = buildDoctorSlots(selectedDoctor, 7, activeAppointmentType, location, crossBranchHold);
                              const availableCount = previewSlots.reduce((sum, day) => sum + day.slots.filter((s) => s.available).length, 0);
                              return (
                                <button
                                  key={location}
                                  type="button"
                                  onClick={() => {
                                    setClinicLocation(location);
                                    setSlotIndex(null);
                                    setSlotTime("");
                                    setSlotBranch("");
                                  }}
                                  className={`max-w-full min-w-0 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                                    selectedClinicLocation === location ? "border-primary bg-white text-primary shadow-sm" : "border-sky-200 bg-white/80 text-slate-700 hover:border-primary/40"
                                  }`}
                                >
                                  <span className="block break-words">{location}</span>
                                  <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
                                    {availableCount} {t("slots this week")}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600">{doctorLocations[0] || t("No locations added yet")}</p>
                        )}
                      </div>
                    )}

                    {activeAppointmentType === "Home Visit" && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-900">
                          <Home className="h-4 w-4" />
                          {t("Home visit address")}
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <select
                            value={homeVisitAddress.area}
                            onChange={(e) => setHomeVisitAddress((prev) => ({ ...prev, area: e.target.value }))}
                            className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm"
                          >
                            <option value="">{t("Choose supported area")}</option>
                            {doctorHomeVisitAreas.map((area) => (
                              <option key={area} value={area}>
                                {area}
                              </option>
                            ))}
                          </select>
                          <input
                            value={homeVisitAddress.street}
                            onChange={(e) => setHomeVisitAddress((prev) => ({ ...prev, street: e.target.value }))}
                            className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm"
                            placeholder={t("Street name and number")}
                          />
                          <input
                            value={homeVisitAddress.building}
                            onChange={(e) => setHomeVisitAddress((prev) => ({ ...prev, building: e.target.value }))}
                            className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm"
                            placeholder={t("Building")}
                          />
                          <input
                            value={homeVisitAddress.floor}
                            onChange={(e) => setHomeVisitAddress((prev) => ({ ...prev, floor: e.target.value }))}
                            className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm"
                            placeholder={t("Floor")}
                          />
                          <input
                            value={homeVisitAddress.apartment}
                            onChange={(e) => setHomeVisitAddress((prev) => ({ ...prev, apartment: e.target.value }))}
                            className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm"
                            placeholder={t("Apt")}
                          />
                          <input
                            value={homeVisitAddress.notes}
                            onChange={(e) => setHomeVisitAddress((prev) => ({ ...prev, notes: e.target.value }))}
                            className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm sm:col-span-2"
                            placeholder={t("Landmark or notes")}
                          />
                        </div>
                        <p className="mt-2 text-xs text-emerald-800">{t("Only the listed Cairo, Giza, and nearby areas are supported.")}</p>
                      </div>
                    )}

                    {showRatings && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        {ratingsLoading ? <p className="text-sm text-slate-500">{t("Loading ratings...")}</p> : <RatingsList ratings={ratingsData.ratings} />}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>

            {showNewPatient && (
              <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <UserPlus className="h-5 w-5 text-primary" />
                    {t("Add New Patient")}
                  </h3>
                  <button type="button" onClick={() => setShowNewPatient(false)} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-800">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <input value={newPatient.name} onChange={(e) => setNewPatient((p) => ({ ...p, name: e.target.value }))} placeholder={t("Full Name *")} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                  <input value={newPatient.email} onChange={(e) => setNewPatient((p) => ({ ...p, email: e.target.value }))} placeholder={t("Email *")} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                  <input value={newPatient.phone} onChange={(e) => setNewPatient((p) => ({ ...p, phone: e.target.value }))} placeholder={t("Phone Number *")} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                  <input type="date" max={today} value={newPatient.dob} onChange={(e) => setNewPatient((p) => ({ ...p, dob: e.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                  <select value={newPatient.gender} onChange={(e) => setNewPatient((p) => ({ ...p, gender: e.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                    <option value="Not Selected">{t("Prefer not to say")}</option>
                    <option value="Male">{t("Male")}</option>
                    <option value="Female">{t("Female")}</option>
                  </select>
                  <input type="password" value={newPatient.password} onChange={(e) => setNewPatient((p) => ({ ...p, password: e.target.value }))} placeholder={t("Temporary password *")} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={newPatient.insuranceEnabled} onChange={(e) => setNewPatient((p) => ({ ...p, insuranceEnabled: e.target.checked }))} className="accent-primary" />
                  {t("Add Insurance")}
                </label>
                {newPatient.insuranceEnabled && (
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <select
                      value={newPatient.insuranceProvider}
                      onChange={(e) => setNewPatient((p) => ({ ...p, insuranceProvider: e.target.value }))}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm md:col-span-2"
                    >
                      <option value="">{t("Insurance provider")}</option>
                      {insuranceProvidersList.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <input value={newPatient.insuranceFullName} onChange={(e) => setNewPatient((p) => ({ ...p, insuranceFullName: e.target.value }))} placeholder={t("Insurance Full Name *")} className="h-10 rounded-xl border px-3 text-sm" />
                    <input type="date" max={today} value={newPatient.insuranceBirthDate} onChange={(e) => setNewPatient((p) => ({ ...p, insuranceBirthDate: e.target.value }))} className="h-10 rounded-xl border px-3 text-sm" />
                    <input value={newPatient.insuranceIdNumber} onChange={(e) => setNewPatient((p) => ({ ...p, insuranceIdNumber: e.target.value }))} placeholder={t("ID Number *")} className="h-10 rounded-xl border px-3 text-sm" />
                    <input type="date" value={newPatient.insuranceExpiryDate} onChange={(e) => setNewPatient((p) => ({ ...p, insuranceExpiryDate: e.target.value }))} className="h-10 rounded-xl border px-3 text-sm" />
                    <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed px-3 text-sm md:col-span-2">
                      <FileUp className="h-4 w-4 shrink-0" />
                      <span className="truncate">{newPatientCard ? newPatientCard.name : t("Medical Card *")}</span>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => setNewPatientCard(e.target.files?.[0] || null)} hidden />
                    </label>
                  </div>
                )}
                <button type="button" onClick={handleCreatePatient} className="mt-4 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm">
                  {t("Save Patient")}
                </button>
              </section>
            )}

            {/* Step 3 slots */}
            <section ref={slotsSectionRef} className="scroll-mt-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex min-w-0 flex-wrap items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t("Step")} 3</p>
                  <h2 className="mt-1 break-words text-lg font-bold text-slate-900">{activeAppointmentType === "Home Visit" ? t("Home visit slots") : t("Available slots")}</h2>
                </div>
                {selectedDay && <p className="shrink-0 text-sm font-semibold text-primary">{daysOfWeek[selectedDay.dateTime.getDay()]} {selectedDay.dateTime.getDate()}</p>}
              </div>
              {selectedDoctor ? (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {docSlots.map((day, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setSlotIndex(slotIndex === index ? null : index);
                          setSlotTime("");
                          setSlotBranch("");
                        }}
                        disabled={day.slots.length === 0}
                        className={`min-w-[4.5rem] shrink-0 rounded-2xl border-2 px-3 py-3 text-center text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          slotIndex === index ? "border-primary bg-primary text-white shadow-lg" : "border-slate-200 bg-white text-slate-700 hover:border-primary/50 hover:bg-slate-50"
                        }`}
                      >
                        <p className="text-[11px] font-semibold uppercase opacity-80">{daysOfWeek[day.dateTime.getDay()]}</p>
                        <p className="text-lg">{day.dateTime.getDate()}</p>
                        <p className="mt-1 text-[10px] font-medium opacity-90">{day.slots.filter((s) => s.available).length}</p>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex min-h-12 flex-wrap gap-2">
                    {slotIndex !== null &&
                      docSlots[slotIndex].slots.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => {
                            const next = slotTime === slot.time ? "" : slot.time;
                            setSlotTime(next);
                            if (!next) setSlotBranch("");
                            else setSlotBranch(selectedClinicLocation);
                          }}
                          disabled={!slot.available}
                          title={slot.reason}
                          className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${
                            slot.time === slotTime
                              ? "border-primary bg-primary text-white shadow-md"
                              : slot.available
                                ? "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                                : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    {slotIndex !== null && docSlots[slotIndex].slots.length === 0 && (
                      <p className="text-sm text-slate-500">
                        {activeAppointmentType === "Home Visit" ? t("No home visit slots are configured for this day.") : t("No slots are configured for this day.")}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
                  <Clock className="mb-2 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">{t("Select a doctor to see available times.")}</p>
                </div>
              )}
            </section>

            {/* Admin tools — collapsed by default */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setShowAdminTools((v) => !v)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-2 font-bold text-slate-900">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  {t("Patient & insurance admin")}
                </span>
                <ChevronRight className={`h-5 w-5 text-slate-400 transition ${showAdminTools ? "rotate-90" : ""}`} />
              </button>
              {showAdminTools && (
                <div className="space-y-6 border-t border-slate-100 px-5 pb-6 pt-4">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                    <h3 className="mb-3 flex items-center gap-2 font-bold text-emerald-950">
                      <CreditCard className="h-5 w-5 text-emerald-600" />
                      {t("Add Insurance for Existing Patient")}
                    </h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                      <select value={insurancePatientId} onChange={(e) => setInsurancePatientId(e.target.value)} className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm md:col-span-2">
                        <option value="">{t("Select patient")}</option>
                        {patients.map((patient) => (
                          <option key={patient._id} value={patient._id}>
                            {patient.name} - {patient.patientId}
                          </option>
                        ))}
                      </select>
                      <select
                        value={insuranceForm.provider}
                        onChange={(e) => setInsuranceForm((p) => ({ ...p, provider: e.target.value }))}
                        className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm md:col-span-2"
                      >
                        <option value="">{t("Insurance provider")}</option>
                        {insuranceProvidersList.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <input value={insuranceForm.fullName} onChange={(e) => setInsuranceForm((p) => ({ ...p, fullName: e.target.value }))} placeholder={t("Full Name *")} className="h-10 rounded-lg border px-3 text-sm md:col-span-2" />
                      <input type="date" max={today} value={insuranceForm.birthDate} onChange={(e) => setInsuranceForm((p) => ({ ...p, birthDate: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
                      <input value={insuranceForm.idNumber} onChange={(e) => setInsuranceForm((p) => ({ ...p, idNumber: e.target.value }))} placeholder={t("ID Number *")} className="h-10 rounded-lg border px-3 text-sm" />
                      <input type="date" value={insuranceForm.expiryDate} onChange={(e) => setInsuranceForm((p) => ({ ...p, expiryDate: e.target.value }))} className="h-10 rounded-lg border px-3 text-sm" />
                    </div>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <label className="flex h-10 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-emerald-300 bg-white px-3 text-sm">
                        <FileUp className="h-4 w-4" />
                        <span className="truncate">{insuranceCard ? insuranceCard.name : t("Attach medical card")}</span>
                        <input type="file" accept="image/*,.pdf" onChange={(e) => setInsuranceCard(e.target.files?.[0] || null)} hidden />
                      </label>
                      <button type="button" onClick={handleSaveExistingInsurance} className="h-10 shrink-0 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white">
                        {t("Save Insurance")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Summary sidebar */}
          <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
            <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg ring-1 ring-slate-100 sm:p-6">
              <p className="min-w-0 text-lg font-bold text-slate-900">{t("Booking summary")}</p>
              <p className="mt-1 text-xs text-slate-500">{t("Review before confirming. Payment is recorded later at the desk.")}</p>

              <div className="mt-5 space-y-3">
                <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    <UserPlus className="h-3.5 w-3.5 shrink-0" />
                    {t("Patient")}
                  </p>
                  <p className="break-words font-semibold text-slate-900">{selectedPatient?.name || t("No patient selected")}</p>
                  {selectedPatient && (
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {selectedPatient.patientId} · {selectedPatient.phone || "—"}
                    </p>
                  )}
                  {selectedPatient?.insurance?.enabled && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {selectedPatient.insurance.provider && (
                        <p className="break-words text-xs font-semibold text-teal-800">
                          {t("Insurance")}: {selectedPatient.insurance.provider}
                        </p>
                      )}
                      <InsuranceStatusBadge insurance={selectedPatient.insurance} t={t} />
                    </div>
                  )}
                </div>
                {selectedPatient?.insurance?.enabled && (
                  <InsuranceVerificationPanel
                    insurance={selectedPatient.insurance}
                    t={t}
                    saving={insuranceVerifySaving}
                    showVisitActions
                    compact
                    onVerify={handleBookingInsuranceVerify}
                  />
                )}
                {selectedPatient && (
                  <div className="min-w-0 rounded-xl border border-teal-200 bg-teal-50/80 p-4 ring-1 ring-teal-100">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-teal-900">{t("Patient insurance file")}</p>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={deskIns.enabled}
                        onChange={(e) => setDeskIns((p) => ({ ...p, enabled: e.target.checked }))}
                        className="accent-primary"
                      />
                      {t("Patient has insurance on file")}
                    </label>
                    {deskIns.enabled && (
                      <div className="mt-3 space-y-2">
                        <select
                          value={deskIns.provider}
                          onChange={(e) => setDeskIns((p) => ({ ...p, provider: e.target.value }))}
                          className="h-10 w-full rounded-lg border border-teal-200 bg-white px-3 text-sm"
                        >
                          <option value="">{t("Insurance provider")}</option>
                          {insuranceProvidersList.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                        <input
                          value={deskIns.fullName}
                          onChange={(e) => setDeskIns((p) => ({ ...p, fullName: e.target.value }))}
                          placeholder={t("Insurance Full Name *")}
                          className="h-10 w-full rounded-lg border border-teal-200 bg-white px-3 text-sm"
                        />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input type="date" max={today} value={deskIns.birthDate} onChange={(e) => setDeskIns((p) => ({ ...p, birthDate: e.target.value }))} className="h-10 rounded-lg border border-teal-200 bg-white px-3 text-sm" />
                          <input type="date" value={deskIns.expiryDate} onChange={(e) => setDeskIns((p) => ({ ...p, expiryDate: e.target.value }))} className="h-10 rounded-lg border border-teal-200 bg-white px-3 text-sm" />
                        </div>
                        <input
                          value={deskIns.idNumber}
                          onChange={(e) => setDeskIns((p) => ({ ...p, idNumber: e.target.value }))}
                          placeholder={t("ID Number *")}
                          className="h-10 w-full rounded-lg border border-teal-200 bg-white px-3 text-sm"
                        />
                        <label className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-teal-300 bg-white px-3 text-sm">
                          <FileUp className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 truncate">{deskInsCard ? deskInsCard.name : t("Medical Card *")}</span>
                          <input type="file" accept="image/*,.pdf" onChange={(e) => setDeskInsCard(e.target.files?.[0] || null)} hidden />
                        </label>
                        <button type="button" onClick={handleSaveDeskInsurance} className="mt-1 w-full rounded-lg bg-teal-700 py-2 text-sm font-bold text-white shadow-sm hover:bg-teal-800">
                          {t("Save patient insurance")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    <Stethoscope className="h-3.5 w-3.5 shrink-0" />
                    {t("Doctor")}
                  </p>
                  <p className="break-words font-semibold text-slate-900">{selectedDoctor?.name || t("No doctor selected")}</p>
                  {selectedDoctor && (
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {selectedDoctor.speciality} · {currency}
                      {selectedDoctor.fees}
                    </p>
                  )}
                </div>
                <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {t("Time")}
                  </p>
                  <p className="break-words font-semibold text-slate-900">{slotDateLabel || t("No slot selected")}</p>
                  <p className="mt-1 break-words text-xs text-slate-500">
                    {t(activeAppointmentType)}
                    {selectedClinicLocation ? ` · ${selectedClinicLocation}` : ""}
                  </p>
                </div>

                {activeAppointmentType === "Home Visit" && (
                  <div className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                      <Home className="h-3.5 w-3.5 shrink-0" />
                      {t("Home address")}
                    </p>
                    <p className="break-words">
                      {homeVisitAddress.area || t("Choose area")}
                      {homeVisitAddress.street ? `, ${homeVisitAddress.street}` : ""}
                    </p>
                  </div>
                )}

                {selectedDoctor && (
                  <div className="min-w-0 rounded-xl border border-violet-200 bg-violet-50/80 p-4 ring-1 ring-violet-100">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-violet-950">{t("Fee preview & insurance")}</p>
                        <p className="mt-0.5 break-words text-xs text-violet-800">{t("Insurance % applies to the listed consultation fee, in addition to any active doctor promo.")}</p>
                      </div>
                      <ShieldCheck className="h-6 w-6 shrink-0 text-violet-600" />
                    </div>
                    <label className="mt-3 block text-xs font-bold text-violet-900" htmlFor="book-ins-pct">
                      {t("Insurance coverage (%)")}
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        id="book-ins-pct"
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={insuranceCoveragePercent}
                        onChange={(e) => setInsuranceCoveragePercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                        className="h-10 w-24 rounded-lg border border-violet-200 bg-white px-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-200"
                      />
                      <span className="text-sm font-bold text-violet-900">%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={0.5}
                      value={insuranceCoveragePercent}
                      onChange={(e) => setInsuranceCoveragePercent(Number(e.target.value))}
                      className="mt-2 w-full accent-violet-600"
                    />
                    <div className="mt-4 space-y-1.5 border-t border-violet-100 pt-3 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>{t("List price")}</span>
                        <span className="font-semibold text-slate-900">
                          {currency}
                          {pricingPreview.base}
                        </span>
                      </div>
                      {pricingPreview.promoDiscount > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>{t("Promo discount")}</span>
                          <span>
                            −{currency}
                            {pricingPreview.promoDiscount}
                          </span>
                        </div>
                      )}
                      {pricingPreview.insuranceDiscount > 0 && (
                        <div className="flex justify-between text-violet-800">
                          <span>
                            {t("Insurance")} ({insuranceCoveragePercent}%)
                          </span>
                          <span>
                            −{currency}
                            {pricingPreview.insuranceDiscount}
                          </span>
                        </div>
                      )}
                      {pricingPreview.homeVisitSurcharge > 0 && (
                        <div className="flex justify-between text-emerald-800">
                          <span>{homeVisitFeeLabel}</span>
                          <span>
                            +{currency}
                            {pricingPreview.homeVisitSurcharge}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-violet-100 pt-2 font-bold text-slate-900">
                        <span>{t("Estimated due")}</span>
                        <span>
                          {currency}
                          {pricingPreview.amount}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleBook}
                disabled={isBooking}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 disabled:bg-slate-300"
              >
                <ShieldCheck className="h-4 w-4" />
                {isBooking ? t("Booking...") : t("Confirm booking")}
              </button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">{t("The appointment is saved only after all required choices are complete.")}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default ReceptionistBookAppointment;
