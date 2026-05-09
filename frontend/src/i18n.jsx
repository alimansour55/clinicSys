import { createContext, useContext, useEffect, useMemo, useState } from "react";

export const LANGUAGES = {
  en: { label: "English", shortLabel: "EN", dir: "ltr", locale: "en-US" },
  ar: { label: "العربية", shortLabel: "ع", dir: "rtl", locale: "ar-EG" },
};

const STORAGE_KEY = "clinicSysLanguage";

const ar = {
  "HOME": "الرئيسية",
  "ALL DOCTORS": "كل الأطباء",
  "ABOUT": "عن العيادة",
  "CONTACT": "تواصل معنا",
  "MEDICAL HISTORY": "التاريخ الطبي",
  "APPOINTMENTS": "المواعيد",
  "MY APPOINTMENTS": "مواعيدي",
  "MY PROFILE": "ملفي الشخصي",
  "Language": "اللغة",
  "Account": "الحساب",
  "Browse": "تصفح",
  "My Care": "رعايتي",
  "Profile": "الملف الشخصي",
  "My Profile": "ملفي الشخصي",
  "Medical History": "التاريخ الطبي",
  "Insurance": "التأمين",
  "My Appointments": "مواعيدي",
  "Logout": "تسجيل الخروج",
  "Create Account": "إنشاء حساب",
  "Login": "تسجيل الدخول",
  "Sign in": "تسجيل الدخول",
  "Sign up": "إنشاء حساب",
  "Sign Up": "إنشاء حساب",
  "Email": "البريد الإلكتروني",
  "Password": "كلمة المرور",
  "Full Name": "الاسم بالكامل",
  "Name": "الاسم",
  "Phone": "الهاتف",
  "Address": "العنوان",
  "Gender": "النوع",
  "Birthday": "تاريخ الميلاد",
  "Save information": "حفظ البيانات",
  "Edit": "تعديل",
  "Save": "حفظ",
  "Cancel": "إلغاء",
  "Back": "رجوع",
  "Loading...": "جاري التحميل...",
  "Confirm": "تأكيد",
  "Book appointment": "احجز موعد",
  "Book Appointment": "احجز موعد",
  "Pay Online": "الدفع عبر الإنترنت",
  "Cancel appointment": "إلغاء الموعد",
  "Date": "التاريخ",
  "Time": "الوقت",
  "Status": "الحالة",
  "Paid": "مدفوع",
  "Pending": "قيد الانتظار",
  "Cancelled": "ملغي",
  "Completed": "مكتمل",
  "Doctor": "طبيب",
  "Doctors": "الأطباء",
  "Speciality": "التخصص",
  "Clinic": "العيادة",
  "Fees": "الكشف",
  "Available": "متاح",
  "Unavailable": "غير متاح",
  "About": "عن العيادة",
  "Contact": "تواصل معنا",
  "Our Doctors": "أطباؤنا",
  "Browse through the doctors specialist.": "تصفح الأطباء حسب التخصص.",
  "Browse through our extensive list of trusted specialists": "تصفح قائمة كبيرة من المتخصصين الموثوقين.",
  "Simply browse through our extensive list of trusted doctors.": "تصفح قائمتنا الكبيرة من الأطباء الموثوقين بسهولة.",
  "Simply browse through our extensive list of trusted doctors": "تصفح قائمتنا الكبيرة من الأطباء الموثوقين بسهولة.",
  "Simply browse through our extensive list of trusted doctors, schedule your appointment hassle-free.": "تصفح قائمتنا الكبيرة من الأطباء الموثوقين واحجز موعدك بسهولة.",
  "Book Appointment With Trusted Doctors": "احجز موعدك مع أطباء موثوقين",
  "With Trusted Doctors": "مع أطباء موثوقين",
  "With 100+ Trusted Doctors": "مع أكثر من 100 طبيب موثوق",
  "My appointments": "مواعيدي",
  "My profile": "ملفي الشخصي",
  "Create account": "إنشاء حساب",
  "View More Doctors": "عرض المزيد من الأطباء",
  "Top Doctors to Book": "أفضل الأطباء للحجز",
  "Find by Speciality": "البحث حسب التخصص",
  "Not Available": "غير متاح",
  "COMPANY": "الشركة",
  "GET IN TOUCH": "تواصل معنا",
  "Home": "الرئيسية",
  "All Doctors": "كل الأطباء",
  "Contact Us": "تواصل معنا",
  "Privacy Policy": "سياسة الخصوصية",
  "Prescripto Logo": "شعار Prescripto",
  "Simplifying healthcare access through smart appointment management. Book your doctor, anytime, anywhere with Prescripto's intelligent scheduling system. No more long waits or booking hassles - just efficient, reliable, and patient-focused healthcare at your convenience.": "نساعدك على الوصول للرعاية الصحية بسهولة من خلال إدارة ذكية للمواعيد. احجز طبيبك في أي وقت ومن أي مكان بدون انتظار طويل أو تعقيد.",
  "Copyright 2026Â© Prescripto - All Rights Reserved.": "حقوق النشر 2026 © Prescripto - جميع الحقوق محفوظة.",
  "More": "المزيد",
  "Related Doctors": "أطباء مشابهون",
  "General physician": "طبيب عام",
  "Gynecologist": "طبيب نساء وتوليد",
  "Dermatologist": "طبيب جلدية",
  "Pediatricians": "طبيب أطفال",
  "Neurologist": "طبيب مخ وأعصاب",
  "Gastroenterologist": "طبيب جهاز هضمي",
  "Cardiologist": "طبيب قلب",
  "Dentist": "طبيب أسنان",
  "Orthopedic": "طبيب عظام",
  "Psychiatrist": "طبيب نفسي",
  "Prescription": "الروشتة",
  "Diagnosis": "التشخيص",
  "Medication": "الدواء",
  "Dosage": "الجرعة",
  "Instructions": "التعليمات",
  "Allergies": "الحساسية",
  "Chronic Diseases": "الأمراض المزمنة",
  "Surgeries": "العمليات السابقة",
  "Family History": "تاريخ العائلة المرضي",
  "Verify OTP": "تأكيد رمز التحقق",
  "Enter 6-digit code sent to": "أدخل رمز التحقق المكون من 6 أرقام المرسل إلى",
  "Verifying...": "جاري التحقق...",
  "Please enter 6-digit OTP": "يرجى إدخال رمز تحقق مكون من 6 أرقام",
  "New Password": "كلمة مرور جديدة",
  "Create a strong password": "أنشئ كلمة مرور قوية",
  "Enter new password": "أدخل كلمة المرور الجديدة",
  "Confirm Password": "تأكيد كلمة المرور",
  "Confirm new password": "أكد كلمة المرور الجديدة",
  "Reset Password": "تغيير كلمة المرور",
  "Resetting...": "جاري التغيير...",
  "Password must be at least 8 characters": "يجب أن تكون كلمة المرور 8 أحرف على الأقل",
  "Passwords do not match": "كلمتا المرور غير متطابقتين",
  "User": "مستخدم",
  "Male": "ذكر",
  "Female": "أنثى",
  "Other": "آخر",
  "Select": "اختر",
  "Search": "بحث",
  "Filter": "تصفية",
  "Clear": "مسح",
  "Submit": "إرسال",
  "Send": "إرسال",
};

const dictionaries = { en: {}, ar };
const reverseAr = Object.fromEntries(Object.entries(ar).map(([key, value]) => [value, key]));

const preserveCaseKey = (text) => {
  if (dictionaries.ar[text]) return text;
  const upper = text.toUpperCase();
  return dictionaries.ar[upper] ? upper : text;
};

const translateString = (value, language = getStoredLanguage()) => {
  if (value === null || value === undefined) return value;
  const raw = String(value);
  const leading = raw.match(/^\s*/)?.[0] || "";
  const trailing = raw.match(/\s*$/)?.[0] || "";
  const text = raw.trim();
  if (!text) return raw;

  const canonical = reverseAr[text] || preserveCaseKey(text);
  if (language === "en") return `${leading}${canonical}${trailing}`;
  return `${leading}${dictionaries.ar[canonical] || text}${trailing}`;
};

const translateContent = (value, language = getStoredLanguage()) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number") return translateString(value, language);
  if (typeof value === "object") {
    if (value[language]) return value[language];
    if (value.en || value.ar) return value.en || value.ar;
  }
  return value;
};

export const getStoredLanguage = () => {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "ar" || stored === "en" ? stored : "en";
};

const LanguageContext = createContext({
  language: "en",
  isRtl: false,
  direction: "ltr",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (value) => value,
  tc: (value) => value,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(getStoredLanguage);

  const setLanguage = (nextLanguage) => {
    const safeLanguage = nextLanguage === "ar" ? "ar" : "en";
    localStorage.setItem(STORAGE_KEY, safeLanguage);
    setLanguageState(safeLanguage);
  };

  const value = useMemo(() => {
    const direction = LANGUAGES[language].dir;
    return {
      language,
      direction,
      isRtl: direction === "rtl",
      setLanguage,
      toggleLanguage: () => setLanguage(language === "ar" ? "en" : "ar"),
      t: (text) => translateString(text, language),
      tc: (content) => translateContent(content, language),
    };
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = value.direction;
    document.body.dir = value.direction;
    document.body.classList.toggle("rtl", value.isRtl);
  }, [language, value.direction, value.isRtl]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const localizeElement = (root, language) => {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-no-translate]")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => {
    const translated = translateString(node.nodeValue, language);
    if (translated !== node.nodeValue) node.nodeValue = translated;
  });

  root.querySelectorAll?.("[placeholder], [title], [alt], [aria-label]").forEach((element) => {
    ["placeholder", "title", "alt", "aria-label"].forEach((attr) => {
      if (element.hasAttribute(attr)) {
        const current = element.getAttribute(attr);
        const translated = translateString(current, language);
        if (translated !== current) element.setAttribute(attr, translated);
      }
    });
  });
};

export const LanguageDomSync = () => {
  const { language } = useLanguage();

  useEffect(() => {
    localizeElement(document.body, language);
    const observer = new MutationObserver(() => localizeElement(document.body, language));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => observer.disconnect();
  }, [language]);

  return null;
};

export const LanguageToggle = ({ compact = false }) => {
  const { language, setLanguage, isRtl } = useLanguage();

  return (
    <div
      className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1 shadow-sm"
      dir="ltr"
      aria-label="Language switcher"
    >
      {Object.entries(LANGUAGES).map(([key, config]) => (
        <button
          key={key}
          type="button"
          onClick={() => setLanguage(key)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            language === key ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
          title={config.label}
        >
          {compact ? config.shortLabel : key === "ar" && !isRtl ? "AR" : config.shortLabel}
        </button>
      ))}
    </div>
  );
};
