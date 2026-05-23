import React, { useContext, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronLeft, ChevronRight, Home, MapPin, Video } from "lucide-react";
import { AppContext } from "../context/AppContext";
import { RatingBadge } from "./DoctorRating";
import PromoOfferBadge from "./PromoOfferBadge";
import { formatLocationLine } from "../utils/placeTranslations";
import { resolveClinicSectionLabel } from "../utils/chatbotOpeningSuggestions";
import { formatDoctorCountLabel } from "../utils/arabicMedicalUi";
import { isDoctorComingSoon } from "../utils/doctorBooking";
import { doctorBelongsToClinicSection } from "../utils/doctorClinicPlaces";
import { useMediaQuery } from "../utils/useMediaQuery";
import { toast } from "react-toastify";

const DOCTORS_PER_MOBILE_PAGE = 4;
const DESKTOP_SCROLL_COLUMNS = 5;

const SpecialityMenu = () => {
  const navigate = useNavigate();
  const doctorsRef = useRef(null);
  const clinicsRef = useRef(null);
  const { doctors, clinics, siteSettings, t, tc, formatMoney, language, displayPersonName, placeTranslationOverrides, localizeDigits } = useContext(AppContext);
  const [selectedSection, setSelectedSection] = useState({ name: "All Specialities", id: null });
  const isMobile = useMediaQuery("(max-width: 1023px)");

  const fillT = (key, vars = {}) => {
    let s = String(t(key));
    Object.entries(vars).forEach(([k, v]) => {
      s = s.split(`{{${k}}}`).join(String(v));
    });
    return s;
  };

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

  const getClinicDoctorCount = (name, id = null) => {
    if (name === "All Specialities") return doctors.length;
    return doctors.filter((doctor) => doctorBelongsToClinicSection(doctor, name, { clinicId: id })).length;
  };

  const doctorPages = useMemo(() => {
    if (!isMobile) return [];
    const pages = [];
    for (let i = 0; i < visibleDoctors.length; i += DOCTORS_PER_MOBILE_PAGE) {
      pages.push(visibleDoctors.slice(i, i + DOCTORS_PER_MOBILE_PAGE));
    }
    return pages;
  }, [visibleDoctors, isMobile]);

  const showDoctorNav = isMobile
    ? doctorPages.length > 1
    : visibleDoctors.length > DESKTOP_SCROLL_COLUMNS * 2;

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
    const el = doctorsRef.current;
    if (!el) return;
    let scrollAmount = el.clientWidth;
    if (!isMobile) {
      const firstCard = el.querySelector("button");
      const colWidth = (firstCard?.offsetWidth || 188) + 16;
      scrollAmount = colWidth * DESKTOP_SCROLL_COLUMNS;
    }
    el.scrollBy({
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

  const renderDoctorCard = (doctor) => (
    <button
      key={doctor._id}
      type="button"
      onClick={() => bookDoctor(doctor)}
      className={`group min-h-0 overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition ${
        isDoctorComingSoon(doctor)
          ? "cursor-default opacity-95"
          : "hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"
      }`}
    >
      <div className="relative mx-2 mt-2 h-[120px] overflow-hidden rounded-lg bg-blue-50 sm:mx-3 sm:mt-3 sm:h-[146px]">
        <img
          src={doctor.image}
          alt={displayPersonName(doctor.name)}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <RatingBadge summary={doctor.ratingSummary} className="absolute left-2 top-2" />
        <PromoOfferBadge doctor={doctor} formatMoney={formatMoney} className="absolute bottom-2 left-2" />
      </div>

      <div className="px-2.5 py-2 sm:px-3 sm:py-2.5">
        {isDoctorComingSoon(doctor) && (
          <p className="mb-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            {t("Coming Soon")}
          </p>
        )}
        <p className="truncate text-sm font-bold text-gray-800">{displayPersonName(doctor.name)}</p>
        <p className="mt-1 truncate text-sm text-gray-600">{tc(doctor.speciality)}</p>
        <p className="mt-2 flex items-center gap-1.5 truncate text-sm text-gray-600">
          <MapPin className="h-4 w-4 shrink-0 text-blue-500" />
          <span className="truncate">{getDoctorLocationDisplay(doctor)}</span>
        </p>
      </div>
    </button>
  );

  return (
    <section className="scroll-mt-28 py-14 text-gray-800" id="speciality">
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
            <button
              type="button"
              onClick={() => openService("home")}
              className="min-h-28 w-full overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left transition active:border-emerald-400 sm:flex sm:items-center sm:justify-between sm:gap-5"
            >
              <div className="flex min-w-0 gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-emerald-600 shadow-sm">
                  {serviceCards.homeVisitImage ? <img src={serviceCards.homeVisitImage} alt="" className="h-full w-full object-cover" /> : <Home className="h-6 w-6" />}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">{t(serviceCards.homeVisitTitle)}</p>
                  <p className="mt-1 text-sm text-gray-600">{t(serviceCards.homeVisitDescription)}</p>
                </div>
              </div>
              <span className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm sm:mt-0 sm:w-auto sm:shrink-0">
                {t(serviceCards.homeVisitButtonText)}
              </span>
            </button>
          )}
        </div>

        <div className="mb-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-gray-900">{t("Clinic sections")}</p>
                <p className="text-xs text-gray-500">{t("Select clinic section")}</p>
              </div>
            </div>
            <div className="hidden shrink-0 gap-2 sm:flex">
              <button type="button" onClick={() => scrollRail(clinicsRef, "prev")} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:border-emerald-400 hover:text-emerald-600" aria-label={t("Previous clinics")}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => scrollRail(clinicsRef, "next")} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:border-emerald-400 hover:text-emerald-600" aria-label={t("Next clinics")}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={clinicsRef} className="grid grid-cols-2 gap-2 sm:flex sm:flex-nowrap sm:gap-3 sm:overflow-x-auto sm:pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              key="all-doctors"
              type="button"
              onClick={() => handleSectionClick("All Specialities", null)}
              className={`flex min-h-[3.25rem] flex-col items-start justify-center rounded-xl border px-3 py-2.5 text-left transition sm:min-w-[9.5rem] ${
                selectedSection.name === "All Specialities"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm"
                  : "border-gray-200 bg-white text-gray-800 hover:border-emerald-200"
              }`}
            >
              <span className="text-sm font-semibold leading-tight">{t("All doctors")}</span>
              <span className="mt-1 text-[11px] font-medium text-gray-500">
                {formatDoctorCountLabel(getClinicDoctorCount("All Specialities"), language, localizeDigits)}
              </span>
            </button>
            {activeClinics.length ? activeClinics.map((clinic) => {
              const isActive = selectedSection.name === clinic.name;
              const count = getClinicDoctorCount(clinic.name, clinic.id);

              return (
                <button
                  key={clinic.id || clinic.name}
                  type="button"
                  onClick={() => handleSectionClick(clinic.name, clinic.id)}
                  className={`flex min-h-[3.25rem] flex-col items-start justify-center rounded-xl border px-3 py-2.5 text-left transition sm:min-w-[9.5rem] sm:shrink-0 ${
                    isActive
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm"
                      : "border-gray-200 bg-white text-gray-800 hover:border-emerald-200"
                  }`}
                >
                  <span className="line-clamp-2 text-sm font-semibold leading-tight">
                    {resolveClinicSectionLabel(clinic.name, language, t, tc, placeTranslationOverrides)}
                  </span>
                  <span className={`mt-1 text-[11px] font-medium ${isActive ? "text-emerald-700" : "text-gray-500"}`}>
                    {formatDoctorCountLabel(count, language, localizeDigits)}
                  </span>
                </button>
              );
            }) : (
              <span className="col-span-2 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 sm:col-span-1">{t("No clinics added yet")}</span>
            )}
          </div>
        </div>

        {visibleDoctors.length > 0 ? (
          <div
            className={
              isMobile
                ? "relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50/60 p-2 sm:p-3"
                : "relative min-h-[310px] rounded-xl border border-gray-100 bg-gray-50/60 p-2 sm:p-3"
            }
          >
            {showDoctorNav && (
              <>
                <button
                  type="button"
                  onClick={() => scrollDoctors("prev")}
                  className={
                    isMobile
                      ? "absolute left-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:border-blue-400 hover:text-blue-600 sm:left-2"
                      : "absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:border-blue-400 hover:text-blue-600"
                  }
                  aria-label={t("Previous doctors")}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollDoctors("next")}
                  className={
                    isMobile
                      ? "absolute right-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:border-blue-400 hover:text-blue-600 sm:right-2"
                      : "absolute right-0 top-1/2 z-10 flex h-11 w-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:border-blue-400 hover:text-blue-600"
                  }
                  aria-label={t("Next doctors")}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}

            {isMobile ? (
              <div
                ref={doctorsRef}
                className="flex overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {doctorPages.map((page, pageIndex) => (
                  <div
                    key={`${selectedSection.name}-${pageIndex}`}
                    className="grid w-full min-w-full shrink-0 snap-start snap-always grid-cols-2 gap-3 px-1 py-1 sm:gap-4"
                  >
                    {page.map((doctor) => renderDoctorCard(doctor))}
                  </div>
                ))}
              </div>
            ) : (
              <div
                ref={doctorsRef}
                className="tap-row-mobile-wrap grid auto-cols-[166px] grid-flow-col grid-rows-2 gap-4 overflow-x-auto scroll-smooth px-6 pb-3 [scrollbar-width:none] sm:auto-cols-[184px] md:auto-cols-[188px] [&::-webkit-scrollbar]:hidden"
              >
                {visibleDoctors.map((doctor) => renderDoctorCard(doctor))}
              </div>
            )}
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
