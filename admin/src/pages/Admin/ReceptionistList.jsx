import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, RefreshCw, Search, ShieldCheck, UserCheck, UserCog, UserPlus, UserX } from "lucide-react";
import { AdminContext } from "../../context/AdminContext";
import { useLanguage } from "../../i18n";
import { AdminPage, BulkBar, ExportButton, SelectBox, StatCard, selectionFor } from "../../components/admin/AdminPage";
import { Badge, Button, EmptyState, Field, Input, notify, Select, Skeleton, SkeletonGroup } from "../../components/ui";
import { downloadCsv } from "../../utils/csvExport";

const ReceptionistList = () => {
  const { aToken, receptionists, getReceptionists, changeReceptionistStatus, bulkUserStatus, bulkUserMfa } = useContext(AdminContext);
  const { t, tc, localizeDigits } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState([]);

  const loadReceptionists = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    await getReceptionists();
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  };

  useEffect(() => {
    if (aToken) loadReceptionists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken]);

  const nameOf = (item) => tc(item.i18n?.name) || item.name;

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
      return [item.name, item.i18n?.name?.ar, item.i18n?.name?.en, item.email, item.phone, item.jobTitle, item.department]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [receptionists, searchQuery, statusFilter]);

  const visibleIds = filtered.map((item) => item._id);
  const selection = selectionFor(selected, visibleIds);
  const toUsers = (ids) => ids.map((profileId) => ({ profileType: "receptionist", profileId }));

  const toggle = (id, on) => setSelected((previous) => (on ? [...previous, id] : previous.filter((value) => value !== id)));

  const runBulk = async (action) => {
    const result = await action();
    if (!result) return;
    notify.success(`${t("Accounts updated")}: ${localizeDigits(result.updated)}`);
    setSelected([]);
    loadReceptionists(true);
  };

  const exportRows = () =>
    downloadCsv(
      "receptionists",
      [
        { label: t("Name"), value: (row) => nameOf(row) },
        { label: t("Email"), value: (row) => row.email },
        { label: t("Phone"), value: (row) => row.phone },
        { label: t("Job title"), value: (row) => row.jobTitle },
        { label: t("Department"), value: (row) => row.department },
        { label: t("Status"), value: (row) => (row.isActive !== false ? t("Active") : t("Disabled")) },
      ],
      filtered,
    );

  return (
    <AdminPage
      icon={UserCog}
      title={t("Receptionists")}
      description={t("Manage front desk accounts, open profiles to edit details, or add new receptionist staff.")}
      actions={
        <>
          <Button as={Link} to="/add-receptionist" size="sm" leadingIcon={<UserPlus aria-hidden="true" className="size-4" />}>
            {t("Add Receptionist")}
          </Button>
          <ExportButton onExport={exportRows} disabled={!filtered.length} />
          <Button variant="secondary" size="sm" onClick={() => loadReceptionists(true)} disabled={refreshing} leadingIcon={<RefreshCw aria-hidden="true" className={`size-4 ${refreshing ? "animate-spin" : ""}`} />}>
            {t("Refresh")}
          </Button>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label={t("Total")} value={localizeDigits(stats.total)} />
        <StatCard label={t("Active")} value={localizeDigits(stats.active)} />
        <StatCard label={t("Inactive")} value={localizeDigits(stats.inactive)} />
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Field label={t("Search")}>
            <Input className="ps-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("Search name, email, phone…")} />
          </Field>
          <Search aria-hidden="true" className="pointer-events-none absolute bottom-3.5 start-3 size-4 text-ink-3" />
        </div>
        <Field label={t("Status")} className="sm:w-52">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">{t("All statuses")}</option>
            <option value="active">{t("Active only")}</option>
            <option value="inactive">{t("Inactive only")}</option>
          </Select>
        </Field>
        <p className="pb-2.5 text-body-sm text-ink-3">{`${t("Showing")} ${localizeDigits(filtered.length)} ${t("of")} ${localizeDigits(receptionists.length)}`}</p>
      </div>

      <BulkBar count={selection.count} onClear={() => setSelected([])}>
        <Button size="sm" variant="secondary" onClick={() => runBulk(() => bulkUserStatus(toUsers(selection.ids), true))} leadingIcon={<UserCheck aria-hidden="true" className="size-4" />}>
          {t("Activate")}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => runBulk(() => bulkUserStatus(toUsers(selection.ids), false))} leadingIcon={<UserX aria-hidden="true" className="size-4" />}>
          {t("Deactivate")}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => runBulk(() => bulkUserMfa(toUsers(selection.ids), true))} leadingIcon={<ShieldCheck aria-hidden="true" className="size-4" />}>
          {t("Require MFA")}
        </Button>
      </BulkBar>

      <div className="overflow-hidden rounded-card border border-line bg-surface">
        {loading ? (
          <SkeletonGroup className="space-y-3 p-4">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-14 w-full" />
            ))}
          </SkeletonGroup>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<UserCog aria-hidden="true" className="size-6" />}
            title={t("No receptionists match")}
            description={t("Try another search or add a new receptionist account.")}
            action={
              <Button as={Link} to="/add-receptionist" leadingIcon={<UserPlus aria-hidden="true" className="size-4" />}>
                {t("Add Receptionist")}
              </Button>
            }
          />
        ) : (
          <>
            <label className="flex items-center gap-3 border-b border-line bg-surface-sunken px-4 py-2.5 text-caption font-semibold text-ink-3">
              <SelectBox
                label={t("Select all")}
                checked={selection.all}
                indeterminate={selection.some}
                onChange={(on) => setSelected(on ? visibleIds : [])}
              />
              {t("Select all")}
            </label>
            <ul className="divide-y divide-line">
              {filtered.map((item) => (
                <li key={item._id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                  <SelectBox label={`${t("Select")} ${nameOf(item)}`} checked={selected.includes(item._id)} onChange={(on) => toggle(item._id, on)} />
                  <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
                    <div className="size-11 shrink-0 overflow-hidden rounded-full border border-line bg-surface-sunken">
                      {item.image ? (
                        <img src={item.image} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-body-sm font-bold text-ink-3">{(nameOf(item) || "?").charAt(0)}</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{nameOf(item)}</p>
                      {item.jobTitle && item.jobTitle !== "Receptionist" && <p className="truncate text-caption text-ink-3">{item.jobTitle}</p>}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 basis-56 text-body-sm text-ink-2">
                    <p dir="ltr" className="truncate text-start">{item.email}</p>
                    <p dir="ltr" className="truncate text-start text-caption text-ink-3">{item.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => changeReceptionistStatus(item._id)}
                    title={item.isActive ? t("Deactivate") : t("Activate")}
                    className="cursor-pointer"
                  >
                    <Badge tone={item.isActive ? "success" : "danger"} dot>
                      {item.isActive ? t("Active") : t("Disabled")}
                    </Badge>
                  </button>
                  <Button as={Link} to={`/edit-receptionist/${item._id}`} variant="secondary" size="sm" leadingIcon={<Pencil aria-hidden="true" className="size-4" />}>
                    {t("Edit profile")}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </AdminPage>
  );
};

export default ReceptionistList;
