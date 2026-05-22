import React, { useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BadgeCheck,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  ExternalLink,
  FileText,
  Filter,
  Gift,
  Home,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Video,
  X,
} from "lucide-react";
import { ReceptionistContext } from "../../context/ReceptionistContext";
import { AppContext } from "../../context/AppContext";
import { emptyHomeVisitAddress, formatHomeVisitAddress, supportedHomeVisitAreas } from "../../utils/homeVisitAreas";
import InsuranceVerificationPanel from "../../components/InsuranceVerificationPanel";
import InsuranceStatusBadge from "../../components/InsuranceStatusBadge";

const appointmentStatuses = ["Booked", "Checked In", "In Progress", "Finished", "Cancelled"];

const paymentMethods = [
  { value: "Cash", label: "Cash", icon: Banknote },
  { value: "Visa", label: "Card", icon: CreditCard },
  { value: "Insurance", label: "Insurance", icon: ShieldCheck },
  { value: "Free", label: "Free", icon: Gift },
];

const slotDateToTimestamp = (slotDate) => {
  const parts = String(slotDate || "").split("_").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return NaN;
  const [day, month, year] = parts;
  return new Date(year, month - 1, day).setHours(12, 0, 0, 0);
};

const todaySlotKey = () => {
  const d = new Date();
  return `${d.getDate()}_${d.getMonth() + 1}_${d.getFullYear()}`;
};

const startOfTodayTs = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const isInThisCalendarWeek = (ts) => {
  if (Number.isNaN(ts)) return false;
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return ts >= monday.getTime() && ts <= sunday.getTime();
};

const buildDefaultDraft = (item) => {
  const base = Number(item.originalAmount || item.amount || 0);
  const rawDisc = Number(item.discountAmount || 0);
  const discountAmount = Math.min(base, Math.max(0, rawDisc));
  const isInsurance = item.paymentMethod === "Insurance" || item.coveredByInsurance;
  let insuranceCoveragePercent = 0;
  if (isInsurance && base > 0) {
    insuranceCoveragePercent = Math.min(100, Math.round(((discountAmount / base) * 100) * 100) / 100);
  }
  return {
    paymentStatus: item.paymentStatus || "Not Paid",
    paymentMethod: item.paymentMethod || "Cash",
    discountAmount,
    discountReason: item.discountReason || "",
    coveredByInsurance: Boolean(item.coveredByInsurance || item.paymentMethod === "Insurance"),
    paymentNote: item.paymentNote || "",
    insuranceCoveragePercent,
    insuranceDiscountMode: isInsurance ? "percent" : "amount",
  };
};

const ReceptionistAppointments = () => {
  const [searchParams] = useSearchParams();
  const {
    rToken,
    appointments,
    getReceptionistAppointments,
    updateAppointmentStatus,
    checkInPatient,
    updatePayment,
    updateHomeVisitAddress,
    verifyPatientInsurance,
  } = useContext(ReceptionistContext);
  const { calculateAge, slotDateFormat, currency, t } = useContext(AppContext);

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("dateAsc");
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [homeAddressDrafts, setHomeAddressDrafts] = useState({});
  const [savingPaymentId, setSavingPaymentId] = useState("");
  const [expanded, setExpanded] = useState({});
  const [insuranceVerifySavingId, setInsuranceVerifySavingId] = useState("");

  useEffect(() => {
    if (rToken) getReceptionistAppointments();
  }, [rToken]);

  const getStatus = (item) => item.appointmentStatus || (item.cancelled ? "Cancelled" : item.isCompleted ? "Finished" : "Booked");
  const getAppointmentMode = (item) => item.appointmentType || "Clinic";
  const isRemoteAppointment = (item) => ["Voice Call", "Video Call"].includes(getAppointmentMode(item));
  const isHomeVisit = (item) => getAppointmentMode(item) === "Home Visit";
  const getReservationNumber = (item) => item.reservationNumber || `RES-${String(item._id || "").slice(-6).toUpperCase()}`;

  const toggleExpanded = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getPaymentDraft = (item) => ({
    ...buildDefaultDraft(item),
    ...(paymentDrafts[item._id] || {}),
  });

  const setPaymentDraft = (appointmentId, patch) => {
    setPaymentDrafts((prev) => ({
      ...prev,
      [appointmentId]: { ...(prev[appointmentId] || {}), ...patch },
    }));
  };

  const filteredAppointments = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const tKey = todaySlotKey();
    const startToday = startOfTodayTs();

    let list = appointments.filter((item) => {
      const searchable = [
        item.userData?.name,
        item.userData?.patientId,
        item.userData?.phone,
        item.docData?.name,
        item.docData?.speciality,
        getReservationNumber(item),
        item.clinicLocation,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (query && !searchable.includes(query)) return false;
      if (statusFilter !== "all" && getStatus(item) !== statusFilter) return false;
      if (paymentFilter === "paid" && item.paymentStatus !== "Paid") return false;
      if (paymentFilter === "unpaid" && item.paymentStatus === "Paid") return false;
      if (typeFilter !== "all" && getAppointmentMode(item) !== typeFilter) return false;

      const ts = slotDateToTimestamp(item.slotDate);
      if (datePreset === "today" && item.slotDate !== tKey) return false;
      if (datePreset === "week" && !isInThisCalendarWeek(ts)) return false;
      if (datePreset === "upcoming" && (Number.isNaN(ts) || ts < startToday)) return false;
      if (datePreset === "past" && (Number.isNaN(ts) || ts >= startToday)) return false;

      return true;
    });

    const cmpTime = (a, b) => {
      const ta = slotDateToTimestamp(a.slotDate);
      const tb = slotDateToTimestamp(b.slotDate);
      if (ta !== tb) return ta - tb;
      return String(a.slotTime || "").localeCompare(String(b.slotTime || ""));
    };

    list = [...list].sort((a, b) => {
      if (sortBy === "dateDesc") return -cmpTime(a, b);
      if (sortBy === "dateAsc") return cmpTime(a, b);
      if (sortBy === "patient") return String(a.userData?.name || "").localeCompare(String(b.userData?.name || ""));
      if (sortBy === "doctor") return String(a.docData?.name || "").localeCompare(String(b.docData?.name || ""));
      return cmpTime(a, b);
    });

    return list;
  }, [appointments, searchQuery, statusFilter, paymentFilter, datePreset, typeFilter, sortBy]);

  const counts = useMemo(
    () => ({
      total: appointments.length,
      unpaid: appointments.filter((item) => item.paymentStatus !== "Paid" && getStatus(item) !== "Cancelled").length,
      checkedIn: appointments.filter((item) => getStatus(item) === "Checked In").length,
      paid: appointments.filter((item) => item.paymentStatus === "Paid").length,
    }),
    [appointments]
  );

  const statusClass = (status) => {
    if (status === "Finished") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100";
    if (status === "Cancelled") return "bg-rose-50 text-rose-800 ring-1 ring-rose-100";
    if (status === "Checked In") return "bg-sky-50 text-sky-800 ring-1 ring-sky-100";
    if (status === "In Progress") return "bg-amber-50 text-amber-900 ring-1 ring-amber-100";
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  };

  const choosePaymentMethod = (item, method) => {
    const base = Number(item.originalAmount || item.amount || 0);
    const draft = getPaymentDraft(item);

    if (method === "Free") {
      setPaymentDraft(item._id, {
        paymentStatus: "Paid",
        paymentMethod: "Free",
        coveredByInsurance: false,
        insuranceCoveragePercent: 0,
        insuranceDiscountMode: "percent",
        discountAmount: base,
        discountReason: "Complimentary visit",
      });
      return;
    }

    if (method === "Insurance") {
      const pct = Math.min(100, Math.max(0, Number(draft.insuranceCoveragePercent) || 0));
      const discountAmount = Math.round(((base * pct) / 100) * 100) / 100;
      setPaymentDraft(item._id, {
        paymentStatus: "Paid",
        paymentMethod: "Insurance",
        coveredByInsurance: true,
        insuranceDiscountMode: "percent",
        insuranceCoveragePercent: pct,
        discountAmount,
        discountReason: pct > 0 ? `Insurance coverage (${pct}%)` : draft.discountReason || "Insurance",
      });
      return;
    }

    setPaymentDraft(item._id, {
      paymentStatus: "Paid",
      paymentMethod: method,
      coveredByInsurance: false,
      insuranceCoveragePercent: 0,
      insuranceDiscountMode: "amount",
      discountAmount: Math.min(base, Math.max(0, Number(draft.discountAmount) || 0)),
      discountReason: draft.discountReason || "",
    });
  };

  const onInsurancePercentChange = (item, raw) => {
    const base = Number(item.originalAmount || item.amount || 0);
    const pct = Math.min(100, Math.max(0, Number(raw) || 0));
    const discountAmount = Math.round(((base * pct) / 100) * 100) / 100;
    setPaymentDraft(item._id, {
      insuranceDiscountMode: "percent",
      insuranceCoveragePercent: pct,
      discountAmount,
      discountReason: pct > 0 ? `Insurance coverage (${pct}%)` : "",
      paymentStatus: "Paid",
      paymentMethod: "Insurance",
      coveredByInsurance: true,
    });
  };

  const onDiscountAmountInput = (item, raw) => {
    const base = Number(item.originalAmount || item.amount || 0);
    const draft = getPaymentDraft(item);
    const n = Math.min(base, Math.max(0, Number(raw) || 0));
    const patch = { discountAmount: n, insuranceDiscountMode: "amount" };
    if (draft.paymentMethod === "Insurance" && base > 0) {
      patch.insuranceCoveragePercent = Math.min(100, Math.round(((n / base) * 100) * 100) / 100);
    }
    setPaymentDraft(item._id, patch);
  };

  const savePayment = async (item) => {
    const draft = getPaymentDraft(item);
    const baseAmount = Number(item.originalAmount || item.amount || 0);
    const discountAmount = Math.min(baseAmount, Math.max(0, Number(draft.discountAmount || 0)));
    setSavingPaymentId(item._id);
    const saved = await updatePayment(item._id, {
      paymentStatus: draft.paymentStatus,
      paymentMethod: draft.paymentStatus === "Paid" ? draft.paymentMethod : "",
      discountAmount,
      discountReason: draft.discountReason,
      coveredByInsurance: draft.paymentStatus === "Paid" && draft.paymentMethod === "Insurance",
      paymentNote: draft.paymentNote,
    });
    if (saved) {
      setPaymentDrafts((prev) => {
        const next = { ...prev };
        delete next[item._id];
        return next;
      });
    }
    setSavingPaymentId("");
  };

  const getHomeAddressDraft = (item) => homeAddressDrafts[item._id] || { ...emptyHomeVisitAddress, ...(item.homeVisitAddress || {}) };
  const setHomeAddressDraft = (appointmentId, patch) =>
    setHomeAddressDrafts((prev) => ({ ...prev, [appointmentId]: { ...(prev[appointmentId] || {}), ...patch } }));

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setDatePreset("all");
    setTypeFilter("all");
    setSortBy("dateAsc");
  };

  const activeFilterCount = [statusFilter, paymentFilter, datePreset, typeFilter].filter((v) => v !== "all").length;

  return (
    <div className="w-full bg-gradient-to-b from-slate-50/90 to-white p-3 sm:p-5 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
              <FileText className="h-7 w-7 text-primary" />
              {t("Receptionist Appointments")}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {t("Search, filter, and expand a visit to check in, record payment, or edit home visit details.")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [t("Total"), counts.total],
              [t("Checked in"), counts.checkedIn],
              [t("Paid"), counts.paid],
              [t("Unpaid"), counts.unpaid],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="text-xl font-bold tabular-nums text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Filter className="h-4 w-4 text-primary" />
              {t("Filters & sort")}
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{activeFilterCount}</span>
              )}
            </div>
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearFilters} className="text-xs font-semibold text-primary hover:underline">
                {t("Clear all")}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder={t("Search patient, ID, phone, doctor, ref…")}
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="relative">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <option value="dateAsc">{t("Sort: soonest first")}</option>
                <option value="dateDesc">{t("Sort: latest first")}</option>
                <option value="patient">{t("Sort: patient A–Z")}</option>
                <option value="doctor">{t("Sort: doctor A–Z")}</option>
              </select>
            </div>

            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="all">{t("Any date")}</option>
              <option value="today">{t("Today only")}</option>
              <option value="week">{t("This week")}</option>
              <option value="upcoming">{t("Upcoming (from today)")}</option>
              <option value="past">{t("Past (before today)")}</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="all">{t("Any payment")}</option>
              <option value="paid">{t("Paid only")}</option>
              <option value="unpaid">{t("Unpaid only")}</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="all">{t("Any status")}</option>
              {appointmentStatuses.map((status) => (
                <option key={status} value={status}>
                  {t(status)}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 md:col-span-2 xl:col-span-1"
            >
              <option value="all">{t("Any visit type")}</option>
              <option value="Clinic">{t("Clinic")}</option>
              <option value="Video Call">{t("Video Call")}</option>
              <option value="Voice Call">{t("Voice Call")}</option>
              <option value="Home Visit">{t("Home Visit")}</option>
            </select>
          </div>
        </div>

        {filteredAppointments.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500 shadow-sm">
            {t("No appointments match your filters.")}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAppointments.map((item) => {
              const status = getStatus(item);
              const draft = getPaymentDraft(item);
              const baseAmount = Number(item.originalAmount || item.amount || 0);
              const discountAmount = Math.min(baseAmount, Math.max(0, Number(draft.discountAmount || 0)));
              const finalAmount = Math.max(0, baseAmount - discountAmount);
              const isPaidDraft = draft.paymentStatus === "Paid";
              const canCheckIn = !["Checked In", "Finished", "Cancelled"].includes(status);
              const addressDraft = getHomeAddressDraft(item);
              const isOpen = expanded[item._id] !== false;
              const isInsuranceMethod = draft.paymentMethod === "Insurance";

              return (
                <article key={item._id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {/* Summary row — always visible */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item._id)}
                    className="flex w-full items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 text-left transition hover:bg-slate-100/80 sm:gap-4 sm:px-5"
                  >
                    <img src={item.userData?.image} alt="" className="h-11 w-11 shrink-0 rounded-full bg-indigo-50 object-cover ring-2 ring-white" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="truncate font-semibold text-slate-900">{item.userData?.name || t("Patient")}</span>
                        <span className="font-mono text-xs font-medium text-slate-500">{getReservationNumber(item)}</span>
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {item.docData?.name} · {slotDateFormat(item.slotDate)} {item.slotTime}
                      </p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(status)}`}>{t(status)}</span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          item.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100" : "bg-amber-50 text-amber-900 ring-1 ring-amber-100"
                        }`}
                      >
                        {item.paymentStatus === "Paid" ? t("Paid") : t("Not Paid")}
                      </span>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-xs font-semibold uppercase text-slate-400">{t("Due")}</p>
                      <p className="text-sm font-bold text-slate-900">
                        {currency}
                        {item.paymentStatus === "Paid" ? 0 : Number(item.amount || 0)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-slate-500">
                      <span className="text-xs font-semibold text-primary sm:hidden">{isOpen ? t("Hide") : t("Details")}</span>
                      {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="space-y-4 p-4 sm:p-5">
                      <div className="grid gap-4 lg:grid-cols-12">
                        {/* Patient & visit */}
                        <div className="space-y-3 lg:col-span-4">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("Patient & visit")}</h3>
                          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                            <p className="text-sm text-slate-600">
                              <span className="font-medium text-slate-800">{t("Patient ID")}:</span> {item.userData?.patientId || "—"}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              <span className="font-medium text-slate-800">{t("Age")}:</span> {calculateAge(item.userData?.dob)}
                            </p>
                            {item.userData?.phone && (
                              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                                {item.userData.phone}
                              </p>
                            )}
                            {(item.patientInsurance?.enabled || item.userData?.insurance?.enabled) && (
                              <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-bold uppercase text-slate-500">{t("Insurance")}</span>
                                  <InsuranceStatusBadge insurance={item.patientInsurance || item.userData?.insurance} t={t} />
                                </div>
                                <InsuranceVerificationPanel
                                  insurance={item.patientInsurance || item.userData?.insurance}
                                  visitCheck={item.insuranceVisitCheck}
                                  t={t}
                                  compact
                                  showVisitActions
                                  saving={insuranceVerifySavingId === item._id}
                                  onVerify={async (payload) => {
                                    setInsuranceVerifySavingId(item._id);
                                    await verifyPatientInsurance({
                                      patientId: item.userId,
                                      appointmentId: item._id,
                                      status: payload.visitStatus || payload.status,
                                      declineReason: payload.declineReason,
                                      note: payload.insuranceVisitNote,
                                    });
                                    setInsuranceVerifySavingId("");
                                  }}
                                />
                              </div>
                            )}
                            <div className="mt-3 border-t border-slate-200 pt-3">
                              <p className="font-semibold text-slate-900">{item.docData?.name}</p>
                              <p className="text-xs text-slate-500">{item.docData?.speciality}</p>
                              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                {getAppointmentMode(item) === "Video Call" ? (
                                  <Video className="h-3.5 w-3.5" />
                                ) : getAppointmentMode(item) === "Voice Call" ? (
                                  <Phone className="h-3.5 w-3.5" />
                                ) : isHomeVisit(item) ? (
                                  <Home className="h-3.5 w-3.5" />
                                ) : (
                                  <MapPin className="h-3.5 w-3.5" />
                                )}
                                {t(getAppointmentMode(item))}
                              </span>
                              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <CalendarClock className="h-4 w-4 text-primary" />
                                {slotDateFormat(item.slotDate)} · {item.slotTime}
                              </p>
                              {isRemoteAppointment(item) && item.teleconsultationLink && (
                                <a
                                  href={item.teleconsultationLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-sky-800 ring-1 ring-sky-100"
                                >
                                  {t("Open call room")} <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {!isRemoteAppointment(item) && !isHomeVisit(item) && item.clinicLocation && (
                                <p className="mt-2 text-xs text-slate-500">{item.clinicLocation}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-3 lg:col-span-3">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("Visit status")}</h3>
                          <select
                            value={status}
                            onChange={(e) => updateAppointmentStatus(item._id, e.target.value)}
                            className={`h-11 w-full rounded-xl px-3 text-sm font-semibold outline-none ring-1 ${statusClass(status)}`}
                          >
                            {appointmentStatuses.map((option) => (
                              <option key={option} value={option}>
                                {t(option)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => checkInPatient(item._id)}
                            disabled={!canCheckIn}
                            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {t("Check in")}
                          </button>
                          <div className="flex flex-wrap gap-2 sm:hidden">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(status)}`}>{t(status)}</span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                item.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
                              }`}
                            >
                              {item.paymentStatus === "Paid" ? t("Paid") : t("Not Paid")}
                            </span>
                          </div>
                        </div>

                        {/* Payment */}
                        <div className="space-y-3 lg:col-span-5">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("Payment & billing")}</h3>
                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-inner ring-1 ring-slate-100">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold uppercase text-slate-400">{t("Amount due")}</p>
                                <p className="text-2xl font-bold tracking-tight text-slate-900">
                                  {currency}
                                  {finalAmount}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {t("Base fee")} {currency}
                                  {baseAmount}
                                  {discountAmount > 0 && (
                                    <>
                                      {" "}
                                      − {currency}
                                      {discountAmount} {t("discount")}
                                    </>
                                  )}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setPaymentDraft(item._id, {
                                    paymentStatus: isPaidDraft ? "Not Paid" : "Paid",
                                    paymentMethod: isPaidDraft ? "" : draft.paymentMethod || "Cash",
                                  })
                                }
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                                  isPaidDraft ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200" : "bg-amber-100 text-amber-900 ring-1 ring-amber-200"
                                }`}
                              >
                                {isPaidDraft ? <BadgeCheck className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                                {isPaidDraft ? t("Paid") : t("Not paid")}
                              </button>
                            </div>

                            <p className="mb-2 mt-4 text-xs font-semibold text-slate-500">{t("Payment method (when marked paid)")}</p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {paymentMethods.map((method) => {
                                const MethodIcon = method.icon;
                                const active = isPaidDraft && draft.paymentMethod === method.value;
                                return (
                                  <button
                                    key={method.value}
                                    type="button"
                                    onClick={() => choosePaymentMethod(item, method.value)}
                                    disabled={status === "Cancelled"}
                                    className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                      active ? "border-primary bg-primary text-white shadow-md" : "border-slate-200 bg-slate-50 text-slate-800 hover:border-primary/40 hover:bg-white"
                                    }`}
                                  >
                                    <MethodIcon className="h-4 w-4 shrink-0" />
                                    {t(method.label)}
                                  </button>
                                );
                              })}
                            </div>

                            {isPaidDraft && isInsuranceMethod && (
                              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/80 p-4 ring-1 ring-violet-100">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-bold text-violet-950">{t("Insurance coverage")}</p>
                                    <p className="mt-0.5 text-xs text-violet-800">{t("Set the percentage covered by insurance. Fee and discount update automatically.")}</p>
                                  </div>
                                  <ShieldCheck className="h-6 w-6 shrink-0 text-violet-600" />
                                </div>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <label className="text-xs font-semibold text-violet-900" htmlFor={`ins-pct-${item._id}`}>
                                      {t("Coverage (%)")}
                                    </label>
                                    <div className="mt-1 flex items-center gap-2">
                                      <input
                                        id={`ins-pct-${item._id}`}
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.5}
                                        value={draft.insuranceCoveragePercent ?? ""}
                                        onChange={(e) => onInsurancePercentChange(item, e.target.value)}
                                        className="h-11 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                                      />
                                      <span className="text-sm font-bold text-violet-900">%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min={0}
                                      max={100}
                                      step={0.5}
                                      value={Math.min(100, Number(draft.insuranceCoveragePercent) || 0)}
                                      onChange={(e) => onInsurancePercentChange(item, e.target.value)}
                                      className="mt-3 w-full accent-violet-600"
                                    />
                                  </div>
                                  <div className="rounded-lg border border-violet-100 bg-white/90 p-3 text-sm">
                                    <p className="flex justify-between text-slate-600">
                                      <span>{t("Insurance discount")}</span>
                                      <span className="font-bold text-slate-900">
                                        {currency}
                                        {discountAmount}
                                      </span>
                                    </p>
                                    <p className="mt-2 flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
                                      <span>{t("Patient pays")}</span>
                                      <span>
                                        {currency}
                                        {finalAmount}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="text-xs font-semibold text-slate-600">{t("Discount amount")}</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={baseAmount}
                                  step={0.01}
                                  value={discountAmount === 0 ? "" : discountAmount}
                                  onChange={(e) => onDiscountAmountInput(item, e.target.value)}
                                  disabled={status === "Cancelled" || (isPaidDraft && draft.paymentMethod === "Free")}
                                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-100"
                                  placeholder="0"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-slate-600">{t("Discount reason")}</label>
                                <input
                                  value={draft.discountReason}
                                  onChange={(e) => setPaymentDraft(item._id, { discountReason: e.target.value })}
                                  disabled={status === "Cancelled"}
                                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                                  placeholder={t("e.g. staff discount")}
                                />
                              </div>
                            </div>

                            <label className="mt-3 block text-xs font-semibold text-slate-600">{t("Payment note")}</label>
                            <textarea
                              value={draft.paymentNote}
                              onChange={(e) => setPaymentDraft(item._id, { paymentNote: e.target.value })}
                              rows={2}
                              disabled={status === "Cancelled"}
                              className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                              placeholder={t("Receipt notes, reference…")}
                            />

                            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => savePayment(item)}
                                disabled={status === "Cancelled" || savingPaymentId === item._id}
                                className="h-11 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {savingPaymentId === item._id ? t("Saving…") : t("Save payment")}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {isHomeVisit(item) && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 ring-1 ring-emerald-100">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                              <Home className="h-4 w-4" />
                              {t("Home visit address")}
                            </p>
                            <p className="text-xs text-emerald-800">{formatHomeVisitAddress(item.homeVisitAddress) || t("No address saved yet")}</p>
                          </div>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-[160px_1fr_100px_80px_80px_1fr_auto]">
                            <select
                              value={addressDraft.area}
                              onChange={(e) => setHomeAddressDraft(item._id, { area: e.target.value })}
                              className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm outline-none"
                            >
                              <option value="">{t("Choose area")}</option>
                              {supportedHomeVisitAreas.map((area) => (
                                <option key={area} value={area}>
                                  {area}
                                </option>
                              ))}
                            </select>
                            <input
                              value={addressDraft.street}
                              onChange={(e) => setHomeAddressDraft(item._id, { street: e.target.value })}
                              className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm outline-none"
                              placeholder={t("Street")}
                            />
                            <input
                              value={addressDraft.building}
                              onChange={(e) => setHomeAddressDraft(item._id, { building: e.target.value })}
                              className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm outline-none"
                              placeholder={t("Building")}
                            />
                            <input
                              value={addressDraft.floor}
                              onChange={(e) => setHomeAddressDraft(item._id, { floor: e.target.value })}
                              className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm outline-none"
                              placeholder={t("Floor")}
                            />
                            <input
                              value={addressDraft.apartment}
                              onChange={(e) => setHomeAddressDraft(item._id, { apartment: e.target.value })}
                              className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm outline-none"
                              placeholder={t("Apt")}
                            />
                            <input
                              value={addressDraft.notes}
                              onChange={(e) => setHomeAddressDraft(item._id, { notes: e.target.value })}
                              className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm outline-none"
                              placeholder={t("Notes")}
                            />
                            <button
                              type="button"
                              onClick={() => updateHomeVisitAddress(item._id, addressDraft)}
                              className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white"
                            >
                              {t("Save")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceptionistAppointments;
