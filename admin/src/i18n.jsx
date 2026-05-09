import { createContext, useContext, useEffect, useMemo, useState } from "react";

export const LANGUAGES = {
  en: { label: "English", shortLabel: "EN", dir: "ltr", locale: "en-US" },
  ar: { label: "العربية", shortLabel: "ع", dir: "rtl", locale: "ar-EG" },
};

const STORAGE_KEY = "clinicSysLanguage";

const ar = {
  "Admin": "مسؤول",
  "Doctor": "طبيب",
  "Receptionist": "موظف استقبال",
  "Logout": "تسجيل الخروج",
  "Dashboard": "لوحة التحكم",
  "Patients": "المرضى",
  "Doctors": "الأطباء",
  "Appointments": "المواعيد",
  "Appointment": "موعد",
  "Clinics": "العيادات",
  "Add Doctor": "إضافة طبيب",
  "Receptionists": "موظفو الاستقبال",
  "Audit": "السجل",
  "Audit Logs": "سجلات المتابعة",
  "Appointment History": "سجل المواعيد",
  "Doctors List": "قائمة الأطباء",
  "Add Receptionist": "إضافة موظف استقبال",
  "Book Appointment": "حجز موعد",
  "Patient History": "تاريخ المريض",
  "Availability": "الإتاحة",
  "Profile": "الملف الشخصي",
  "Name": "الاسم",
  "Email": "البريد الإلكتروني",
  "Password": "كلمة المرور",
  "Phone": "الهاتف",
  "Status": "الحالة",
  "Date": "التاريخ",
  "Time": "الوقت",
  "Age": "العمر",
  "Gender": "النوع",
  "Address": "العنوان",
  "Speciality": "التخصص",
  "Degree": "الدرجة العلمية",
  "Experience": "الخبرة",
  "Fees": "الكشف",
  "Clinic": "العيادة",
  "About": "نبذة",
  "Actions": "الإجراءات",
  "Active": "نشط",
  "Disabled": "معطل",
  "Available": "متاح",
  "Unavailable": "غير متاح",
  "Completed": "مكتمل",
  "Cancelled": "ملغي",
  "Pending": "قيد الانتظار",
  "Booked": "محجوز",
  "Paid": "مدفوع",
  "Unpaid": "غير مدفوع",
  "Cancel": "إلغاء",
  "Save": "حفظ",
  "Update": "تحديث",
  "Delete": "حذف",
  "Edit": "تعديل",
  "Submit": "إرسال",
  "Search": "بحث",
  "Filter": "تصفية",
  "Clear": "مسح",
  "Loading...": "جاري التحميل...",
  "No data found": "لا توجد بيانات",
  "No appointments found": "لا توجد مواعيد",
  "No receptionist accounts yet": "لا توجد حسابات استقبال حتى الآن",
  "Manage front desk staff accounts": "إدارة حسابات موظفي الاستقبال",
  "Add New Doctor": "إضافة طبيب جديد",
  "Upload doctor picture": "رفع صورة الطبيب",
  "Doctor name": "اسم الطبيب",
  "Doctor Email": "بريد الطبيب الإلكتروني",
  "Doctor Password": "كلمة مرور الطبيب",
  "Doctor fees": "قيمة الكشف",
  "Select speciality": "اختر التخصص",
  "Doctor Education": "تعليم الطبيب",
  "Doctor Experience": "خبرة الطبيب",
  "Doctor Address": "عنوان الطبيب",
  "About Doctor": "نبذة عن الطبيب",
  "Add doctor": "إضافة الطبيب",
  "Add doctor to clinic": "إضافة الطبيب إلى العيادة",
  "All Appointments": "كل المواعيد",
  "Latest Appointments": "أحدث المواعيد",
  "Total appointments": "إجمالي المواعيد",
  "Total doctors": "إجمالي الأطباء",
  "Total patients": "إجمالي المرضى",
  "Total earnings": "إجمالي الإيرادات",
  "Patient": "المريض",
  "Prescription": "الروشتة",
  "Diagnosis": "التشخيص",
  "Medication": "الدواء",
  "Dosage": "الجرعة",
  "Instructions": "التعليمات",
  "Notes": "ملاحظات",
  "Allergies": "الحساسية",
  "Chronic Diseases": "الأمراض المزمنة",
  "Surgeries": "العمليات السابقة",
  "Family History": "تاريخ العائلة المرضي",
  "Medical History": "التاريخ الطبي",
  "Receptionist Dashboard": "لوحة تحكم الاستقبال",
  "Doctor Dashboard": "لوحة تحكم الطبيب",
  "Admin Dashboard": "لوحة تحكم المسؤول",
  "Book for patient": "حجز لمريض",
  "Select doctor": "اختر الطبيب",
  "Select patient": "اختر المريض",
  "Select clinic": "اختر العيادة",
  "Select date": "اختر التاريخ",
  "Select time": "اختر الوقت",
  "Create appointment": "إنشاء موعد",
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
  "Male": "ذكر",
  "Female": "أنثى",
  "Other": "آخر",
  "Login": "تسجيل الدخول",
  "Admin Login": "دخول المسؤول",
  "Doctor Login": "دخول الطبيب",
  "Receptionist Login": "دخول موظف الاستقبال",
  "Sign in": "تسجيل الدخول",
  "Sign In": "تسجيل الدخول",
  "Enter email": "أدخل البريد الإلكتروني",
  "Enter password": "أدخل كلمة المرور",
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
