import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarPlus,
  Clock,
  CreditCard,
  DoorOpen,
  RefreshCw,
  Search,
  Stethoscope,
  TrendingUp,
  UserCheck,
  Users,
  Video,
  Phone,
  MapPin,
  Wallet,
  AlertCircle,
} from "lucide-react";
import { ReceptionistContext } from "../../context/ReceptionistContext";
import { AppContext } from "../../context/AppContext";
import { LANGUAGES } from "../../i18n";

const getAppointmentStatus = (item) =>
  item.appointmentStatus || (item.cancelled ? "Cancelled" : item.isCompleted ? "Finished" : "Booked");

const getReservationLabel = (item) =>
  item.reservationNumber || `RES-${String(item._id || "").slice(-6).toUpperCase()}`;

const parseSlotDateToDate = (slotDate) => {
  if (!slotDate || typeof slotDate !== "string") return null;
  const parts = slotDate.split("_").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [day, month, year] = parts;
  return new Date(year, month - 1, day);
};

const statusBadgeClass = (status) => {
  if (status === "Finished") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100";
  if (status === "Cancelled") return "bg-rose-50 text-rose-800 ring-1 ring-rose-100";
  if (status === "Checked In") return "bg-sky-50 text-sky-800 ring-1 ring-sky-100";
  if (status === "In Progress") return "bg-amber-50 text-amber-900 ring-1 ring-amber-100";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
};

const ReceptionistDashboard = () => {
  const { rToken, dashData, dashDataLoading, getReceptionistDashboard } = useContext(ReceptionistContext);
  const { slotDateFormat, currency, language, t } = useContext(AppContext);
  const [refreshing, setRefreshing] = useState(false);
  const [staleData, setStaleData] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [queueSearch, setQueueSearch] = useState("");
  const [queueFilter, setQueueFilter] = useState("all");

  const locale = LANGUAGES[language]?.locale || "en-US";

  const todaySlotKey = useMemo(() => {
    const d = new Date();
    return `${d.getDate()}_${d.getMonth() + 1}_${d.getFullYear()}`;
  }, []);

  useEffect(() => {
    if (dashData && !dashDataLoading) {
      setLastUpdated(new Date());
    }
  }, [dashData, dashDataLoading]);

  const onRefresh = async () => {
    if (!rToken || refreshing) return;
    setRefreshing(true);
    const ok = await getReceptionistDashboard();
    if (ok) {
      setStaleData(false);
      setLastUpdated(new Date());
    } else {
      setStaleData(true);
    }
    setRefreshing(false);
  };

  const longDateLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()),
    [locale]
  );

  const todayQueue = useMemo(() => {
    if (dashData?.todayQueue?.length) return dashData.todayQueue;
    const list = dashData?.latestAppointments;
    if (!Array.isArray(list)) return [];
    return list
      .filter((row) => row.slotDate === todaySlotKey && !row.cancelled && row.appointmentStatus !== "Cancelled")
      .map((row) => ({
        _id: row._id,
        userData: {
          name: row.userData?.name,
          phone: row.userData?.phone,
          patientId: row.userData?.patientId,
        },
        docData: { name: row.docData?.name, speciality: row.docData?.speciality },
        slotTime: row.slotTime,
        slotDate: row.slotDate,
        appointmentStatus: row.appointmentStatus,
        paymentStatus: row.paymentStatus,
        cancelled: row.cancelled,
        isCompleted: row.isCompleted,
        amount: Number(row.amount || 0),
        clinicLocation: row.clinicLocation || "",
        appointmentType: row.appointmentType || "Clinic",
        reservationNumber: row.reservationNumber || "",
        bookedBy: row.bookedBy || "Patient",
      }));
  }, [dashData?.todayQueue, dashData?.latestAppointments, todaySlotKey]);
  const weekTrend = dashData?.weekTrend ?? [];
  const maxWeekCount = Math.max(1, ...weekTrend.map((d) => Number(d?.count) || 0));

  const filteredQueue = useMemo(() => {
    const q = queueSearch.toLowerCase().trim();
    return todayQueue.filter((row) => {
      const status = getAppointmentStatus(row);
      const hay = [
        row.userData?.name,
        row.userData?.patientId,
        row.userData?.phone,
        row.docData?.name,
        row.docData?.speciality,
        getReservationLabel(row),
        row.clinicLocation,
        row.appointmentType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !q || hay.includes(q);
      const unpaid = row.paymentStatus !== "Paid";
      if (queueFilter === "unpaid") return matchesSearch && unpaid;
      if (queueFilter === "action") return matchesSearch && unpaid && ["Booked", "Checked In", "In Progress"].includes(status);
      return matchesSearch;
    });
  }, [todayQueue, queueSearch, queueFilter]);

  if (!rToken) return null;

  if (dashDataLoading && !dashData) {
    return (
      <div className="w-full p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1500px] animate-pulse space-y-6">
          <div className="h-10 max-w-md rounded-lg bg-slate-200" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-2xl border border-slate-100 bg-white" />
            ))}
          </div>
          <div className="h-96 rounded-2xl border border-slate-100 bg-white" />
        </div>
      </div>
    );
  }

  if (!dashData) {
    return (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <div>
          <p className="text-lg font-semibold text-slate-800">{t("Could not load dashboard")}</p>
          <p className="mt-1 text-sm text-slate-500">{t("Check your connection and try again.")}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
        >
          {t("Reload")}
        </button>
      </div>
    );
  }

  const paidTodayCount = dashData.paidTodayCount ?? 0;
  const unpaidToday = dashData.unpaidToday ?? 0;
  const totalDueToday = dashData.totalDueToday ?? 0;
  const doctorsTodayCount = dashData.doctorsTodayCount ?? 0;
  const needsAttention = dashData.needsAttention ?? 0;
  const finishedToday = dashData.finishedToday ?? 0;
  const cancelledToday = dashData.cancelledToday ?? 0;

  const primaryStats = [
    { label: t("Today"), value: dashData.todayAppointments, icon: CalendarCheck, accent: "from-sky-500/10 to-sky-600/5 text-sky-600" },
    { label: t("Checked In"), value: dashData.checkedIn, icon: UserCheck, accent: "from-emerald-500/10 to-emerald-600/5 text-emerald-600" },
    { label: t("In Progress"), value: dashData.inProgress, icon: Clock, accent: "from-amber-500/15 to-amber-600/5 text-amber-700" },
    { label: t("Outstanding (total)"), value: dashData.unpaid, icon: CreditCard, accent: "from-rose-500/10 to-rose-600/5 text-rose-600" },
  ];

  const secondaryStats = [
    { label: t("Paid visits today"), value: paidTodayCount, hint: `${currency}${dashData.paidToday} ${t("collected")}`, icon: Wallet },
    { label: t("Outstanding today"), value: unpaidToday, hint: `${currency}${totalDueToday} ${t("still due")}`, icon: TrendingUp },
    { label: t("Doctors on schedule"), value: doctorsTodayCount, hint: t("Unique doctors with visits"), icon: Stethoscope },
    { label: t("Needs payment"), value: needsAttention, hint: t("Active visits not fully paid"), icon: AlertCircle },
  ];

  const quickLinks = [
    { to: "/receptionist-book-appointment", label: t("Book Appointment"), icon: CalendarPlus, variant: "primary" },
    { to: "/receptionist-appointments", label: t("Appointments"), icon: CalendarCheck, variant: "default" },
    { to: "/receptionist-patients", label: t("Patients"), icon: Users, variant: "default" },
    { to: "/receptionist-clinics", label: t("Clinics"), icon: Building2, variant: "default" },
  ];

  return (
    <div className="w-full bg-gradient-to-b from-slate-50/80 to-white p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                <DoorOpen className="h-3.5 w-3.5" />
                {t("Front desk")}
              </span>
              {staleData && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
                  {t("Could not refresh; showing last loaded data.")}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t("Reception Desk")}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              {t("Today's queue, check-ins, payments, and quick access to common tasks.")}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-400">{longDateLabel}</p>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {lastUpdated && (
              <p className="text-center text-xs text-slate-400 sm:text-right">
                {t("Updated")}{" "}
                {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(lastUpdated)}
              </p>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {t("Refresh")}
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
          {quickLinks.map(({ to, label, icon: Icon, variant }) => (
            <Link
              key={to}
              to={to}
              className={`group flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-semibold shadow-sm transition ${
                variant === "primary"
                  ? "border-primary/30 bg-primary text-white hover:bg-primary/95"
                  : "border-slate-200 bg-white text-slate-800 hover:border-primary/30 hover:bg-slate-50"
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${variant === "primary" ? "text-white" : "text-primary"}`} />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <ArrowRight className={`h-4 w-4 shrink-0 opacity-60 transition group-hover:translate-x-0.5 ${variant === "primary" ? "text-white" : ""}`} />
            </Link>
          ))}
        </div>

        {/* Primary KPIs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {primaryStats.map(({ label, value, icon: Icon, accent }) => (
            <div
              key={label}
              className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-90`} aria-hidden />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
                </div>
                <div className="rounded-xl bg-white/80 p-2.5 shadow-sm ring-1 ring-slate-100">
                  <Icon className="h-6 w-6 text-slate-700" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {secondaryStats.map(({ label, value, hint, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{hint}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Today's schedule */}
          <div className="space-y-4 xl:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{t("Today's schedule")}</h2>
                  <p className="text-xs text-slate-500">
                    {finishedToday} {t("finished")} · {cancelledToday} {t("cancelled")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {["all", "action", "unpaid"].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setQueueFilter(key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        queueFilter === key ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {key === "all" ? t("All") : key === "unpaid" ? t("Unpaid") : t("Action needed")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-b border-slate-100 p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder={t("Search by patient, phone, doctor, ref…")}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none ring-primary/0 transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>
              </div>

              {filteredQueue.length === 0 ? (
                <div className="px-5 py-16 text-center text-sm text-slate-500">{t("No visits match your filters for today.")}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-white text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="whitespace-nowrap px-5 py-3">{t("Time")}</th>
                        <th className="px-5 py-3">{t("Patient")}</th>
                        <th className="hidden px-5 py-3 md:table-cell">{t("Doctor")}</th>
                        <th className="hidden px-5 py-3 lg:table-cell">{t("Location / mode")}</th>
                        <th className="whitespace-nowrap px-5 py-3">{t("Fees")}</th>
                        <th className="px-5 py-3">{t("Status")}</th>
                        <th className="whitespace-nowrap px-5 py-3 text-right">{t("Actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredQueue.map((row) => {
                        const st = getAppointmentStatus(row);
                        const res = getReservationLabel(row);
                        const q = encodeURIComponent(row.userData?.name || res || "");
                        const remote = ["Voice Call", "Video Call"].includes(row.appointmentType);
                        return (
                          <tr key={row._id} className="bg-white transition hover:bg-slate-50/80">
                            <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-900">{row.slotTime}</td>
                            <td className="px-5 py-3">
                              <p className="font-semibold text-slate-900">{row.userData?.name || "—"}</p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                                <span className="font-mono text-slate-600">{res}</span>
                                {row.userData?.phone && (
                                  <span className="inline-flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {row.userData.phone}
                                  </span>
                                )}
                              </p>
                            </td>
                            <td className="hidden px-5 py-3 text-slate-700 md:table-cell">
                              <span className="font-medium">{row.docData?.name}</span>
                              {row.docData?.speciality && (
                                <span className="mt-0.5 block text-xs text-slate-500">{row.docData.speciality}</span>
                              )}
                            </td>
                            <td className="hidden px-5 py-3 text-slate-600 lg:table-cell">
                              <span className="inline-flex items-center gap-1">
                                {remote ? <Video className="h-3.5 w-3.5 shrink-0 text-violet-600" /> : <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                                <span className="line-clamp-2">{remote ? row.appointmentType : row.clinicLocation || t("Clinic")}</span>
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 font-medium tabular-nums text-slate-800">
                              {currency}
                              {row.amount}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(st)}`}>{st}</span>
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    row.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100" : "bg-rose-50 text-rose-800 ring-1 ring-rose-100"
                                  }`}
                                >
                                  {row.paymentStatus === "Paid" ? t("Paid") : t("Not Paid")}
                                </span>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-right">
                              <Link
                                to={`/receptionist-appointments?q=${q}`}
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                              >
                                {t("Manage")}
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: chart + recent */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-slate-900">{t("Weekly volume")}</h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">{t("Active appointments per day (last 7 days)")}</p>
              <div className="mt-6 flex h-36 items-end justify-between gap-1.5">
                {weekTrend.map((day) => {
                  const dt = parseSlotDateToDate(day.slotDate);
                  const dayLabel = dt
                    ? new Intl.DateTimeFormat(locale, { weekday: "short" }).format(dt)
                    : "";
                  const barHeightPx = Math.max(6, Math.round((day.count / maxWeekCount) * 104));
                  const isToday = day.slotDate === todaySlotKey;
                  return (
                    <div key={day.slotDate} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-[110px] w-full flex-col justify-end">
                        <div
                          className={`mx-auto w-full max-w-[44px] rounded-t-lg transition ${isToday ? "bg-primary" : "bg-slate-200"}`}
                          style={{ height: `${barHeightPx}px` }}
                          title={`${day.count}`}
                        />
                      </div>
                      <span className="text-[10px] font-semibold uppercase text-slate-400">{dayLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h3 className="text-sm font-bold text-slate-900">{t("Recent bookings")}</h3>
                <span className="text-xs font-medium text-emerald-700">
                  {currency}
                  {dashData.paidToday} {t("paid today")}
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {(dashData.latestAppointments || []).length === 0 ? (
                  <li className="px-5 py-10 text-center text-sm text-slate-500">{t("No appointments yet")}</li>
                ) : (
                  dashData.latestAppointments.map((item) => {
                    const st = getAppointmentStatus(item);
                    return (
                      <li key={item._id} className="px-5 py-3.5 transition hover:bg-slate-50/80">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{item.userData?.name}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {item.docData?.name} · {slotDateFormat(item.slotDate)}, {item.slotTime}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(st)}`}>{st}</span>
                            <span className={`text-[10px] font-semibold ${item.paymentStatus === "Paid" ? "text-emerald-600" : "text-rose-600"}`}>
                              {item.paymentStatus === "Paid" ? t("Paid") : t("Not Paid")}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="border-t border-slate-100 px-5 py-3">
                <Link to="/receptionist-appointments" className="text-xs font-semibold text-primary hover:underline">
                  {t("View all appointments")} →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceptionistDashboard;
