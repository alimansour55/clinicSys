import React, { useContext, useMemo, useState, useRef, useEffect } from "react";
import { specialityData } from "../assets/assets";
import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { AppContext } from "../context/AppContext";

const SpecialityMenu = () => {
  const { clinics, t, tc } = useContext(AppContext);
  const [activeDot, setActiveDot] = useState(0); 
  const scrollRef = useRef(null);

  const clinicMenu = useMemo(() => {
    const iconBySpeciality = specialityData.reduce((items, speciality) => {
      items[speciality.speciality] = speciality.image;
      return items;
    }, {});

    const sourceClinics = clinics.length > 0
      ? clinics.map((clinic) => ({ speciality: clinic.name, image: iconBySpeciality[clinic.name] }))
      : specialityData;

    return sourceClinics;
  }, [clinics]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      const maxScroll = scrollWidth - clientWidth;
      
      // divide scroll into 3 sections
      if (scrollLeft >= maxScroll - 10) {
        setActiveDot(2);
      } else if (scrollLeft >= maxScroll * 0.6) {
        setActiveDot(1);
      } else {
        setActiveDot(0);
      }
    }
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.addEventListener("scroll", handleScroll);
      return () => element.removeEventListener("scroll", handleScroll);
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-gray-800" id="speciality">
      
      {/* Header */}
      <div className="max-w-6xl mx-auto text-center mb-6 md:mb-10 px-4">
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
          {t('Find by Speciality')}
        </h1>
        <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          {t('Browse through our extensive list of trusted specialists')}
        </p>
      </div>

      {/* Mobile View */}
      <div className="md:hidden w-full">
        <div ref={scrollRef} className="flex gap-6 py-6 px-5 overflow-x-auto scrollbar-hide">
          {clinicMenu.map((item, index) => (
            <Link key={index} to={`/doctors/${item.speciality}`} onClick={() => window.scrollTo(0, 0)} className="flex flex-col items-center flex-shrink-0" >
              <div className="flex flex-col items-center min-w-[90px] sm:min-w-[100px] p-3 rounded-xl transition-all duration-300 active:scale-95">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mb-3 flex items-center justify-center">
                  {item.image ? (
                    <img className="w-full h-full object-contain" src={item.image} alt={tc(item.speciality)} />
                  ) : (
                    <span className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-blue-50 text-primary flex items-center justify-center border border-blue-100">
                      <Building2 className="w-8 h-8 sm:w-10 sm:h-10" />
                    </span>
                  )}
                </div>
                <p className="text-center text-xs sm:text-sm font-medium text-gray-700 leading-tight px-1">
                  {tc(item.speciality)}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* SIMPLE 3 Indicators */}
        <div className="flex justify-center gap-1.5 mt-2">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === activeDot ? "bg-primary w-6" : "bg-gray-300 w-1.5"
              }`}
            />
          ))}
        </div>
      </div>


      {/* Desktop Grid */}
      <div className="hidden md:block">
        <div className="flex flex-wrap justify-center gap-6 lg:gap-8 pt-5 max-w-6xl mx-auto">
          {clinicMenu.map((item, index) => (
            <Link
              key={index}
              to={`/doctors/${item.speciality}`}
              onClick={() => window.scrollTo(0, 0)}
              className="flex flex-col items-center text-sm cursor-pointer hover:-translate-y-2 transition-all duration-500">

              {item.image ? (
                <img className="w-24 h-24 object-contain mb-3" src={item.image} alt={tc(item.speciality)} />
              ) : (
                <span className="w-24 h-24 mb-3 rounded-full bg-blue-50 text-primary flex items-center justify-center border border-blue-100">
                  <Building2 className="w-10 h-10" />
                </span>
              )}
              <p className="text-center w-28">{tc(item.speciality)}</p>
              
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpecialityMenu;
