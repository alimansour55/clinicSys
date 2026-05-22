import React from "react";
import { getInsuranceStatus, insuranceStatusLabel, insuranceStatusTone } from "../utils/insuranceVerification";

export default function InsuranceStatusBadge({ insurance, t = (s) => s, className = "" }) {
  const status = getInsuranceStatus(insurance);
  if (!insurance?.enabled && status === "none") return null;

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${insuranceStatusTone(status)} ${className}`}>
      {insuranceStatusLabel(status, t)}
    </span>
  );
}
