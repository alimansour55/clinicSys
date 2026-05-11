import React, { useContext, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, ExternalLink, FileText, Home, Phone, Search, Video, X } from "lucide-react";
import { ReceptionistContext } from "../../context/ReceptionistContext";
import { AppContext } from "../../context/AppContext";
import { emptyHomeVisitAddress, formatHomeVisitAddress, supportedHomeVisitAreas } from "../../utils/homeVisitAreas";

const appointmentStatuses = ["Booked", "Checked In", "In Progress", "Finished", "Cancelled"];
const paymentMethods = ["Cash", "Visa"];

const ReceptionistAppointments = () => {
  const { rToken, appointments, getReceptionistAppointments, updateAppointmentStatus, checkInPatient, updatePayment, updateHomeVisitAddress } = useContext(ReceptionistContext);
  const { calculateAge, slotDateFormat, currency } = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [homeAddressDrafts, setHomeAddressDrafts] = useState({});

  useEffect(() => {
    if (rToken) getReceptionistAppointments();
  }, [rToken]);

  const getStatus = (item) => item.appointmentStatus || (item.cancelled ? "Cancelled" : item.isCompleted ? "Finished" : "Booked");
  const getAppointmentMode = (item) => item.appointmentType || "Clinic";
  const isRemoteAppointment = (item) => ["Voice Call", "Video Call"].includes(getAppointmentMode(item));
  const isHomeVisit = (item) => getAppointmentMode(item) === "Home Visit";

  const filteredAppointments = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return appointments.filter((item) => {
      const matchesSearch = !query ||
        item.userData.name?.toLowerCase().includes(query) ||
        item.userData.patientId?.toLowerCase().includes(query) ||
        item.docData.name?.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || getStatus(item) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [appointments, searchQuery, statusFilter]);

  const statusClass = (status) => {
    if (status === "Finished") return "bg-green-50 text-green-700";
    if (status === "Cancelled") return "bg-red-50 text-red-700";
    if (status === "Checked In") return "bg-blue-50 text-blue-700";
    if (status === "In Progress") return "bg-amber-50 text-amber-700";
    return "bg-gray-100 text-gray-700";
  };

  const getPaymentDraft = (item) => paymentDrafts[item._id] || {
    paymentStatus: item.paymentStatus || "Not Paid",
    paymentMethod: item.paymentMethod || "Cash",
    discountAmount: item.discountAmount || 0,
    discountReason: item.discountReason || "",
    coveredByInsurance: item.coveredByInsurance || false,
    paymentNote: item.paymentNote || ""
  };

  const setPaymentDraft = (appointmentId, patch) => {
    setPaymentDrafts((prev) => ({
      ...prev,
      [appointmentId]: { ...(prev[appointmentId] || {}), ...patch }
    }));
  };

  const savePayment = (item, status = null) => {
    const draft = getPaymentDraft(item);
    updatePayment(item._id, {
      paymentStatus: status || draft.paymentStatus,
      paymentMethod: draft.paymentMethod,
      discountAmount: draft.discountAmount,
      discountReason: draft.discountReason,
      coveredByInsurance: draft.coveredByInsurance,
      paymentNote: draft.paymentNote
    });
  };

  const getHomeAddressDraft = (item) => homeAddressDrafts[item._id] || { ...emptyHomeVisitAddress, ...(item.homeVisitAddress || {}) };
  const setHomeAddressDraft = (appointmentId, patch) => setHomeAddressDrafts((prev) => ({ ...prev, [appointmentId]: { ...(prev[appointmentId] || {}), ...patch } }));

  return (
    <div className="w-full p-3 sm:p-5 md:p-6 lg:p-8">
      <div className="max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              Reception Appointments
            </h1>
            <p className="text-sm text-gray-600 mt-1 ml-8">Check in patients, move the visit status, and record payments</p>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-10 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search patient, ID, or doctor" />
              {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-5 h-5" /></button>}
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">All Statuses</option>
              {appointmentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white border rounded-lg overflow-x-auto">
          <div className="hidden xl:grid grid-cols-[1.4fr_1.4fr_1fr_1fr_1.1fr_1.4fr] gap-3 px-5 py-3 border-b bg-gray-50 text-sm font-medium text-gray-700">
            <p>Patient</p>
            <p>Doctor</p>
            <p>Date</p>
            <p>Visit Status</p>
            <p>Payment</p>
            <p>Actions</p>
          </div>

          {filteredAppointments.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No appointments found</div>
          ) : (
            filteredAppointments.map((item) => {
              const status = getStatus(item);
              const isPaid = item.paymentStatus === "Paid";
              const draft = getPaymentDraft(item);
              const baseAmount = Number(item.originalAmount || item.amount || 0);
              const finalAmount = Math.max(0, baseAmount - Number(draft.discountAmount || 0));
              return (
                <div key={item._id} className="grid grid-cols-1 xl:grid-cols-[1.4fr_1.4fr_1fr_1fr_1.1fr_1.4fr] gap-3 px-5 py-4 border-b text-sm text-gray-600 items-center hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <img src={item.userData.image} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-100" />
                    <div>
                      <p className="font-semibold text-gray-800">{item.userData.name}</p>
                      <p className="text-xs text-gray-500">{item.userData.patientId} - Age {calculateAge(item.userData.dob)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{item.docData.name}</p>
                    <p className="text-xs text-gray-500">{item.docData.speciality}</p>
                    <p className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isRemoteAppointment(item) ? "bg-sky-50 text-sky-700" : "bg-gray-100 text-gray-700"}`}>
                      {getAppointmentMode(item) === "Video Call" ? <Video className="h-3 w-3" /> : getAppointmentMode(item) === "Voice Call" ? <Phone className="h-3 w-3" /> : isHomeVisit(item) ? <Home className="h-3 w-3" /> : null}
                      {getAppointmentMode(item)}
                    </p>
                  </div>
                  <div>
                    <p>{slotDateFormat(item.slotDate)}, {item.slotTime}</p>
                    {isRemoteAppointment(item) && item.teleconsultationLink && (
                      <a href={item.teleconsultationLink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                        Call room <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {!isRemoteAppointment(item) && item.clinicLocation && (
                      <p className="mt-1 text-xs text-gray-500">{item.clinicLocation}</p>
                    )}
                    {isHomeVisit(item) && (
                      <p className="mt-1 text-xs text-emerald-700">{formatHomeVisitAddress(item.homeVisitAddress) || "No home address"}</p>
                    )}
                  </div>
                  <select value={status} onChange={(e) => updateAppointmentStatus(item._id, e.target.value)} className={`rounded-lg px-3 py-2 text-xs font-semibold outline-none ${statusClass(status)}`}>
                    {appointmentStatuses.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <div className="space-y-2">
                    {isHomeVisit(item) && (() => {
                      const addressDraft = getHomeAddressDraft(item);
                      return (
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2">
                          <p className="mb-2 text-xs font-bold text-emerald-800">Home visit address</p>
                          <select value={addressDraft.area} onChange={(e) => setHomeAddressDraft(item._id, { area: e.target.value })} className="mb-2 w-full rounded-lg border px-2 py-1.5 text-xs">
                            <option value="">Choose area</option>
                            {supportedHomeVisitAreas.map((area) => <option key={area} value={area}>{area}</option>)}
                          </select>
                          <input value={addressDraft.street} onChange={(e) => setHomeAddressDraft(item._id, { street: e.target.value })} className="mb-2 w-full rounded-lg border px-2 py-1.5 text-xs" placeholder="Street name and number" />
                          <div className="mb-2 grid grid-cols-3 gap-1">
                            <input value={addressDraft.building} onChange={(e) => setHomeAddressDraft(item._id, { building: e.target.value })} className="rounded-lg border px-2 py-1.5 text-xs" placeholder="Building" />
                            <input value={addressDraft.floor} onChange={(e) => setHomeAddressDraft(item._id, { floor: e.target.value })} className="rounded-lg border px-2 py-1.5 text-xs" placeholder="Floor" />
                            <input value={addressDraft.apartment} onChange={(e) => setHomeAddressDraft(item._id, { apartment: e.target.value })} className="rounded-lg border px-2 py-1.5 text-xs" placeholder="Apt" />
                          </div>
                          <input value={addressDraft.notes} onChange={(e) => setHomeAddressDraft(item._id, { notes: e.target.value })} className="mb-2 w-full rounded-lg border px-2 py-1.5 text-xs" placeholder="Notes" />
                          <button type="button" onClick={() => updateHomeVisitAddress(item._id, addressDraft)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Save address</button>
                        </div>
                      );
                    })()}
                    <select value={draft.paymentStatus} onChange={(e) => setPaymentDraft(item._id, { paymentStatus: e.target.value })} className={`w-full rounded-lg px-3 py-2 text-xs font-semibold outline-none ${isPaid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      <option value="Not Paid">Not Paid</option>
                      <option value="Paid">Paid</option>
                    </select>
                    <select value={draft.paymentMethod} onChange={(e) => setPaymentDraft(item._id, { paymentMethod: e.target.value, coveredByInsurance: e.target.value === "Insurance" })} className="w-full rounded-lg border px-3 py-2 text-xs outline-none">
                      {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                      <option value="Insurance">Insurance</option>
                      <option value="Free">Free</option>
                    </select>
                    <input type="number" min="0" max={baseAmount} value={draft.discountAmount} onChange={(e) => setPaymentDraft(item._id, { discountAmount: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-xs outline-none" placeholder="Discount amount" />
                    <input value={draft.discountReason} onChange={(e) => setPaymentDraft(item._id, { discountReason: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-xs outline-none" placeholder="Discount reason" />
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input type="checkbox" checked={draft.coveredByInsurance} onChange={(e) => setPaymentDraft(item._id, { coveredByInsurance: e.target.checked, paymentMethod: e.target.checked ? "Insurance" : draft.paymentMethod })} className="accent-primary" />
                      Use insurance
                    </label>
                    <p className="text-xs font-semibold text-gray-700">Final: {currency}{finalAmount}</p>
                    {item.refundStatus && item.refundStatus !== "Not Refunded" && (
                      <p className="text-xs font-semibold text-blue-700">{item.refundStatus}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => checkInPatient(item._id)} disabled={status === "Checked In" || status === "Finished" || status === "Cancelled"} className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-40">
                      <CheckCircle2 className="w-4 h-4" />
                      Check In
                    </button>
                    <button onClick={() => savePayment(item, draft.paymentStatus)} disabled={status === "Cancelled"} className="flex items-center gap-1 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 disabled:opacity-40">
                      <CreditCard className="w-4 h-4" />
                      Save {currency}{finalAmount}
                    </button>
                    <button onClick={() => { setPaymentDraft(item._id, { paymentStatus: "Paid", paymentMethod: "Free", discountAmount: baseAmount, discountReason: "Free visit" }); updatePayment(item._id, { paymentStatus: "Paid", paymentMethod: "Free", discountAmount: baseAmount, discountReason: "Free visit", coveredByInsurance: false }); }} disabled={status === "Cancelled"} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-40">
                      Free
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceptionistAppointments;
