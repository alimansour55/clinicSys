import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, ChevronDown, Loader2, Pencil, RefreshCw, Search, Sparkles, UserCog, UserPlus, X } from "lucide-react";
import { AdminContext } from "../../context/AdminContext";
import { useLanguage } from "../../i18n";

const ReceptionistList = () => {
  const { aToken, receptionists, getReceptionists, changeReceptionistStatus } = useContext(AdminContext);
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadReceptionists = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    await getReceptionists();
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  };

  useEffect(() => {
    if (aToken) loadReceptionists();
  }, [aToken]);

  const stats = useMemo(() => {
    const total = receptionists.length;
    const active = receptionists.filter((r) => r.isActive !== false).length;
    return { total, active, inactive: total - active };
  }, [receptionists]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return receptionists.filter((item) => {
      if (statusFilter === "active" && item.isActive === false) return false;
      if (statusFilter === "inactive" && item.isActive !== false) return false;
      if (!q) return true;
      return [item.name, item.email, item.phone, item.jobTitle, item.department]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [receptionists, searchQuery, statusFilter]);

  return (
    <div className="w-full bg-[#f4f6fb] p-3 sm:p-5 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-2xl border border-slate-700/20 bg-gradient-to-br from-slate-900 via-slate-800 to-rose-900 shadow-xl">
          <div className="relative px-5 py-8 sm:px-8 sm:py-10">
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/90 ring-1 ring-white/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("Receptionists")}
                </div>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t("Receptionists")}</h1>
                <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">
                  Manage front desk accounts, open profiles to edit details, or add new receptionist staff.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/add-receptionist"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-md transition hover:bg-white/95"
                >
                  <UserPlus className="h-4 w-4 text-primary" />
                  {t("Add Receptionist")}
                </Link>
                <button
                  type="button"
                  onClick={() => loadReceptionists(true)}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  {t("Refresh")}
                </button>
              </div>
            </div>
            <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: "Total", value: stats.total },
                { label: "Active", value: stats.active },
                { label: "Inactive", value: stats.inactive },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, phone…"
                className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
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
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          <p className="text-center text-sm font-medium text-gray-600 lg:text-right">
            Showing <span className="font-bold text-gray-900">{filtered.length}</span> of {receptionists.length}
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-2 border-b border-gray-100 bg-gray-50/90 px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 lg:grid">
            <span>Staff</span>
            <span>Email</span>
            <span>Phone</span>
            <span>Status</span>
            <span className="text-right pr-2">Actions</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-500">
              <Loader2 className="h-9 w-9 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <UserCog className="h-8 w-8" />
              </div>
              <p className="mt-4 text-lg font-semibold text-gray-900">No receptionists match</p>
              <p className="mt-1 text-sm text-gray-600">Try another search or add a new receptionist account.</p>
              <Link
                to="/add-receptionist"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
              >
                <UserPlus className="h-4 w-4" />
                {t("Add Receptionist")}
              </Link>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item._id}
                className="grid grid-cols-1 gap-3 border-b border-gray-100 px-5 py-4 text-sm text-gray-600 last:border-b-0 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center lg:gap-2"
              >
                <div className="flex min-w-0 items-center gap-3 font-medium text-gray-800">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                    {item.image ? (
                      <img src={item.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-gray-500">
                        {(item.name || "?").charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate">
                      <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{item.name}</span>
                    </p>
                    {item.jobTitle && item.jobTitle !== "Receptionist" && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">{item.jobTitle}</p>
                    )}
                  </div>
                </div>
                <p className="break-all">{item.email}</p>
                <p>{item.phone}</p>
                <button
                  type="button"
                  onClick={() => changeReceptionistStatus(item._id)}
                  className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${item.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                >
                  {item.isActive ? "Active" : "Disabled"}
                </button>
                <div className="flex lg:justify-end">
                  <Link
                    to={`/edit-receptionist/${item._id}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-[#F2F3FF] px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit profile
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceptionistList;
