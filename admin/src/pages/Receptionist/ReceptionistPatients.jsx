import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  ChevronDown,
  FileText,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  Users,
  WalletCards,
  X,
  Trash2
} from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import { AppContext } from "../../context/AppContext";
import { ReceptionistContext } from "../../context/ReceptionistContext";
import { AdminContext } from "../../context/AdminContext";
import InsuranceVerificationPanel from "../../components/InsuranceVerificationPanel";
import InsuranceStatusBadge from "../../components/InsuranceStatusBadge";
import { translateInsuranceProviderName } from "../../data/insuranceProviderNamesAr";
import { LANGUAGES, useLanguage } from "../../i18n";

const formatGender = (gender, t) => {
  if (!gender || gender === "Not Selected") return t("Prefer not to say");
  return t(gender);
};

const historyItems = (history = {}, t) =>
  [
    [t("Conditions"), history.conditions],
    [t("Allergies"), history.allergies],
    [t("Surgeries"), history.surgeries],
    [t("Family History"), history.familyHistory],
    [t("Social History"), history.socialHistory],
    [t("Notes"), history.notes]
  ].filter(([, value]) => String(value || "").trim());

const generatePatientPassword = () => {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 14; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

const emptyAddForm = () => ({
  name: "",
  email: "",
  phone: "",
  password: "",
  dob: "",
  gender: "Not Selected",
  insuranceEnabled: false,
  insuranceProvider: "",
  insuranceFullName: "",
  insuranceBirthDate: "",
  insuranceIdNumber: "",
  insuranceExpiryDate: ""
});

function AddPatientModal({ open, onClose, createReceptionistPatient, onCreated, insuranceProviders = [] }) {
  const { t } = useContext(AppContext);
  const [form, setForm] = useState(emptyAddForm);
  const [insuranceCard, setInsuranceCard] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(emptyAddForm());
      setInsuranceCard(null);
    }
  }, [open]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.insuranceEnabled) {
      if (!form.insuranceProvider) {
        toast.error("Select an insurance provider, or turn off insurance for now.");
        return;
      }
      if (!form.insuranceFullName.trim() || !form.insuranceBirthDate || !form.insuranceIdNumber.trim() || !form.insuranceExpiryDate) {
        toast.error("Complete all insurance fields, or turn off insurance for now.");
        return;
      }
      if (!insuranceCard) {
        toast.error("Attach a photo of the medical card, or turn off insurance for now.");
        return;
      }
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name.trim());
      fd.append("email", form.email.trim());
      fd.append("phone", form.phone.trim());
      fd.append("password", form.password);
      fd.append("dob", form.dob);
      fd.append("gender", form.gender);
      fd.append("insuranceEnabled", form.insuranceEnabled ? "true" : "false");
      if (form.insuranceEnabled) {
        fd.append("insuranceProvider", form.insuranceProvider);
        fd.append("insuranceFullName", form.insuranceFullName.trim());
        fd.append("insuranceBirthDate", form.insuranceBirthDate);
        fd.append("insuranceIdNumber", form.insuranceIdNumber.trim());
        fd.append("insuranceExpiryDate", form.insuranceExpiryDate);
        if (insuranceCard) fd.append("insuranceCardPhoto", insuranceCard);
      }

      const patient = await createReceptionistPatient(fd);
      if (patient) {
        onCreated?.(patient);
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="add-patient-title">
      <button type="button" className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="relative z-[101] flex max-h-[min(92vh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">New registration</p>
            <h2 id="add-patient-title" className="mt-0.5 text-lg font-bold text-gray-900 sm:text-xl">
              Add patient
            </h2>
            <p className="mt-1 text-sm text-gray-600">Creates portal login credentials. Birth date must be in the past.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Full name</label>
              <input required value={form.name} onChange={(e) => setField("name", e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none ring-primary/20 focus:border-primary focus:ring-2" placeholder="Legal name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Email</label>
              <input required type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Phone</label>
              <input required value={form.phone} onChange={(e) => setField("phone", e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Date of birth</label>
              <input required type="date" value={form.dob} onChange={(e) => setField("dob", e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Gender</label>
              <select value={form.gender} onChange={(e) => setField("gender", e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                <option value="Not Selected">Prefer not to say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Temporary password</label>
              <div className="flex gap-2">
                <input required value={form.password} onChange={(e) => setField("password", e.target.value)} className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Min. strength per clinic policy" />
                <button
                  type="button"
                  onClick={() => setField("password", generatePatientPassword())}
                  className="shrink-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                >
                  Generate
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">Share securely with the patient so they can sign in to the portal.</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={form.insuranceEnabled} onChange={(e) => setField("insuranceEnabled", e.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <span>
                <span className="font-semibold text-gray-900">Add insurance now</span>
                <span className="mt-0.5 block text-sm text-gray-600">Optional. Requires card details and a photo of the medical card.</span>
              </span>
            </label>

            {form.insuranceEnabled && (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-200/80 pt-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Insurance provider</label>
                  <select
                    value={form.insuranceProvider}
                    onChange={(e) => setField("insuranceProvider", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select provider</option>
                    {insuranceProviders.map((name) => (
                      <option key={name} value={name}>
                        {translateInsuranceProviderName(name, t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Insured full name</label>
                  <input value={form.insuranceFullName} onChange={(e) => setField("insuranceFullName", e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Birth date</label>
                  <input type="date" value={form.insuranceBirthDate} onChange={(e) => setField("insuranceBirthDate", e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Policy / ID number</label>
                  <input value={form.insuranceIdNumber} onChange={(e) => setField("insuranceIdNumber", e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Expiry date</label>
                  <input type="date" value={form.insuranceExpiryDate} onChange={(e) => setField("insuranceExpiryDate", e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Medical card photo</label>
                  <input type="file" accept="image/*" onChange={(e) => setInsuranceCard(e.target.files?.[0] || null)} className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Create patient
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ReceptionistPatients = () => {
  const {
    aToken,
    patients: adminPatients,
    getAllPatients,
    getPatientDetails: getAdminPatientDetails,
    changePatientStatus,
    deletePatient
  } = useContext(AdminContext);
  const {
    rToken,
    backendUrl,
    patients: receptionistPatients,
    getReceptionistPatients,
    getReceptionistPatientDetails,
    createReceptionistPatient,
    verifyPatientInsurance
  } = useContext(ReceptionistContext);
  const { calculateAge, slotDateFormat, currency, t, language } = useContext(AppContext);
  const { localizeDigits } = useLanguage();
  const dateLocale = LANGUAGES[language]?.locale || "en-US";
  const formatDateTime = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(dateLocale);
  };
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = Boolean(aToken);
  const patients = isAdmin ? adminPatients : receptionistPatients;
  const lastHandledUsersLinkKey = useRef("");
  const [insuranceProvidersList, setInsuranceProvidersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientDetails, setPatientDetails] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [insuranceFilter, setInsuranceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [showAddModal, setShowAddModal] = useState(false);
  const [insuranceVerifySaving, setInsuranceVerifySaving] = useState(false);

  useEffect(() => {
    const fetchPatients = async () => {
      if (!isAdmin && !rToken) return;
      setLoading(true);
      if (isAdmin) await getAllPatients();
      else await getReceptionistPatients();
      setLoading(false);
    };
    fetchPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken, rToken, isAdmin]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${backendUrl}/api/user/insurance-providers`);
        if (!cancelled && data.success && Array.isArray(data.providers)) setInsuranceProvidersList(data.providers);
      } catch {
        if (!cancelled) setInsuranceProvidersList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backendUrl]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (isAdmin) await getAllPatients();
    else await getReceptionistPatients();
    setRefreshing(false);
  };

  const createPatientRecord = async (formData) => {
    if (!isAdmin) return createReceptionistPatient(formData);
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/register`, formData);
      if (data.success) {
        toast.success(data.message || "Patient created");
        await getAllPatients();
        return data.user || data.patient || true;
      }
      toast.error(data.message);
      return null;
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return null;
    }
  };

  const stats = useMemo(() => {
    const total = patients.length;
    const active = patients.filter((p) => p.isActive !== false).length;
    const inactive = total - active;
    const withAppts = patients.filter((p) => (p.appointmentStats?.appointments || 0) > 0).length;
    const withInsurance = patients.filter((p) => p.insurance?.enabled).length;
    return { total, active, inactive, withAppts, withInsurance };
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return patients.filter((patient) => {
      const isActive = patient.isActive !== false;
      const matchesStatus =
        statusFilter === "all" || (statusFilter === "active" && isActive) || (statusFilter === "inactive" && !isActive);
      const matchesSearch =
        !query ||
        patient.name?.toLowerCase().includes(query) ||
        patient.email?.toLowerCase().includes(query) ||
        patient.patientId?.toLowerCase().includes(query) ||
        patient.phone?.toLowerCase().includes(query);
      const hasIns = Boolean(patient.insurance?.enabled);
      const matchesInsurance =
        insuranceFilter === "all" || (insuranceFilter === "with" && hasIns) || (insuranceFilter === "without" && !hasIns);
      return matchesStatus && matchesSearch && matchesInsurance;
    });
  }, [patients, searchQuery, statusFilter, insuranceFilter]);

  const sortedPatients = useMemo(() => {
    const list = [...filteredPatients];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortBy === "appointments") {
        const va = a.appointmentStats?.appointments || 0;
        const vb = b.appointmentStats?.appointments || 0;
        return va === vb ? (a.name || "").localeCompare(b.name || "") : (va - vb) * dir;
      }
      if (sortBy === "joined") {
        const ta = new Date(a.createdAt || a.date || 0).getTime();
        const tb = new Date(b.createdAt || b.date || 0).getTime();
        return ta === tb ? (a.name || "").localeCompare(b.name || "") : (ta - tb) * dir;
      }
      return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }) * dir;
    });
    return list;
  }, [filteredPatients, sortBy, sortDir]);

  const selectPatient = async (patientId) => {
    setSelectedPatientId(patientId);
    setDetailsLoading(true);
    const details = isAdmin
      ? await getAdminPatientDetails(patientId)
      : await getReceptionistPatientDetails(patientId);
    setPatientDetails(details);
    setDetailsLoading(false);
  };

  const refreshSelectedPatient = async () => {
    if (!selectedPatientId) return;
    const details = isAdmin
      ? await getAdminPatientDetails(selectedPatientId)
      : await getReceptionistPatientDetails(selectedPatientId);
    setPatientDetails(details);
  };

  const handleToggleStatus = async (patientId) => {
    if (!isAdmin) return;
    const changed = await changePatientStatus(patientId);
    if (changed) {
      await getAllPatients();
      await refreshSelectedPatient();
    }
  };

  const handleDeletePatient = async (patientId) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      "Delete this patient profile permanently? Appointments and medical history snapshots will remain for records."
    );
    if (!confirmed) return;
    const deleted = await deletePatient(patientId);
    if (deleted) {
      setSelectedPatientId("");
      setPatientDetails(null);
    }
  };

  const onPatientCreated = async () => {
    if (isAdmin) await getAllPatients();
    else await getReceptionistPatients();
  };

  useEffect(() => {
    if (!isAdmin) return;
    const targetId = location.state?.openPatientId;
    if (!targetId || loading) return;
    if (lastHandledUsersLinkKey.current === location.key) return;
    lastHandledUsersLinkKey.current = location.key;
    const found = patients.some((p) => String(p._id) === String(targetId));
    navigate(location.pathname, { replace: true, state: {} });
    if (found) void selectPatient(targetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, patients, loading, location.pathname, location.state, location.key]);

  if (selectedPatientId) {
    const patient = patientDetails?.patient;
    const totals = patientDetails?.totals || {};
    const appointments = patientDetails?.appointments || [];
    const prescriptions = patientDetails?.prescriptions || [];
    const profileHistory = historyItems(patient?.medicalHistory, t);

    return (
      <div className="min-h-screen bg-[#f4f6fb] p-3 sm:p-5 md:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                setSelectedPatientId("");
                setPatientDetails(null);
              }}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("Back to registry")}
            </button>
            {isAdmin && patient && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(patient._id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${patient.isActive !== false ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
                >
                  {patient.isActive !== false ? <UserRoundX className="h-4 w-4" /> : <UserRoundCheck className="h-4 w-4" />}
                  {patient.isActive !== false ? t("Deactivate") : t("Activate")}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePatient(patient._id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("Delete")}
                </button>
              </div>
            )}
          </div>

          {detailsLoading ? (
            <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-16 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : patient ? (
            <>
              <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5 sm:px-8 sm:py-6">
                  <div className="flex flex-col gap-5 md:flex-row md:items-center">
                    <img className="h-24 w-24 rounded-2xl border border-gray-200 bg-gray-100 object-cover shadow-inner" src={patient.image} alt="" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{patient.name}</h1>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${patient.isActive !== false ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                          {patient.isActive !== false ? t("Active") : t("Inactive")}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{t("Clinical record")}</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">
                        {t("Patient ID")}:{" "}
                        <span className="font-mono font-semibold text-gray-900">{patient.patientId || "—"}</span>
                      </p>
                      <div className="mt-4 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                        <p className="flex min-w-0 items-center gap-2">
                          <Mail className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate">{patient.email}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Phone className="h-4 w-4 shrink-0 text-primary" />
                          {patient.phone || "—"}
                        </p>
                        <p>
                          {t("Gender")}: <span className="font-medium">{formatGender(patient.gender, t)}</span>
                        </p>
                        <p>
                          {t("Age")}:{" "}
                          <span className="font-medium">
                            {patient.dob && patient.dob !== "Not Selected"
                              ? `${localizeDigits(calculateAge(patient.dob))} ${t("years old")}`
                              : "—"}
                          </span>
                        </p>
                      </div>
                      {!isAdmin && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            to={`/receptionist-book-appointment?patient=${patient._id}`}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                          >
                            <CalendarPlus className="h-4 w-4" />
                            {t("Book appointment")}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { key: "appointments", label: t("Patient record appointments"), value: totals.appointments || 0, gradient: "from-blue-500 to-blue-600" },
                  { key: "paid", label: t("Paid appointments"), value: totals.paidAppointments || 0, gradient: "from-emerald-500 to-emerald-600" },
                  { key: "unpaid", label: t("Unpaid appointments"), value: totals.unpaidAppointments || 0, gradient: "from-amber-500 to-orange-500" },
                  { key: "completed", label: t("Completed appointments"), value: totals.completedAppointments || 0, gradient: "from-indigo-500 to-violet-600" }
                ].map(({ key, label, value, gradient }) => (
                  <div key={key} className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                    <p className={`mt-2 inline-flex min-w-[2.5rem] items-center justify-center rounded-lg bg-gradient-to-br px-3 py-1 text-2xl font-bold text-white shadow ${gradient}`}>
                      {localizeDigits(value)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                    <WalletCards className="h-5 w-5 text-emerald-600" />
                    {t("Insurance")}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${patient.insurance?.enabled ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                      {patient.insurance?.enabled ? t("Insurance on file") : t("Insurance not on file")}
                    </span>
                    {patient.insurance?.enabled && <InsuranceStatusBadge insurance={patient.insurance} t={t} />}
                  </div>
                </div>
                {patient.insurance?.enabled ? (
                  <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 sm:grid-cols-2 lg:grid-cols-4">
                    {patient.insurance.provider && (
                      <p className="sm:col-span-2 lg:col-span-4">
                        <span className="font-semibold text-gray-900">{t("Insurance provider label")}:</span>{" "}
                        {translateInsuranceProviderName(patient.insurance.provider, t)}
                      </p>
                    )}
                    <p>
                      <span className="font-semibold text-gray-900">{t("Insurance full name")}:</span> {patient.insurance.fullName}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-900">{t("Insurance birth date")}:</span> {patient.insurance.birthDate}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-900">{t("Insurance ID number")}:</span> {patient.insurance.idNumber}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-900">{t("Insurance expiry date")}:</span> {patient.insurance.expiryDate}
                    </p>
                    {patient.insurance.medicalCardPhoto && (
                      <a className="font-semibold text-primary underline sm:col-span-2" href={patient.insurance.medicalCardPhoto} target="_blank" rel="noreferrer">
                        {t("View medical card")}
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">{t("No insurance captured yet.")}</p>
                )}
                {!isAdmin && patient.insurance?.enabled && (
                  <div className="mt-4">
                    <InsuranceVerificationPanel
                      insurance={patient.insurance}
                      t={t}
                      saving={insuranceVerifySaving}
                      onVerify={async (payload) => {
                        if (!selectedPatientId) return;
                        setInsuranceVerifySaving(true);
                        const result = await verifyPatientInsurance({
                          patientId: selectedPatientId,
                          status: payload.status,
                          declineReason: payload.declineReason,
                        });
                        setInsuranceVerifySaving(false);
                        if (result) {
                          setPatientDetails((prev) =>
                            prev ? { ...prev, patient: { ...prev.patient, insurance: result.insurance } } : prev
                          );
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/80 px-4 py-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <h2 className="font-bold text-gray-900">{t("Medical history")}</h2>
                  </div>
                  <div className="max-h-[430px] divide-y divide-gray-100 overflow-y-auto">
                    {profileHistory.length === 0 && prescriptions.length === 0 ? (
                      <p className="p-5 text-sm text-gray-500">{t("No clinical notes in profile.")}</p>
                    ) : (
                      <>
                        {profileHistory.map(([label, value]) => (
                          <div key={label} className="p-4 sm:p-5">
                            <p className="font-semibold text-gray-900">{label}</p>
                            <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{value}</p>
                          </div>
                        ))}
                        {prescriptions.map((prescription) => (
                          <div key={prescription._id} className="p-4 sm:p-5">
                            <p className="font-semibold text-gray-900">{prescription.diagnosis || t("Medical record")}</p>
                            <p className="text-sm text-gray-500">
                              {prescription.docData?.name || t("Doctor")} · {slotDateFormat(prescription.slotDate)}
                            </p>
                            <p className="mt-2 line-clamp-3 text-sm text-gray-600">{prescription.instructions}</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/80 px-4 py-3">
                    <CalendarClock className="h-5 w-5 text-primary" />
                    <h2 className="font-bold text-gray-900">{t("Appointments")}</h2>
                  </div>
                  <div className="max-h-[430px] divide-y divide-gray-100 overflow-y-auto">
                    {appointments.length === 0 ? (
                      <p className="p-5 text-sm text-gray-500">{t("No visits yet.")}</p>
                    ) : (
                      appointments.map((appointment) => (
                        <div key={appointment._id} className="p-4 sm:p-5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-gray-900">{appointment.docData?.name || t("Doctor")}</p>
                              <p className="text-sm text-gray-500">
                                {slotDateFormat(appointment.slotDate)} · {appointment.slotTime}
                              </p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${appointment.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                              {t(appointment.paymentStatus)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                            <span className="rounded-lg bg-gray-100 px-2 py-1 font-medium">{t(appointment.appointmentStatus)}</span>
                            <span className="rounded-lg bg-gray-100 px-2 py-1 font-medium">
                              {currency}
                              {localizeDigits(appointment.amount)}
                            </span>
                            <span className="rounded-lg bg-gray-100 px-2 py-1 font-medium">{t(appointment.bookedBy)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">{t("Patient could not be loaded.")}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#f4f6fb] p-3 sm:p-5 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-2xl border border-slate-700/20 bg-gradient-to-br from-slate-900 via-slate-800 to-primary shadow-xl">
          <div className="relative px-5 py-8 sm:px-8 sm:py-10">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/90 ring-1 ring-white/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("Patient registry")}
                </div>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t("All patients")}</h1>
                <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">
                  {isAdmin
                    ? t("Patients registry description")
                    : t("Patients registry receptionist description")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-md transition hover:bg-white/95"
                >
                  <UserPlus className="h-4 w-4 text-primary" />
                  {t("Add patient")}
                </button>
                {!isAdmin && (
                  <Link
                    to="/receptionist-book-appointment"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    {t("Book visit")}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  aria-label={t("Refresh")}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  {t("Refresh")}
                </button>
              </div>
            </div>

            <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: t("Total"), value: stats.total, icon: Users, tone: "text-sky-200" },
                { label: t("Patients stat active"), value: stats.active, icon: ShieldCheck, tone: "text-emerald-200" },
                { label: t("Patients stat inactive"), value: stats.inactive, icon: UserRound, tone: "text-rose-200" },
                { label: t("With visits"), value: stats.withAppts, icon: CalendarClock, tone: "text-amber-200" },
                { label: t("Patients with insurance"), value: stats.withInsurance, icon: WalletCards, tone: "text-cyan-200" }
              ].map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
                    <Icon className={`h-3.5 w-3.5 ${tone}`} />
                    {label}
                  </div>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-white">{localizeDigits(value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div dir="ltr" className="mt-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-2 xl:grid-cols-4">
            <div className="relative sm:col-span-2 xl:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("Search name, ID, email, phone…")}
                className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={t("Clear search")}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-10 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">{t("All statuses")}</option>
                <option value="active">{t("Active only")}</option>
                <option value="inactive">{t("Inactive only")}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            <div className="relative">
              <select
                value={insuranceFilter}
                onChange={(e) => setInsuranceFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-10 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">{t("All patients")}</option>
                <option value="with">{t("With insurance")}</option>
                <option value="without">{t("Without insurance")}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            <div className="relative sm:col-span-2 xl:col-span-1">
              <select
                value={`${sortBy}:${sortDir}`}
                onChange={(e) => {
                  const [by, dir] = e.target.value.split(":");
                  setSortBy(by);
                  setSortDir(dir);
                }}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-10 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="name:asc">{t("Name A → Z")}</option>
                <option value="name:desc">{t("Name Z → A")}</option>
                <option value="joined:desc">{t("Newest first")}</option>
                <option value="joined:asc">{t("Oldest first")}</option>
                <option value="appointments:desc">{t("Most appointments")}</option>
                <option value="appointments:asc">{t("Fewest appointments")}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          <p className="text-center text-sm font-medium text-gray-600 lg:text-right">
            {t("Showing")}{" "}
            <span className="font-bold text-gray-900">{localizeDigits(sortedPatients.length)}</span>{" "}
            {t("of")}{" "}
            <span className="font-bold text-gray-900">{localizeDigits(patients.length)}</span>
          </p>
        </div>

        <div dir="ltr" className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.15fr)] gap-3 border-b border-gray-100 bg-gray-50/90 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 xl:grid">
            <span>{t("Patient")}</span>
            <span>{t("Contact")}</span>
            <span>{t("Patient ID")}</span>
            <span>{t("Visits")}</span>
            <span>{t("Status")}</span>
            <span>{t("Joined")}</span>
            <span className="text-right">{t("Actions")}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-500">
              <Loader2 className="h-9 w-9 animate-spin text-primary" />
            </div>
          ) : sortedPatients.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <Users className="h-8 w-8" />
              </div>
              <p className="mt-4 text-lg font-semibold text-gray-900">{t("No patients match")}</p>
              <p className="mt-1 text-sm text-gray-600">{t("Try another search or add a new patient to the registry.")}</p>
              <button type="button" onClick={() => setShowAddModal(true)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm">
                <UserPlus className="h-4 w-4" />
                {t("Add patient")}
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sortedPatients.map((patient) => (
                <li key={patient._id} className="transition hover:bg-slate-50/80">
                  <div className="grid grid-cols-1 gap-3 px-4 py-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.15fr)] xl:items-center xl:gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <img className="h-12 w-12 shrink-0 rounded-xl border border-gray-200 bg-gray-100 object-cover shadow-sm" src={patient.image} alt="" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">{patient.name}</p>
                        {patient.insurance?.enabled && (
                          <div className="mt-1">
                            <InsuranceStatusBadge insurance={patient.insurance} t={t} className="text-[10px]" />
                          </div>
                        )}
                        <p className="truncate text-xs text-gray-500 xl:hidden">{patient.patientId}</p>
                      </div>
                    </div>
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium text-gray-800">{patient.email}</p>
                      <p className="truncate text-xs text-gray-500">{patient.phone || t("No phone")}</p>
                    </div>
                    <p className="font-mono text-sm text-gray-700">{patient.patientId || "—"}</p>
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 tabular-nums">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-primary xl:hidden" aria-hidden />
                      <span>{localizeDigits(patient.appointmentStats?.appointments ?? 0)}</span>
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${patient.isActive !== false ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                        {patient.isActive !== false ? t("Active") : t("Inactive")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{formatDateTime(patient.createdAt)}</p>
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-3 xl:border-t-0 xl:pt-0">
                      <button
                        type="button"
                        onClick={() => selectPatient(patient._id)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-sm transition hover:border-primary/40 hover:text-primary"
                      >
                        {t("Open record")}
                      </button>
                      {!isAdmin && (
                        <Link
                          to={`/receptionist-book-appointment?patient=${patient._id}`}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-95"
                        >
                          {t("Book")}
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <AddPatientModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        createReceptionistPatient={createPatientRecord}
        onCreated={onPatientCreated}
        insuranceProviders={insuranceProvidersList}
      />
    </div>
  );
};

export default ReceptionistPatients;
