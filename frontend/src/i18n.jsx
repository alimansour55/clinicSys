import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_APP_DISPLAY_NAME } from "./utils/appDisplayName";
import { DEFAULT_FOOTER_COPYRIGHT, DEFAULT_FOOTER_DESCRIPTION } from "./utils/publicSiteDefaults";
import { formatPercentDisplay, localizeWesternDigits } from "./utils/arabicNumerals.js";
import {
  DEFAULT_ROLE_LANGUAGE_POLICY,
  getAllowedLanguagesFromPolicy,
  normalizeRoleLanguagePolicy,
  resolveLanguageForPolicy,
} from "./utils/languageAvailability.js";

export const LANGUAGES = {
  en: { label: "English", shortLabel: "EN", dir: "ltr", locale: "en-US" },
  ar: { label: "العربية", shortLabel: "ع", dir: "ltr", locale: "ar-EG" },
};

const STORAGE_KEY = "clinicSysLanguage";

const ar = {
  "HOME": "الرئيسية",
  "ALL DOCTORS": "الأطباء",
  "ABOUT": "من نحن",
  "CONTACT": "اتصل بنا",
  "MEDICAL HISTORY": "التاريخ الطبي",
  "APPOINTMENTS": "المواعيد",
  "MY APPOINTMENTS": "مواعيدي",
  "MY PROFILE": "ملفي الشخصي",
  "Language": "اللغة",
  "Account": "حسابي",
  "Browse": "تصفح",
  "Menu": "القائمة",
  "Close": "إغلاق",
  "Menu welcome guest": "سجّل الدخول للوصول إلى مواعيدك وملفك الطبي.",
  "Sort by": "ترتيب حسب",
  "Apply filters": "تطبيق التصفية",
  "{{count}} active filters": "{{count}} تصفية نشطة",
  "Showing doctors page count": "عرض {{current}} من {{total}} — صفحة {{page}} من {{pages}}",
  "Previous week": "الأسبوع السابق",
  "Next week": "الأسبوع التالي",
  "Select clinic section": "اختر التخصص المناسب لحالتك",
  "{{count}} doctors": "{{count}} طبيب",
  "Page": "صفحة",
  "Home shortcuts": "اختصارات الرئيسية",
  "Doctor details": "تفاصيل الطبيب",
  "Available times for {{date}}": "الأوقات المتاحة لـ {{date}}",
  "Select a day to see available times": "اختر يوماً لعرض الأوقات المتاحة",
  "My Care": "رعايتي",
  "Profile": "الملف الشخصي",
  "My Profile": "ملفي الشخصي",
  "Medical History": "التاريخ الطبي",
  "Insurance": "التأمين",
  "My Appointments": "مواعيدي",
  "Logout": "تسجيل الخروج",
  "Notifications": "الإشعارات",
  "Mark all read": "تعليم الكل كمقروء",
  "No notifications yet": "لا توجد إشعارات بعد",
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
  "About": "من نحن",
  "Contact": "اتصل بنا",
  "Our Doctors": "أطباؤنا",
  "Browse through the doctors specialist.": "تصفح الأطباء حسب التخصص.",
  "Browse through our extensive list of trusted specialists":  "تصفح قائمة كبيرة من المتخصصين الموثوقين",
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
  "Top Doctors to Book": "أطباء قد يناسبونك",
  "Top doctors": "أفضل الأطباء",
  "Quick links": "انتقل إلى",
  "Offers": "العروض",
  "Find by Speciality": "البحث حسب التخصص",
  "Not Available": "غير متاح",
  "Coming Soon": "قريباً",
  "This doctor is coming soon. Appointments will open after the doctor publishes their schedule.": "هذا الطبيب قريباً. ستُفتح المواعيد بعد أن ينشر الطبيب جدوله.",
  "Coming soon — booking not open yet": "قريباً — الحجز غير متاح بعد",
  Company: "روابط سريعة",
  company: "روابط سريعة",
  "Get in touch": "تواصل معنا",
  Teleconsultation: "استشارة عن بُعد",
  "Schedule a voice or video call with a specialist doctor.": "احجز مكالمة صوتية أو فيديو مع طبيب متخصص.",
  Book: "احجز",
  "Home Visit": "زيارة منزلية",
  "Book a doctor visit at your home in supported Cairo and Giza areas.": "احجز زيارة طبيب منزلية في مناطق القاهرة والجيزة والمناطق المدعومة.",
  "Clinic sections": "الأقسام الطبية",
  "All Specialities": "كل التخصصات",
  "No clinics added yet": "لم تُضف عيادات بعد",
  "No doctors available in this section yet.": "لا يوجد أطباء في هذا القسم حالياً.",
  "Clinic location": "موقع العيادة",
  "Previous clinics": "العيادات السابقة",
  "Next clinics": "العيادات التالية",
  "Previous doctors": "الأطباء السابقون",
  "Next doctors": "الأطباء التاليون",
  "GET IN TOUCH": "تواصل معنا",
  "Home": "الرئيسية",
  "All doctors": "جميع الأطباء",
  "Contact Us": "اتصل بنا",
  "Privacy Policy": "سياسة الخصوصية",
  "Prescripto Logo": `شعار ${DEFAULT_APP_DISPLAY_NAME}`,
  "Simplifying healthcare access through smart appointment management. Book your doctor, anytime, anywhere with Prescripto's intelligent scheduling system. No more long waits or booking hassles - just efficient, reliable, and patient-focused healthcare at your convenience.":
    "نوفر تجربة حجز طبية ذكية وسهلة للوصول إلى أفضل الأطباء بسرعة وأمان.",
  "Copyright 2026 © Prescripto - All Rights Reserved.": `حقوق النشر ${new Date().getFullYear()} © ${DEFAULT_APP_DISPLAY_NAME} - جميع الحقوق محفوظة.`,
  "Copyright 2026Â© Prescripto - All Rights Reserved.": `حقوق النشر ${new Date().getFullYear()} © ${DEFAULT_APP_DISPLAY_NAME} - جميع الحقوق محفوظة.`,
  "More": "المزيد",
  "Related Doctors": "أطباء مشابهون",
  "General physician": "طبيب عام",
  "Gynecologist": "طبيب / أخصائي نساء وتوليد",
  "Dermatologist": "طبيب جلدية",
  "Pediatricians": "أطباء أطفال",
  "Neurologist": "طبيب أعصاب",
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
  "Medical Conditions": "الحالات الطبية",
  "Chronic conditions, current diagnoses, or recurring concerns":
    "الأمراض المزمنة، التشخيصات الحالية، أو المشكلات الصحية المتكررة",
  "Medicine, food, environmental, or other known allergies":
    "الحساسية الدوائية أو الغذائية أو البيئية أو أي حساسية معروفة أخرى",
  "Past operations, procedures, or hospital stays":
    "العمليات السابقة، الإجراءات الطبية، أو فترات الإقامة في المستشفى",
  "Inherited conditions or major family health patterns":
    "الأمراض الوراثية أو أنماط صحية مهمة في العائلة",
  "Social History": "التاريخ الاجتماعي",
  "Smoking, alcohol, activity level, occupation, or lifestyle notes":
    "التدخين، الكحول، مستوى النشاط، المهنة، أو ملاحظات نمط الحياة",
  "Additional Notes": "ملاحظات إضافية",
  "Anything else your care team should know": "أي معلومات أخرى يجب أن يعرفها فريق الرعاية",
  "Keep your health background up to date so doctors can review the right context before and after visits.":
    "حدّث خلفيتك الصحية باستمرار ليتمكن الأطباء من مراجعة السياق المناسب قبل وبعد الزيارات.",
  "Last updated: {{time}}": "آخر تحديث: {{time}}",
  "Not updated yet": "لم يُحدّث بعد",
  "You can update this anytime. Doctors may also add notes after appointments.":
    "يمكنك التحديث في أي وقت. قد يضيف الأطباء أيضاً ملاحظات بعد المواعيد.",
  "Save History": "حفظ السجل الطبي",
  "Write here": "اكتب هنا",
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
  "Find Your Doctor": "ابحث عن طبيبك",
  "Doctors page subtitle default": "ابحث، صفِّ، وقارن بين الأطباء دون مغادرة هذه الصفحة.",
  "Doctors page subtitle video": "اختر التخصص المناسب، ثم أكد تفاصيل مكالمة الفيديو في خطوة الحجز.",
  "Doctors page subtitle voice": "اختر التخصص المناسب، ثم أكد تفاصيل المكالمة الصوتية في خطوة الحجز.",
  "Doctors page subtitle home": "اعثر على طبيب يدعم الزيارة المنزلية، ثم أضف عنوانك أثناء الحجز.",
  "Book a Video Call": "احجز مكالمة فيديو",
  "Book a Voice Call": "احجز مكالمة صوتية",
  "Book a Home Visit": "احجز زيارة منزلية",
  "{{count}} doctors ready to review": "{{count}} أطباء جاهزون للمراجعة",
  "View My Appointments": "مواعيدي",
  "Reset filters": "إعادة ضبط",
  "Search doctors, specialities, clinics, or locations": "ابحث عن أطباء، تخصصات، عيادات أو مناطق",
  "Clear search": "مسح البحث",
  "Clinic visit": "كشف داخل العيادة",
  "Voice call": "استشارة هاتفية",
  "Video call": "استشارة فيديو",
  "Home visit": "زيارة منزلية",
  "Close filters": "إغلاق التصفية",
  "Filters": "التصفية",
  "Doctor title": "اللقب",
  "Professor": "أستاذ",
  "Lecturer": "محاضر",
  "Consultant": "استشاري",
  "Specialist": "أخصائي",
  "Location": "أماكن الكشف",
  "Payment": "الدفع",
  "Cash": "الدفع نقدي",
  "Online payment": "دفع إلكتروني",
  "Showing doctors count": "عرض {{current}} من {{total}} طبيباً",
  "Recommended": "موصى به",
  "Highest rated": "الأعلى تقييماً",
  "Home visit available": "زيارة منزلية متاحة",
  "{{count}} slots this week": "{{count}} مواعيد هذا الأسبوع",
  "No branch slots this week": "لا مواعيد لهذا الفرع هذا الأسبوع",
  "{{n}} more branches": "+{{n}} فروع أخرى",
  "No doctors match these filters": "لا يوجد أطباء يطابقون هذه التصفية",
  "Doctors empty state hint": "جرّب تخصصاً آخر، أزل تصفية المنطقة، أو ابحث باسم الطبيب.",
  "Clear filters": "مسح التصفية",
  "New": "طبيب جديد",
  "{{amount}} off": "خصم {{amount}}",
  "{{pctLabel}} off": "خصم {{pctLabel}}",
  "Payment failed": "فشل الدفع",
  "Payment was not completed": "لم يكتمل الدفع",
  "Final step": "الخطوة الأخيرة",
  "Enter Visa details to confirm appointment": "أدخل بيانات البطاقة لتأكيد الموعد",
  "Booking payment subtitle": "لن يُحجز الموعد إلا بعد نجاح الدفع.",
  "Amount to pay": "المبلغ المستحق",
  "Card information": "بيانات البطاقة",
  "Processing payment...": "جاري معالجة الدفع...",
  "Pay and book appointment": "ادفع واحجز الموعد",
  "About the doctor": "نبذة مختصرة",
  "Appointment fee": "رسوم الموعد",
  "Visit type": "نوع الخدمة",
  "Examination (Kashf)": "كشف",
  "Examination hint": "زيارة كاملة — الخيار الافتراضي",
  "Follow-up consultation (Istishara)": "استشارة",
  "Follow-up consultation hint": "رسوم أقل بعد كشف حديث مع نفس الطبيب",
  "Follow-up consultation locked hint": "متاحة خلال ٣٠ يوماً بعد أول كشف مع الطبيب",
  "Follow-up consultation login hint": "سجّل الدخول لمعرفة أهلية الاستشارة",
  "Examination fee label": "سعر الكشف",
  "Follow-up consultation fee label": "سعر الاستشارة",
  "After promo: {{amount}}": "بعد العرض: {{amount}}",
  "Consultation after promo: {{amount}}": "الكشف بعد العرض: {{amount}}",
  "Home visit fee (+50%): {{amount}}": "رسوم الزيارة المنزلية (+٥٠٪): {{amount}}",
  "Home visit fee (+{{pct}}%)": "رسوم الزيارة المنزلية (+{{pct}}٪)",
  "Home visit fee (fixed {{amount}})": "رسوم الزيارة المنزلية (ثابت {{amount}})",
  "Home visit adds {{pct}}% of the consultation fee ({{amount}}).": "تُضاف زيارة منزلية بنسبة {{pct}}٪ من رسوم الكشف ({{amount}}).",
  "Home visit adds a fixed fee of {{amount}}.": "تُضاف زيارة منزلية برسوم ثابتة {{amount}}.",
  "Total": "الإجمالي",
  "Booking summary": "ملخص الحجز",
  "Select day and time for appointment details": "اختر اليوم والوقت لعرض تفاصيل الموعد.",
  "Consultation fee": "سعر الكشف",
  "Promo discount ({{code}})": "خصم العرض ({{code}})",
  "Total to pay": "إجمالي المبلغ",
  "Total (incl. home visit): {{amount}}": "الإجمالي (شامل الزيارة المنزلية): {{amount}}",
  "Home visit adds 50% of the consultation fee ({{amount}}).": "تُضاف زيارة منزلية بنسبة ٥٠٪ من رسوم الكشف ({{amount}}).",
  "Availability": "التوفر",
  "Open for booking": "متاح الآن",
  "This doctor is not accepting appointments right now. Please choose another doctor.": "هذا الطبيب غير متاح للحجز حالياً. يرجى اختيار طبيب آخر.",
  "Appointment type": "طريقة الكشف",
  "In clinic": "كشف داخل العيادة",
  "Visit the clinic": "كشف داخل العيادة",
  "Audio consultation": "استشارة هاتفية",
  "Online video room": "استشارة فيديو",
  "Doctor visits home": "زيارة منزلية",
  "Appointment type not available": "{{type}} غير متاح لهذا الطبيب",
  "Doctor setting up availability": "الطبيب يجهّز أوقات الحجز",
  "Doctor setting up availability hint": "عند إضافة الطبيب لجدول المواعيد ستظهر الأوقات المتاحة للحجز.",
  "Location confirmed by reception": "سيتم تأكيد الموقع من الاستقبال.",
  "Home visit address": "عنوان الزيارة المنزلية",
  "Choose supported area": "اختر منطقة مدعومة",
  "Street name and number": "اسم الشارع والرقم",
  "Building": "المبنى",
  "Floor": "الطابق",
  "Apartment": "الشقة",
  "Landmark or notes": "معلم أو ملاحظات",
  "Home visit areas note": "الزيارات المنزلية متاحة حالياً في مناطق القاهرة والجيزة والمناطق المدرجة.",
  "Doctor has no home visit areas configured": "لم يحدد هذا الطبيب مناطق للزيارة المنزلية بعد.",
  "General rating for this doctor": "التقييم العام لهذا الطبيب",
  "{{avg}} from {{count}} ratings": "{{avg}} من {{count}} تقييم",
  "No ratings yet": "لا توجد تقييمات حالياً",
  "Hide ratings": "إخفاء التقييمات",
  "Show all ratings": "عرض كل التقييمات",
  "Loading ratings...": "جاري تحميل التقييمات...",
  "Home visit slots title": "مواعيد الزيارة المنزلية",
  "Choose appointment time": "احجز موعدك",
  "Pick day then time hint": "اختر اليوم والوقت المناسب",
  "Time selected suffix": "محدد",
  "{{n}} slots": "{{n}} موعد",
  "No home visit slots this day": "لا توجد مواعيد زيارة منزلية في هذا اليوم.",
  "No slots this day": "لا توجد مواعيد في هذا اليوم.",
  "Promo applied automatically": "تم تطبيق العرض تلقائياً",
  "{{code}} — {{promo}}. You save {{save}}.": "{{code}} — {{promo}}. توفير {{save}}.",
  "Total after promo": "الإجمالي بعد العرض",
  "Payment method": "طريقة الدفع",
  "Visa": "الدفع الإلكتروني",
  "Cash payment hint": "يُتحقق من الدفع في الاستقبال",
  "Visa payment hint": "ادفع أولاً ثم يُؤكد الحجز",
  "Doctor no payment methods": "لم يفعّل هذا الطبيب وسيلة دفع بعد.",
  "Preparing payment...": "جاري تجهيز الدفع...",
  "Show Visa payment form": "عرض نموذج الدفع بالفيزا",
  "Book an appointment": "تأكيد الحجز",
  "Login to book appointment": "سجّل الدخول لحجز الموعد",
  "Please select a day": "يرجى اختيار يوم",
  "Please select a time": "يرجى اختيار وقت",
  "Please choose clinic location": "يرجى اختيار موقع العيادة",
  "Please enter home visit street": "يرجى اختيار المنطقة وإدخال اسم الشارع والرقم",
  "Doctor does not accept cash": "هذا الطبيب لا يقبل الدفع النقدي",
  "Doctor does not accept card": "هذا الطبيب لا يقبل الدفع الإلكتروني",
  "Appointment Booked": "تم حجز الموعد",
  "No appointments found": "لا توجد مواعيد",
  "Back to Appointments": "العودة إلى المواعيد",
  "Prescription Details": "تفاصيل الروشتة",
  "Doctor Information": "معلومات الطبيب",
  "Prescription Details section": "تفاصيل الروشتة",
  "Prescribed Medicines": "الأدوية الموصوفة",
  "Medicine": "الدواء",
  "Symptoms": "الأعراض",
  "Frequency": "التكرار",
  "Duration": "المدة",
  "Lab Tests Required": "التحاليل المطلوبة",
  "Next Visit": "الزيارة القادمة",
  "Documentation": "المستندات",
  "Close Prescription": "إغلاق الروشتة",
  "Reservation ref": "رقم الحجز: {{ref}}",
  "Consultation label": "الاستشارة:",
  "Home visit address label": "عنوان الزيارة المنزلية:",
  "Clinic address label": "العنوان:",
  "Home visit address will be confirmed.": "سيتم تأكيد عنوان الزيارة المنزلية.",
  "Join call": "انضم للمكالمة",
  "Date and time label": "التاريخ والوقت:",
  "Not Paid": "غير مدفوع",
  "Paid by method": "مدفوع بـ {{method}}",
  "Due at reception": "مستحق في الاستقبال",
  "Appointment Cancelled": "تم إلغاء الموعد",
  "View Prescription": "عرض الروشتة",
  "Rate your experience": "قيّم تجربتك",
  "Add a friendly comment": "أضف تعليقاً",
  "Submit rating": "إرسال التقييم",
  "Saving...": "جاري الحفظ...",
  "Rate n out of 5": "تقييم {{n}} من 5",
  "Dr.": "د.",
  "Patient Information": "معلومات المريض",
  "Patient": "المريض",
  "Age label": "العمر:",
  "{{n}} years old": "{{n}} سنة",
  "Payment confirmed and appointment booked": "تم تأكيد الدفع وحجز الموعد",
  "Refunded": "تم الاسترداد",
  "Refund Pending": "استرداد قيد المعالجة",
  "Years experience": "{{n}} سنة خبرة",
  "Not provided": "غير متوفر",
  "Active account": "حساب نشط",
  "Inactive account": "حساب غير نشط",
  "Patient profile": "ملف المريض",
  "Profile hero description":
    "احتفظ ببيانات التواصل والهوية والتأمين والسجلات الطبية محدّثة لحجز أسرع وزيارات أنسب للعيادة.",
  "Change photo": "تغيير الصورة",
  "Full name": "الاسم الكامل",
  "Edit profile": "تعديل الملف",
  "Save profile": "حفظ الملف",
  "Upcoming visits": "مواعيد قادمة",
  "Completed visits": "زيارات مكتملة",
  "Profile complete": "اكتمال الملف",
  "Contact Information": "بيانات الاتصال",
  "How the clinic reaches you": "كيف تتواصل معك العيادة",
  "Email address": "البريد الإلكتروني",
  "Phone number": "رقم الهاتف",
  "Address line 1": "العنوان الأساسي",
  "Address line 2": "تفاصيل إضافية للعنوان",
  "Street, building, area": "الشارع والمبنى والمنطقة",
  "Apartment, floor, landmark": "الشقة والطابق ومعلَم",
  "Personal Details": "البيانات الشخصية",
  "Identity and basic care details": "الهوية وتفاصيل الرعاية الأساسية",
  "Patient ID": "رقم المريض",
  "Not assigned": "غير معطى",
  "Prefer not to say": "أفضل عدم الذكر",
  "Birth date": "تاريخ الميلاد",
  "Photo": "صورة",
  "Care note": "ملاحظة رعاية",
  "{{n}} years approximate age": "العمر الحالي تقريباً {{n}} سنة. يستخدم الأطباء والاستقبال هذه البيانات عند إدارة الحجوزات.",
  "Birth date care hint":
    "إضافة تاريخ الميلاد تساعد الأطباء والاستقبال على إعداد سجلات مواعيد دقيقة.",
  "Profile readiness": "اكتمال الملف",
  "Done": "تم",
  "Missing": "ناقص",
  "Account security": "أمان الحساب",
  "Protect sign-in with an authenticator app.": "احمِ تسجيل الدخول بتطبيق موثّق.",
  "MFA On": "المصادقة الثنائية مفعّلة",
  "MFA Off": "المصادقة الثنائية غير مفعّلة",
  "MFA is required for this account.": "المصادقة الثنائية مطلوبة لهذا الحساب.",
  "6-digit code": "رمز من 6 أرقام",
  "Verify and enable": "تحقق وتفعيل",
  "Set up authenticator": "إعداد تطبيق المصادقة",
  "Disable MFA": "إيقاف المصادقة الثنائية",
  "Connected care": "خدمات مرتبطة",
  "View visits payment prescriptions": "عرض الزيارات والدفع والوصفات",
  "Medical history": "التاريخ الطبي",
  "Update allergies conditions notes": "تحديث الحساسية والحالات والملاحظات",
  "Edit insurance": "تعديل التأمين",
  "Add insurance": "إضافة تأمين",
  "Attach medical card details": "إرفاق بيانات بطاقة التأمين",
  "Quick contact": "تواصل سريع",
  "Contact us heading": "تواصل معنا",
  "Our Office": "مقر العيادة",
  "Building 18, El Teseen Street": "المبنى 18، شارع التسعين",
  "New Cairo, Cairo, Egypt": "القاهرة الجديدة، القاهرة، مصر",
  "Tel:": "الهاتف:",
  "Email:": "البريد الإلكتروني:",
  "Emergency Support": "الدعم الطارئ",
  "For urgent medical assistance, please call:": "للمساعدة الطبية العاجلة، يُرجى الاتصال على:",
  "(24/7 Support)": "(متاح على مدار 24 ساعة)",
  "Address not provided": "لم يُذكر عنوان",
  "Scan the QR code": "امسح رمز QR",
  "MFA setup scan instructions":
    "افتح Google Authenticator أو Microsoft Authenticator، ثم امسح رمز QR، وأدخل الرمز المكوّن من 6 أرقام.",
  "Authenticator verification": "التحقق من تطبيق المصادقة",
  "MFA verify enter code": "أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة.",
  "Authenticator setup QR code alt": "رمز QR لإعداد المصادقة",
  "QR code could not load": "تعذّر تحميل صورة رمز QR.",
  "MFA manual key hint": "استخدم مفتاح الإعداد اليدوي، أو افتح رابط الإعداد أدناه.",
  "Manual setup key": "مفتاح الإعداد اليدوي",
  "Open authenticator setup link": "فتح رابط إعداد المصادقة",
  "Clear": "مسح",
  "Submit": "إرسال",
  "Send": "إرسال",
  [DEFAULT_FOOTER_DESCRIPTION]:
    "نوفر تجربة حجز طبية ذكية وسهلة للوصول إلى أفضل الأطباء بسرعة وأمان.",
  [DEFAULT_FOOTER_COPYRIGHT]: `حقوق النشر © ${DEFAULT_APP_DISPLAY_NAME} - جميع الحقوق محفوظة.`,
  [`${DEFAULT_APP_DISPLAY_NAME} logo`]: `شعار ${DEFAULT_APP_DISPLAY_NAME}`,
  Clinivo: "Clinivo",
  "Booking assistant": "مساعد الحجز الطبي",
  "Chat with us to book": "ابدأ المحادثة",
  "Ask AI": "اسأل المساعد",
  "Type your symptoms or question...": "اكتب أعراضك أو ابدأ الحجز...",
  "Describe your symptoms or question...": "اكتب أعراضك أو ابدأ الحجز...",
  "Send message": "إرسال الرسالة",
  "Close chat": "إغلاق المحادثة",
  "Open booking assistant": "فتح مساعد Clinivo الذكي",
  "Clinic Assistant": "مساعد الحجز الطبي",
  "Assistant is typing": "المساعد يكتب",
  "Book this doctor": "احجز مع هذا الطبيب",
  "Available times": "الأوقات المتاحة",
  "Confirm booking": "تأكيد الحجز",
  "Your name": "اسمك",
  "Your phone": "رقم هاتفك",
  "Reason for visit": "سبب الزيارة",
  "Booking confirmed": "تم تأكيد الحجز",
  "Reservation number": "رقم الحجز",
  "Please log in to complete booking": "يرجى تسجيل الدخول لإتمام الحجز",
  "Select a clinic branch": "اختر فرع العيادة",
  "Hello! How can I help you today? Please tell me your symptoms or health concern.":
    "مرحباً! كيف يمكنني مساعدتك اليوم؟ من فضلك أخبرني عن أعراضك أو مشكلتك الصحية.",
  "Choose a doctor": "اختر طبيباً",
  "Pick date and time": "اختر التاريخ والوقت",
  "Selected appointment": "الموعد المختار",
  "No times available for this doctor": "لا توجد مواعيد متاحة لهذا الطبيب",
  "Tap a time below": "اضغط على الوقت المناسب أدناه",
  "Booking complete message": "تم حجز موعدك بنجاح. نتمنى لك الشفاء العاجل!",
};

const dictionaries = { en: {}, ar };
const reverseAr = Object.fromEntries(Object.entries(ar).map(([key, value]) => [value, key]));

const preserveCaseKey = (text) => {
  if (dictionaries.ar[text]) return text;
  const upper = text.toUpperCase();
  return dictionaries.ar[upper] ? upper : text;
};

export const translateString = (value, language = getStoredLanguage()) => {
  if (value === null || value === undefined) return value;
  const raw = String(value);
  const leading = raw.match(/^\s*/)?.[0] || "";
  const trailing = raw.match(/\s*$/)?.[0] || "";
  const text = raw.trim();
  if (!text) return raw;

  const canonical = reverseAr[text] || preserveCaseKey(text);
  let out;
  if (language === "en") {
    out = `${leading}${canonical}${trailing}`;
  } else {
    out = `${leading}${dictionaries.ar[canonical] || text}${trailing}`;
  }
  return localizeWesternDigits(out, language);
};

const translateContent = (value, language = getStoredLanguage()) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number") return translateString(value, language);
  if (typeof value === "object") {
    if (value[language]) {
      const res = value[language];
      if (typeof res === "string") return localizeWesternDigits(res, language);
      return res;
    }
    if (value.en || value.ar) {
      const res = value.en || value.ar;
      if (typeof res === "string") return localizeWesternDigits(res, language);
      return res;
    }
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
  languagePolicy: DEFAULT_ROLE_LANGUAGE_POLICY,
  allowedLanguages: ["en", "ar"],
  setLanguagePolicy: () => {},
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (value) => value,
  tc: (value) => value,
  localizeDigits: (value) => String(value ?? ""),
  formatPercent: (n) => String(n ?? ""),
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  const [languagePolicy, setLanguagePolicyState] = useState(DEFAULT_ROLE_LANGUAGE_POLICY);
  const allowedLanguages = useMemo(
    () => getAllowedLanguagesFromPolicy(languagePolicy),
    [languagePolicy]
  );
  const [language, setLanguageState] = useState(() =>
    resolveLanguageForPolicy(getStoredLanguage(), DEFAULT_ROLE_LANGUAGE_POLICY)
  );

  const setLanguagePolicy = (nextPolicy) => {
    setLanguagePolicyState(normalizeRoleLanguagePolicy(nextPolicy));
  };

  const setLanguage = (nextLanguage) => {
    const safeLanguage = nextLanguage === "ar" ? "ar" : "en";
    if (!allowedLanguages.includes(safeLanguage)) return;
    localStorage.setItem(STORAGE_KEY, safeLanguage);
    setLanguageState(safeLanguage);
  };

  useEffect(() => {
    const resolved = resolveLanguageForPolicy(getStoredLanguage(), languagePolicy);
    if (resolved !== language) {
      localStorage.setItem(STORAGE_KEY, resolved);
      setLanguageState(resolved);
    }
  }, [languagePolicy, allowedLanguages, language]);

  const value = useMemo(() => {
    const direction = "ltr";
    const toggleLanguage = () => {
      const idx = allowedLanguages.indexOf(language);
      const next = allowedLanguages[(idx + 1) % allowedLanguages.length];
      if (next) setLanguage(next);
    };
    return {
      language,
      direction,
      isRtl: false,
      languagePolicy,
      allowedLanguages,
      setLanguagePolicy,
      setLanguage,
      toggleLanguage,
      t: (text) => translateString(text, language),
      tc: (content) => translateContent(content, language),
      localizeDigits: (v) => localizeWesternDigits(v, language),
      formatPercent: (n) => formatPercentDisplay(n, language),
    };
  }, [language, languagePolicy, allowedLanguages]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
    document.body.dir = "ltr";
    document.body.classList.remove("rtl");
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

const DOM_SKIP_SELECTOR =
  'a, button, input, select, textarea, nav, label, [role="link"], [role="button"], [data-no-translate]';

const shouldSkipDomLocalization = (element) => {
  if (!element) return true;
  if (['SCRIPT', 'STYLE', 'TEXTAREA'].includes(element.tagName)) return true;
  return Boolean(element.closest(DOM_SKIP_SELECTOR));
};

export const localizeElement = (root, language) => {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || shouldSkipDomLocalization(parent)) return NodeFilter.FILTER_REJECT;
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
    if (shouldSkipDomLocalization(element)) return;
    ["placeholder", "title", "alt", "aria-label"].forEach((attr) => {
      if (element.hasAttribute(attr)) {
        const current = element.getAttribute(attr);
        const translated = translateString(current, language);
        if (translated !== current) element.setAttribute(attr, translated);
      }
    });
  });
};

/**
 * Disabled: live DOM text mutation breaks React click handlers across the app.
 * UI strings should use t() / tc() in components; CMS fields already call t() where needed.
 */
export const LanguageDomSync = () => null;

export const LanguagePolicySync = ({ policy }) => {
  const { setLanguagePolicy } = useLanguage();
  const en = policy?.en;
  const ar = policy?.ar;
  useEffect(() => {
    setLanguagePolicy({ en, ar });
  }, [en, ar, setLanguagePolicy]);
  return null;
};

export const LanguageToggle = ({ compact = false }) => {
  const { language, setLanguage, allowedLanguages } = useLanguage();

  if (allowedLanguages.length <= 1) return null;

  return (
    <div
      className={`inline-flex items-center rounded-full border border-gray-200 bg-white shadow-sm ${compact ? "p-0.5" : "p-1"}`}
      dir="ltr"
      aria-label="Language switcher"
    >
      {allowedLanguages.map((key) => {
        const config = LANGUAGES[key];
        if (!config) return null;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setLanguage(key)}
            className={`rounded-full font-semibold transition ${
              compact ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
            } ${language === key ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}
            title={config.label}
          >
            {config.shortLabel}
          </button>
        );
      })}
    </div>
  );
};
