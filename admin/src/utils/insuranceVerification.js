export const INSURANCE_STATUS = {
  NONE: "none",
  PENDING: "pending",
  APPROVED: "approved",
  DECLINED: "declined",
};

export const getInsuranceStatus = (insurance = {}) => {
  if (!insurance?.enabled) return INSURANCE_STATUS.NONE;
  const status = String(insurance.verificationStatus || "").trim();
  if (Object.values(INSURANCE_STATUS).includes(status)) return status;
  return INSURANCE_STATUS.PENDING;
};

export const isInsuranceExpired = (expiryDate) => {
  if (!expiryDate) return false;
  const expiry = new Date(`${expiryDate}T23:59:59.999`);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now();
};

export const insuranceStatusLabel = (status, t = (s) => s) => {
  switch (status) {
    case INSURANCE_STATUS.APPROVED:
      return t("Approved");
    case INSURANCE_STATUS.DECLINED:
      return t("Declined");
    case INSURANCE_STATUS.PENDING:
      return t("Pending review");
    default:
      return t("No insurance");
  }
};

export const insuranceStatusTone = (status) => {
  switch (status) {
    case INSURANCE_STATUS.APPROVED:
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case INSURANCE_STATUS.DECLINED:
      return "bg-rose-50 text-rose-800 ring-rose-200";
    case INSURANCE_STATUS.PENDING:
      return "bg-amber-50 text-amber-900 ring-amber-200";
    default:
      return "bg-gray-100 text-gray-600 ring-gray-200";
  }
};

export const visitCheckLabel = (visitCheck, t = (s) => s) => {
  const status = String(visitCheck?.status || "").trim();
  if (status === "approved") return t("Verified for visit");
  if (status === "declined") return t("Declined for visit");
  return t("Not checked for visit");
};
