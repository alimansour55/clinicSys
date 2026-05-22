import React, { useContext, useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, CheckCircle, Mail, MapPin, Phone, RefreshCw, Search, Stethoscope, UserRound, UsersRound, X } from "lucide-react";
import { ReceptionistContext } from "../../context/ReceptionistContext";
import { AppContext } from "../../context/AppContext";
import { RatingBadge, StarRow } from "../../components/DoctorRating";
import { formatExperienceEn } from "../../utils/doctorExperience";

const addressText = (address = {}) => {
  const addresses = address.addresses?.length ? address.addresses : [{ line1: address.line1, line2: address.line2 }];
  return addresses.map((item) => [item.line1, item.line2].filter(Boolean).join(", ")).filter(Boolean);
};

const ReceptionistClinics = () => {
  const { rToken, clinics, doctors, getReceptionistClinics, getReceptionistDoctors } = useContext(ReceptionistContext);
  const { currency } = useContext(AppContext);
  const [search, setSearch] = useState("");
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const fetchData = async () => {
    if (!rToken) return;
    setLoading(true);
    setLoadError("");
    const [clinicsResult, doctorsResult] = await Promise.all([getReceptionistClinics(), getReceptionistDoctors()]);
    const failedResult = [clinicsResult, doctorsResult].find((result) => result && !result.success);
    if (failedResult) {
      setLoadError(failedResult.message || "Could not load clinics and doctors.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // Context methods are recreated on render in this app; depend on the token to match existing pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rToken]);

  const filteredClinics = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clinics;
    return clinics.filter((clinic) => {
      const assignedDoctors = clinic.doctors || [];
      return clinic.name?.toLowerCase().includes(query)
        || clinic.description?.toLowerCase().includes(query)
        || assignedDoctors.some((doctor) =>
          [doctor.name, doctor.email, doctor.speciality, ...(doctor.locations || [])]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        );
    });
  }, [clinics, search]);

  const selectedClinic = useMemo(() => {
    if (selectedClinicId) return clinics.find((clinic) => clinic._id === selectedClinicId);
    return filteredClinics[0] || null;
  }, [clinics, filteredClinics, selectedClinicId]);

  const clinicDoctors = useMemo(() => selectedClinic?.doctors || [], [selectedClinic]);
  const selectedDoctor = useMemo(() => {
    if (selectedDoctorId) return doctors.find((doctor) => doctor._id === selectedDoctorId) || clinicDoctors.find((doctor) => doctor._id === selectedDoctorId);
    return clinicDoctors[0] || null;
  }, [doctors, clinicDoctors, selectedDoctorId]);

  const allDoctorsCount = useMemo(() => {
    const ids = new Set();
    clinics.forEach((clinic) => (clinic.doctors || []).forEach((doctor) => ids.add(doctor._id)));
    return ids.size;
  }, [clinics]);

  useEffect(() => {
    if (selectedClinicId && !filteredClinics.some((clinic) => clinic._id === selectedClinicId)) {
      setSelectedClinicId("");
      setSelectedDoctorId("");
    }
  }, [filteredClinics, selectedClinicId]);

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-5 md:p-6 lg:p-8">
      <div className="max-w-7xl">
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-950 sm:text-2xl lg:text-3xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Building2 className="h-5 w-5" />
              </span>
              Clinics and Doctors
            </h1>
            <p className="mt-2 text-sm text-slate-600">Read-only clinic information, assigned doctors, and clinic locations for reception desk work.</p>
          </div>
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clinics, doctors, locations" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-9 text-sm text-slate-900 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100" />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search"><X className="h-4 w-4" /></button>}
          </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <p className="text-xs font-semibold text-indigo-600">Clinics</p>
              <p className="mt-1 text-2xl font-bold text-indigo-950">{clinics.length}</p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs font-semibold text-blue-600">Assigned doctors</p>
              <p className="mt-1 text-2xl font-bold text-blue-950">{allDoctorsCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">Showing</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{filteredClinics.length}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-600">Access</p>
              <p className="mt-1 text-lg font-bold text-emerald-950">Read only</p>
            </div>
          </div>
        </div>

        {loadError && (
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-bold">Clinic data could not fully load</p>
                <p className="mt-1">{loadError}</p>
              </div>
            </div>
            <button type="button" onClick={fetchData} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-700">
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
                  <div className="h-5 w-48 rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-3/4 rounded bg-slate-100" />
                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="h-20 rounded-xl bg-slate-100" />
                    <div className="h-20 rounded-xl bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
            <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white" />
          </div>
        ) : filteredClinics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <UsersRound className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-950">{search ? "No matching clinics" : "No clinics available yet"}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
              {search
                ? "Try another clinic name, doctor name, speciality, or location."
                : "Default clinics are created automatically by the backend. If this stays empty, restart the backend and retry this page."}
            </p>
            <button type="button" onClick={fetchData} className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700">
              <RefreshCw className="h-4 w-4" />
              Refresh clinics
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4">
              {filteredClinics.map((clinic) => (
                <div key={clinic._id} className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${selectedClinic?._id === clinic._id ? "border-indigo-300 ring-4 ring-indigo-50" : "border-slate-200"}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClinicId(clinic._id);
                      setSelectedDoctorId("");
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                          <Building2 className="h-5 w-5 text-indigo-600" />
                          {clinic.name}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">{clinic.description || "No description added"}</p>
                      </div>
                      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${clinic.active !== false ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {clinic.active !== false ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </button>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {(clinic.doctors || []).length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 md:col-span-2">No doctors assigned to this clinic yet.</div>
                    ) : (clinic.doctors || []).map((doctor) => (
                      <button
                        key={doctor._id}
                        type="button"
                        onClick={() => {
                          setSelectedClinicId(clinic._id);
                          setSelectedDoctorId(doctor._id);
                        }}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition hover:bg-indigo-50 ${selectedDoctor?._id === doctor._id ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"}`}
                      >
                        <div className="relative shrink-0">
                          <img src={doctor.image} alt={doctor.name} className="h-12 w-12 rounded-full bg-slate-100 object-cover" />
                          <RatingBadge summary={doctor.ratingSummary} className="absolute -left-2 -top-2" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">{doctor.name}</p>
                          <p className="truncate text-xs text-slate-500">{doctor.speciality}</p>
                          <p className="mt-1 truncate text-xs text-blue-600">{doctor.locations?.length ? doctor.locations.join(", ") : "No clinic location"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6">
              {selectedDoctor ? (
                <div>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="relative">
                      <img src={selectedDoctor.image} alt={selectedDoctor.name} className="h-20 w-20 rounded-full border border-slate-200 bg-slate-100 object-cover" />
                      <RatingBadge summary={selectedDoctor.ratingSummary} className="absolute -left-2 -top-2" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold text-slate-950">{selectedDoctor.name}</h2>
                      <p className="text-sm text-slate-500">{selectedDoctor.speciality}</p>
                      <div className="mt-1 flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                        <StarRow value={selectedDoctor.ratingSummary?.averageRating} />
                        {selectedDoctor.ratingSummary?.ratingCount ? `${Number(selectedDoctor.ratingSummary.averageRating || 0).toFixed(1)} from ${selectedDoctor.ratingSummary.ratingCount}` : "No ratings"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase text-slate-400"><Stethoscope className="h-3.5 w-3.5" /> Professional</p>
                      <p className="font-semibold text-slate-950">{selectedDoctor.title || "Doctor"}{selectedDoctor.degree ? ` - ${selectedDoctor.degree}` : ""}</p>
                      <p className="mt-1 text-slate-600">{formatExperienceEn(selectedDoctor.experience) || '—'}</p>
                      <p className="mt-1 font-semibold text-green-700">{currency}{selectedDoctor.fees}</p>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-blue-700"><MapPin className="h-3.5 w-3.5" /> Clinic Locations</p>
                      {selectedDoctor.locations?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedDoctor.locations.map((location) => <span key={location} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">{location}</span>)}
                        </div>
                      ) : (
                        <p className="text-slate-600">No clinic locations added.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-slate-400"><UserRound className="h-3.5 w-3.5" /> Contact</p>
                      <p className="flex items-center gap-2 text-slate-700"><Mail className="h-4 w-4 text-indigo-600" /> <span className="break-all">{selectedDoctor.email}</span></p>
                      <p className="mt-1 flex items-center gap-2 text-slate-700"><Phone className="h-4 w-4 text-indigo-600" /> {selectedDoctor.phone || "No phone"}</p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-slate-400"><Building2 className="h-3.5 w-3.5" /> Clinic Addresses</p>
                      {addressText(selectedDoctor.address).length ? addressText(selectedDoctor.address).map((address) => (
                        <p key={address} className="mb-1 text-slate-700">{address}</p>
                      )) : <p className="text-slate-600">No address provided.</p>}
                    </div>

                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-emerald-700"><CheckCircle className="h-3.5 w-3.5" /> Availability</p>
                      <p className="text-slate-700">{selectedDoctor.available ? "Available for booking" : "Not available for booking"}</p>
                      <p className="mt-1 text-slate-700">Cash: {selectedDoctor.acceptsCash !== false ? "Accepted" : "Not accepted"}</p>
                      <p className="mt-1 text-slate-700">Online payment: {selectedDoctor.acceptsOnlinePayment !== false ? "Accepted" : "Not accepted"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">Select a doctor to view full information.</div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceptionistClinics;
