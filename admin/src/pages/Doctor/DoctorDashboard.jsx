import React, { useContext, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { DoctorContext } from "../../context/DoctorContext";
import { AppContext } from "../../context/AppContext";
import { assets } from "../../assets/assets";
import { useLanguage } from "../../i18n";
import {
  Ban,
  Building2,
  Calendar,
  CalendarClock,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Clock,
  Home,
  LayoutGrid,
  Phone,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  Video,
  Wallet,
  XCircle,
} from "lucide-react";

const getReservationRef = (appointment) =>
  appointment.reservationNumber || `RES-${String(appointment._id || "").slice(-6).toUpperCase()}`;

const visitTypeIcon = (type) => {
  switch (type) {
    case "Video Call":
      return Video;
    case "Voice Call":
      return Phone;
    case "Home Visit":
      return Home;
    default:
      return Building2;
  }
};

const DoctorDashboard = () => {
  const { dToken, dashData, getDashData, cancelAppointment, profileData, getProfileData, dashDataLoading } =
    useContext(DoctorContext);
  const { currency, slotDateFormat } = useContext(AppContext);
  const { t, language, isRtl } = useLanguage();

  const [retryLoading, setRetryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await getDashData();
    } finally {
      setRefreshing(false);
    }
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t("Good morning");
    if (h < 17) return t("Good afternoon");
    return t("Good evening");
  }, [t]);

  const handleCancel = (id) => {
    if (window.confirm(t("Cancel this appointment? This cannot be undone."))) {
      cancelAppointment(id);
    }
  };

  const fmtMoney = (n) =>
    Number(n || 0).toLocaleString(language === "ar" ? "ar-EG" : "en-US", {
      maximumFractionDigits: 0,
    });

  if (!dToken) return null;

  if ((dashDataLoading || retryLoading) && !dashData) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto animate-pulse">
        <div className="h-36 rounded-2xl bg-slate-200/80 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-200/70" />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-200/60" />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-slate-200/70" />
      </div>
    );
  }

  if (!dashData) {
    return (
      <div className="p-6 lg:p-10 max-w-lg mx-auto text-center">
        <p className="text-slate-600 font-medium mb-2">{t("Could not load your dashboard.")}</p>
        <button
          type="button"
          onClick={async () => {
            setRetryLoading(true);
            try {
              await Promise.all([getDashData(), getProfileData()]);
            } finally {
              setRetryLoading(false);
            }
          }}
          disabled={retryLoading}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {retryLoading ? t("Loading...") : t("Try again")}
        </button>
      </div>
    );
  }

  const pending = dashData.pendingCount ?? 0;
  const completed = dashData.completedCount ?? 0;
  const cancelled = dashData.cancelledCount ?? 0;
  const today = dashData.todayActiveCount ?? 0;

  const pulse = [
    {
      label: t("Scheduled for today"),
      value: today,
      icon: Calendar,
      tone: "from-sky-500/15 to-blue-600/10 border-sky-200/80 text-sky-800",
      iconBg: "bg-sky-500/15 text-sky-600",
    },
    {
      label: t("Open visits"),
      value: pending,
      icon: CalendarClock,
      tone: "from-amber-500/12 to-orange-500/10 border-amber-200/80 text-amber-900",
      iconBg: "bg-amber-500/15 text-amber-700",
    },
    {
      label: t("Finished visits"),
      value: completed,
      icon: CircleCheck,
      tone: "from-emerald-500/12 to-teal-500/10 border-emerald-200/80 text-emerald-900",
      iconBg: "bg-emerald-500/15 text-emerald-700",
    },
    {
      label: t("Cancelled"),
      value: cancelled,
      icon: Ban,
      tone: "from-rose-500/10 to-red-500/8 border-rose-200/70 text-rose-900",
      iconBg: "bg-rose-500/12 text-rose-600",
    },
  ];

  const quickLinks = [
    {
      to: "/doctor-appointments",
      label: t("Appointments"),
      sub: t("Manage appointments"),
      icon: ClipboardList,
      wrap: "from-violet-600 to-indigo-600 shadow-indigo-500/25",
    },
    {
      to: "/doctor-availability",
      label: t("Availability"),
      sub: t("Manage calendar"),
      icon: LayoutGrid,
      wrap: "from-cyan-600 to-blue-600 shadow-cyan-500/20",
    },
    {
      to: "/patient-history",
      label: t("Patient History"),
      sub: t("Visit records"),
      icon: Users,
      wrap: "from-teal-600 to-emerald-600 shadow-teal-500/20",
    },
    {
      to: "/doctor-financial-analysis",
      label: t("Financial Analysis"),
      sub: t("Revenue insights"),
      icon: TrendingUp,
      wrap: "from-amber-500 to-orange-600 shadow-amber-500/25",
    },
  ];

  const doctorName = profileData?.name || t("Doctor");

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-12 max-w-6xl mx-auto">
      {/* Welcome */}
      <div
        className={`relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl shadow-slate-900/15 mb-8 ${isRtl ? "text-right" : "text-left"}`}
      >
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_20%_20%,#fff,transparent_45%),radial-gradient(circle_at_80%_60%,#38bdf8,transparent_40%)]" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6 p-6 sm:p-8">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-sky-400/30 blur-lg scale-110" />
              <img
                src={profileData?.image || assets.doctor_icon}
                alt=""
                className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-cover ring-2 ring-white/20 shadow-lg bg-slate-700"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sky-200/90 text-sm font-medium tracking-wide uppercase">
                {greeting}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate mt-0.5">
                {t("Welcome back")}, {doctorName}
              </h1>
              <p className="text-slate-300 text-sm sm:text-base mt-2 max-w-xl leading-relaxed">
                {t("Here is your practice at a glance.")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-stretch shrink-0">
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              {t("Refresh")}
            </button>
            <NavLink
              to="/doctor-appointments"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-900 px-4 py-2.5 text-sm font-semibold shadow-lg shadow-sky-500/20 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {t("View all appointments")}
            </NavLink>
          </div>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("Total earnings")}
              </p>
              <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                {currency}
                {fmtMoney(dashData.earnings)}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t("Paid or completed visits")}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/12 p-3 text-emerald-600 ring-1 ring-emerald-500/20">
              <Wallet className="w-6 h-6" strokeWidth={1.75} />
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("Total appointments")}
              </p>
              <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                {dashData.appointments}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t("All registered visits")}</p>
            </div>
            <div className="rounded-xl bg-blue-500/12 p-3 text-blue-600 ring-1 ring-blue-500/20">
              <CalendarClock className="w-6 h-6" strokeWidth={1.75} />
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("Total patients")}
              </p>
              <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                {dashData.patients}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t("Unique patients served")}</p>
            </div>
            <div className="rounded-xl bg-violet-500/12 p-3 text-violet-600 ring-1 ring-violet-500/20">
              <Users className="w-6 h-6" strokeWidth={1.75} />
            </div>
          </div>
        </div>
      </div>

      {/* Practice pulse */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-1 rounded-full bg-gradient-to-b from-sky-500 to-indigo-600" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">
            {t("Practice pulse")}
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {pulse.map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.label}
                className={`rounded-xl border bg-gradient-to-br p-4 shadow-sm ${row.tone}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex rounded-lg p-2 ${row.iconBg}`}>
                    <Icon className="w-4 h-4" strokeWidth={2} />
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-slate-900">{row.value}</span>
                </div>
                <p className="mt-3 text-xs font-semibold leading-snug text-slate-600">{row.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent bookings */}
        <div className="xl:col-span-2 rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/80">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t("Recent activity")}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t("Your latest bookings, newest first.")}</p>
            </div>
            <NavLink
              to="/doctor-appointments"
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              {t("View all appointments")}
              <ChevronRight className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
            </NavLink>
          </div>

          {dashData.latestAppointments?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-start border-b border-slate-100 bg-white text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">{t("Patient")}</th>
                    <th className="px-3 py-3 font-semibold">{t("Date")}</th>
                    <th className="px-3 py-3 font-semibold">{t("Time")}</th>
                    <th className="px-3 py-3 font-semibold">{t("Visit type")}</th>
                    <th className="px-3 py-3 font-semibold">{t("Fee")}</th>
                    <th className="px-3 py-3 font-semibold">{t("Status")}</th>
                    <th className="px-5 py-3 font-semibold w-24">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashData.latestAppointments.map((item) => {
                    const TypeIcon = visitTypeIcon(item.appointmentType);
                    const mode = item.appointmentType || "Clinic";
                    return (
                      <tr key={item._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              className="rounded-full w-10 h-10 object-cover ring-2 ring-slate-100 shrink-0 bg-slate-100"
                              src={item.userData?.image || assets.people_icon}
                              alt=""
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">
                                {item.userData?.name || "—"}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono truncate">
                                {t("Ref")}: {getReservationRef(item)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-slate-700 whitespace-nowrap">
                          {item.slotDate ? slotDateFormat(item.slotDate) : "—"}
                        </td>
                        <td className="px-3 py-3.5 text-slate-700 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {item.slotTime || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            <TypeIcon className="w-3.5 h-3.5 shrink-0" />
                            {t(mode)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 font-semibold tabular-nums text-slate-800 whitespace-nowrap">
                          {currency}
                          {fmtMoney(item.amount)}
                        </td>
                        <td className="px-3 py-3.5">
                          {item.cancelled ? (
                            <span className="inline-flex rounded-full bg-rose-50 text-rose-700 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-rose-100">
                              {t("Cancelled")}
                            </span>
                          ) : item.isCompleted ? (
                            <span className="inline-flex rounded-full bg-emerald-50 text-emerald-800 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-emerald-100">
                              {t("Completed")}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-amber-50 text-amber-800 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-amber-100">
                              {t("Pending")}
                            </span>
                          )}
                          <div className="mt-1 text-[10px] text-slate-500">
                            {item.paymentStatus === "Paid" ? t("Paid") : t("Not Paid")}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {item.cancelled || item.isCompleted ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCancel(item._id)}
                              className="inline-flex items-center justify-center rounded-lg p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 ring-1 ring-rose-100 transition-colors"
                              title={t("Cancel")}
                            >
                              <XCircle className="w-5 h-5" strokeWidth={1.75} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 px-6">
              <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" strokeWidth={1.25} />
              <p className="text-slate-500 font-medium">{t("No appointments found")}</p>
              <NavLink
                to="/doctor-availability"
                className="inline-block mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {t("Manage calendar")}
              </NavLink>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm p-5 h-fit">
          <h2 className="text-lg font-bold text-slate-900 mb-1">{t("Quick actions")}</h2>
          <p className="text-xs text-slate-500 mb-5">{t("Shortcuts to your most-used pages.")}</p>
          <ul className="space-y-2">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 hover:shadow-md p-3 transition-all"
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ${link.wrap}`}
                    >
                      <Icon className="w-5 h-5" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                        {link.label}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{link.sub}</p>
                    </div>
                    <ChevronRight
                      className={`w-5 h-5 text-slate-300 group-hover:text-blue-500 shrink-0 transition-colors ${isRtl ? "rotate-180" : ""}`}
                    />
                  </NavLink>
                </li>
              );
            })}
          </ul>
          <NavLink
            to="/doctor-profile"
            className="mt-5 block w-full text-center rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {t("Profile")}
          </NavLink>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
