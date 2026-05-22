import React, { useContext, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronLeft, ChevronRight, Home, MapPin, Video } from "lucide-react";
import { AppContext } from "../context/AppContext";
import { RatingBadge } from "./DoctorRating";
import PromoOfferBadge from "./PromoOfferBadge";
import { formatLocationLine, translatePlaceSegment } from "../utils/placeTranslations";
import { isDoctorComingSoon } from "../utils/doctorBooking";
import { doctorBelongsToClinicSection } from "../utils/doctorClinicPlaces";
import { toast } from "react-toastify";

const SpecialityMenu = () => {
  const navigate = useNavigate();
  const doctorsRef = useRef(null);
  const clinicsRef = useRef(null);
  const { doctors, clinics, siteSettings, t, tc, currencySymbol, language, displayPersonName, placeTranslationOverrides } = useContext(AppContext);
  const [selectedSection, setSelectedSection] = useState({ name: "All Specialities", id: null });

  const activeClinics = useMemo(
    () =>
      clinics
        .map((clinic) => ({
          id: clinic?._id != null ? String(clinic._id) : null,
          name: String(clinic?.name || clinic || "").trim(),
        }))
        .filter((clinic) => clinic.name),
    [clinics]
  );

  const visibleDoctors = useMemo(() => {
    if (selectedSection.name === "All Specialities") return doctors;
    return doctors.filter((doctor) =>
      doctorBelongsToClinicSection(doctor, selectedSection.name, { clinicId: selectedSection.id })
    );
  }, [doctors, selectedSection]);

  const getDoctorLocationRaw = (doctor) => {
    const locations = doctor.locations?.length
      ? doctor.locations
      : (doctor.clinics || []).map((clinic) => clinic.name || clinic);
    return locations.filter(Boolean).join(", ") || [doctor.address?.line1, doctor.address?.line2].filter(Boolean).join(", ");
  };

  const getDoctorLocationDisplay = (doctor) => {
    const raw = getDoctorLocationRaw(doctor);
    return raw ? formatLocationLine(raw, language, t, placeTranslationOverrides) : t("Clinic location");
  };

  const handleSectionClick = (name, id = null) => {
    setSelectedSection({ name, id });
    requestAnimationFrame(() => {
      doctorsRef.current?.scrollTo({ left: 0, behavior: "smooth" });
    });
  };

  const scrollDoctors = (direction) => {
    const scrollAmount = doctorsRef.current?.clientWidth || 680;
    doctorsRef.current?.scrollBy({
      left: direction === "next" ? scrollAmount : -scrollAmount,
      behavior: "smooth",
    });
  };

  const scrollRail = (ref, direction) => {
    const scrollAmount = ref.current?.clientWidth || 420;
    ref.current?.scrollBy({
      left: direction === "next" ? scrollAmount : -scrollAmount,
      behavior: "smooth",
    });
  };

  const bookDoctor = (doctor) => {
    if (isDoctorComingSoon(doctor)) {
      toast.info(t("Coming soon — booking not open yet"));
      return;
    }
    navigate(`/appointment/${doctor._id}`);
    window.scrollTo(0, 0);
  };

  const serviceCards = {
    teleconsultationTitle: "Teleconsultation",
    teleconsultationDescription: "Schedule a voice or video call with a specialist doctor.",
    teleconsultationButtonText: "Book",
    showTeleconsultation: true,
    homeVisitTitle: "Home Visit",
    homeVisitDescription: "Book a doctor visit at your home in supported Cairo and Giza areas.",
    homeVisitButtonText: "Book",
    showHomeVisit: true,
    ...(siteSettings?.homeServiceCards || {})
  };

  const openService = (type) => {
    navigate(`/doctors?consultation=${type}`);
    window.scrollTo(0, 0);
  };

  return (
    <section className="py-14 text-gray-800" id="speciality">
      <div className="mb-6 px-1 sm:px-0">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
          {t("Find by Speciality")}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600">
          {t("Browse through our extensive list of trusted specialists")}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {serviceCards.showTeleconsultation && (
            <div className="min-h-28 overflow-hidden rounded-xl border border-sky-200 bg-sky-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
              <div className="flex min-w-0 gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-sky-600 shadow-sm">
                  {serviceCards.teleconsultationImage ? <img src={serviceCards.teleconsultationImage} alt="" className="h-full w-full object-cover" /> : <Video className="h-6 w-6" />}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">{t(serviceCards.teleconsultationTitle)}</p>
                  <p className="mt-1 text-sm text-gray-600">{t(serviceCards.teleconsultationDescription)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openService("tele")}
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 sm:mt-0 sm:w-auto"
              >
                {t(serviceCards.teleconsultationButtonText)}
              </button>
            </div>
          )}
          {serviceCards.showHomeVisit && (
            <div className="min-h-28 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
              <div className="flex min-w-0 gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-emerald-600 shadow-sm">
                  {serviceCards.homeVisitImage ? <img src={serviceCards.homeVisitImage} alt="" className="h-full w-full object-cover" /> : <Home className="h-6 w-6" />}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">{t(serviceCards.homeVisitTitle)}</p>
                  <p className="mt-1 text-sm text-gray-600">{t(serviceCards.homeVisitDescription)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openService("home")}
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:mt-0 sm:w-auto"
              >
                {t(serviceCards.homeVisitButtonText)}
              </button>
            </div>
          )}
        </div>

        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Building2 className="h-5 w-5" />
            </span>
            <p className="font-bold text-gray-900">{t("Clinic sections")}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => scrollRail(clinicsRef, "prev")} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:border-emerald-400 hover:text-emerald-600" aria-label={t("Previous clinics")}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => scrollRail(clinicsRef, "next")} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:border-emerald-400 hover:text-emerald-600" aria-label={t("Next clinics")}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={clinicsRef} className="mb-7 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-3">
            <button
              key="all-doctors"
              type="button"
              onClick={() => handleSectionClick("All Specialities", null)}
              className={`h-12 rounded-lg border px-4 text-sm font-medium transition whitespace-nowrap ${
                selectedSection.name === "All Specialities"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200"
              }`}
            >
              {t("All doctors")}
            </button>
            {activeClinics.length ? activeClinics.map((clinic) => {
              const isActive = selectedSection.name === clinic.name;

              return (
                <button
                  key={clinic.id || clinic.name}
                  type="button"
                  onClick={() => handleSectionClick(clinic.name, clinic.id)}
                  className={`h-12 rounded-lg border px-4 text-sm font-medium transition whitespace-nowrap ${
                    isActive
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200"
                  }`}
                >
                  {translatePlaceSegment(clinic.name, language, t, placeTranslationOverrides)}
                </button>
              );
            }) : (
              <span className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">{t("No clinics added yet")}</span>
            )}
          </div>
        </div>

        {visibleDoctors.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => scrollDoctors("prev")}
              className="absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:border-blue-400 hover:text-blue-600"
              aria-label={t("Previous doctors")}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollDoctors("next")}
              className="absolute right-0 top-1/2 z-10 flex h-11 w-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:border-blue-400 hover:text-blue-600"
              aria-label={t("Next doctors")}
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div
              ref={doctorsRef}
              className="grid auto-cols-[166px] grid-flow-col grid-rows-2 gap-4 overflow-x-auto pb-3 pr-2 [scrollbar-width:none] sm:auto-cols-[184px] md:auto-cols-[188px] [&::-webkit-scrollbar]:hidden"
            >
              {visibleDoctors.map((doctor) => (
                <button
                  key={doctor._id}
                  type="button"
                  onClick={() => bookDoctor(doctor)}
                  className={`group min-h-[304px] overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition ${
                    isDoctorComingSoon(doctor)
                      ? "cursor-default opacity-95"
                      : "hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"
                  }`}
                >
                  <div className="relative mx-3 mt-3 h-[146px] overflow-hidden rounded-lg bg-blue-50">
                    <img
                      src={doctor.image}
                      alt={displayPersonName(doctor.name)}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <RatingBadge summary={doctor.ratingSummary} className="absolute left-2 top-2" />
                    <PromoOfferBadge doctor={doctor} currencySymbol={currencySymbol} className="absolute bottom-2 left-2" />
                  </div>

                  <div className="px-3 py-2.5">
                    {isDoctorComingSoon(doctor) && (
                      <p className="mb-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        {t("Coming Soon")}
                      </p>
                    )}
                    <p className="truncate text-sm font-bold text-gray-800">
                      {displayPersonName(doctor.name)}
                    </p>
                    <p className="mt-1 truncate text-sm text-gray-600">{tc(doctor.speciality)}</p>
                    <p className="mt-2 flex items-center gap-1.5 truncate text-sm text-gray-600">
                      <MapPin className="h-4 w-4 shrink-0 text-blue-500" />
                      <span className="truncate">{getDoctorLocationDisplay(doctor)}</span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">
            {t("No doctors available in this section yet.")}
          </div>
        )}
      </div>
    </section>
  );
};

export default SpecialityMenu;
