import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import {
  getInsuranceStatus,
  insuranceStatusLabel,
  insuranceStatusTone,
  isInsuranceExpired,
  INSURANCE_STATUS,
  visitCheckLabel,
} from "../utils/insuranceVerification";

export default function InsuranceVerificationPanel({
  insurance,
  visitCheck,
  t = (s) => s,
  onVerify,
  saving = false,
  showVisitActions = false,
  compact = false,
}) {
  const [declineReason, setDeclineReason] = useState("");
  const [visitNote, setVisitNote] = useState("");
  const status = getInsuranceStatus(insurance);
  const expired = isInsuranceExpired(insurance?.expiryDate);

  if (!insurance?.enabled) return null;

  const handleProfileDecision = async (decision) => {
    if (!onVerify) return;
    if (decision === INSURANCE_STATUS.DECLINED && !declineReason.trim()) return;
    await onVerify({ status: decision, declineReason: declineReason.trim() });
    if (decision === INSURANCE_STATUS.APPROVED) setDeclineReason("");
  };

  const handleVisitDecision = async (decision) => {
    if (!onVerify) return;
    if (decision === "declined" && !visitNote.trim() && !declineReason.trim()) return;
    await onVerify({
      visitStatus: decision,
      insuranceVisitNote: visitNote.trim() || declineReason.trim(),
      declineReason: declineReason.trim() || visitNote.trim(),
    });
  };

  const box = compact ? "p-3" : "p-4";

  return (
    <section className={`rounded-2xl border border-violet-200 bg-violet-50/60 ${box}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-violet-700" />
          <div>
            <p className="text-sm font-bold text-violet-950">{t("Insurance verification")}</p>
            {!compact && (
              <p className="text-xs text-violet-800">
                {t("Review card details and confirm coverage before using insurance on a visit.")}
              </p>
            )}
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${insuranceStatusTone(status)}`}>
          {insuranceStatusLabel(status, t)}
        </span>
      </header>

      {expired && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {t("Insurance card expiry date has passed. Update details or decline coverage.")}
        </p>
      )}

      {insurance.declineReason && status === INSURANCE_STATUS.DECLINED && (
        <p className="mt-2 text-xs text-rose-800">
          <span className="font-semibold">{t("Reason")}:</span> {insurance.declineReason}
        </p>
      )}

      {visitCheck?.status && (
        <p className="mt-2 text-xs font-semibold text-violet-900">{visitCheckLabel(visitCheck, t)}</p>
      )}

      <div className={`mt-3 grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
        <input
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          placeholder={t("Decline reason (required if declining)")}
          className="h-9 rounded-lg border border-violet-200 bg-white px-3 text-sm sm:col-span-2"
        />
        {showVisitActions && (
          <input
            value={visitNote}
            onChange={(e) => setVisitNote(e.target.value)}
            placeholder={t("Visit note (optional)")}
            className="h-9 rounded-lg border border-violet-200 bg-white px-3 text-sm sm:col-span-2"
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || expired}
          onClick={() => (showVisitActions ? handleVisitDecision("approved") : handleProfileDecision(INSURANCE_STATUS.APPROVED))}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          {showVisitActions ? t("Approve for this visit") : t("Approve insurance")}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => (showVisitActions ? handleVisitDecision("declined") : handleProfileDecision(INSURANCE_STATUS.DECLINED))}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" />
          {showVisitActions ? t("Decline for this visit") : t("Decline insurance")}
        </button>
      </div>
    </section>
  );
}
