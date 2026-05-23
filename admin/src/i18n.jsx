import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { localizeWesternDigits } from "./utils/arabicNumerals.js";
import {
  DEFAULT_ROLE_LANGUAGE_POLICY,
  getAllowedLanguagesFromPolicy,
  normalizeRoleLanguagePolicy,
  resolveLanguageForPolicy,
} from "./utils/languageAvailability.js";

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
  "Notifications": "الإشعارات",
  "Mark all read": "تعليم الكل كمقروء",
  "No notifications yet": "لا توجد إشعارات بعد",
  "Dashboard": "لوحة التحكم",
  "Patients": "المرضى",
  "All Patients": "جميع المرضى",
  "Doctors": "الأطباء",
  "Appointments": "المواعيد",
  "Appointment": "موعد",
  "Clinics": "العيادات",
  "Add Doctor": "إضافة طبيب",
  "Back to doctors": "العودة إلى الأطباء",
  "Back to receptionists": "العودة إلى موظفي الاستقبال",
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
  "My Profile": "الملف الشخصي",
  "My account": "حسابي",
  "Administrator account": "حساب المسؤول",
  "Security settings": "إعدادات الأمان",
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
  "Checked In": "تم تسجيل الحضور",
  "In Progress": "قيد الزيارة",
  "Finished": "منتهية",
  "Cash": "نقدي",
  "Site logo": "شعار الموقع",
  "Insurance provider": "شركة التأمين",
  "Patient insurance file": "ملف تأمين المريض",
  "Save patient insurance": "حفظ بيانات التأمين للمريض",
  "Please select an insurance provider": "يرجى اختيار شركة التأمين",
  "Please attach a photo of the medical card": "يرجى إرفاق صورة بطاقة التأمين",
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
  "Actual Appointments": "المواعيد الحالية",
  "Finished Appointments": "المواعيد المنتهية",
  "Overview": "نظرة عامة",
  "Users": "المستخدمون",
  "Page Design": "تصميم الصفحة",
  "Security Options": "خيارات الأمان",
  "Menu": "القائمة",
  "Close": "إغلاق",
  "Admin navigation": "تنقل المسؤول",
  "Doctor navigation": "تنقل الطبيب",
  "Receptionist navigation": "تنقل الاستقبال",
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
  "Reception Desk": "مكتب الاستقبال",
  "Front desk": "الاستقبال",
  "Could not load dashboard": "تعذر تحميل لوحة التحكم",
  "Check your connection and try again.": "تحقق من الاتصال وحاول مرة أخرى.",
  "Reload": "إعادة التحميل",
  "Could not refresh; showing last loaded data.": "تعذر التحديث؛ تُعرض آخر بيانات محمّلة.",
  "Today's queue, check-ins, payments, and quick access to common tasks.": "قائمة اليوم، تسجيل الحضور، المدفوعات، واختصارات للمهام الشائعة.",
  "Updated": "آخر تحديث",
  "Refresh": "تحديث",
  "Outstanding (total)": "غير مدفوع (الإجمالي)",
  "Paid visits today": "زيارات مدفوعة اليوم",
  "collected": "تم تحصيلها",
  "Outstanding today": "مستحقات اليوم",
  "still due": "مستحقة",
  "Doctors on schedule": "أطباء على الجدول",
  "Unique doctors with visits": "أطباء مختلفون لديهم مواعيد",
  "Needs payment": "بحاجة لدفع",
  "Active visits not fully paid": "زيارات نشطة غير مدفوعة بالكامل",
  "Today's schedule": "جدول اليوم",
  "finished": "منتهية",
  "cancelled": "ملغاة",
  "All": "الكل",
  "Action needed": "بحاجة لإجراء",
  "Search by patient, phone, doctor, ref…": "ابحث بالمريض أو الهاتف أو الطبيب أو الرقم…",
  "No visits match your filters for today.": "لا توجد زيارات مطابقة لعوامل التصفية اليوم.",
  "Location / mode": "الموقع / النوع",
  "Manage": "إدارة",
  "Weekly volume": "حجم الأسبوع",
  "Active appointments per day (last 7 days)": "مواعيد نشطة يومياً (آخر 7 أيام)",
  "Recent bookings": "أحدث الحجوزات",
  "paid today": "مدفوع اليوم",
  "View all appointments": "عرض كل المواعيد",
  "Not Paid": "غير مدفوع",
  "Receptionist Appointments": "مواعيد الاستقبال",
  "Search, filter, and expand a visit to check in, record payment, or edit home visit details.": "ابحث، صفّ، ووسّع الزيارة لتسجيل الحضور أو المدفوعات أو عنوان الزيارة المنزلية.",
  "Filters & sort": "التصفية والفرز",
  "Clear all": "مسح الكل",
  "Sort: soonest first": "الفرز: الأقرب أولاً",
  "Sort: latest first": "الفرز: الأحدث أولاً",
  "Sort: patient A–Z": "الفرز: المريض أ-ي",
  "Sort: doctor A–Z": "الفرز: الطبيب أ-ي",
  "Any date": "أي تاريخ",
  "Today only": "اليوم فقط",
  "This week": "هذا الأسبوع",
  "Upcoming (from today)": "القادمة (من اليوم)",
  "Past (before today)": "السابقة (قبل اليوم)",
  "Any payment": "أي دفع",
  "Paid only": "المدفوع فقط",
  "Unpaid only": "غير المدفوع فقط",
  "Any status": "أي حالة",
  "Any visit type": "أي نوع زيارة",
  "No appointments match your filters.": "لا توجد مواعيد مطابقة للتصفية.",
  "Hide": "إخفاء",
  "Details": "التفاصيل",
  "Due": "المستحق",
  "Patient & visit": "المريض والزيارة",
  "Patient ID": "رقم المريض",
  "Visit status": "حالة الزيارة",
  "Payment & billing": "الدفع والفوترة",
  "Amount due": "المبلغ المستحق",
  "Base fee": "الكشف الأساسي",
  "discount": "خصم",
  "Open call room": "غرفة الاتصال",
  "Payment method (when marked paid)": "طريقة الدفع (عند التسديد)",
  "Card": "بطاقة",
  "Insurance coverage": "تغطية التأمين",
  "Set the percentage covered by insurance. Fee and discount update automatically.": "حدد نسبة التغطية التأمينية. يُحدَّث الكشف والخصم تلقائياً.",
  "Coverage (%)": "نسبة التغطية (%)",
  "Insurance discount": "خصم التأمين",
  "Patient pays": "يدفع المريض",
  "Discount amount": "مبلغ الخصم",
  "Discount reason": "سبب الخصم",
  "e.g. staff discount": "مثال: خصم موظفين",
  "Payment note": "ملاحظة الدفع",
  "Receipt notes, reference…": "ملاحظات الإيصال، مرجع…",
  "Saving…": "جاري الحفظ…",
  "Save payment": "حفظ الدفع",
  "Home visit address": "عنوان الزيارة المنزلية",
  "No address saved yet": "لا يوجد عنوان محفوظ بعد",
  "Choose area": "اختر المنطقة",
  "Building": "المبنى",
  "Floor": "الطابق",
  "Apt": "شقة",
  "Checked in": "تم تسجيل الحضور",
  "Video Call": "مكالمة فيديو",
  "Voice Call": "مكالمة صوتية",
  "Home Visit": "زيارة منزلية",
  "Book appointment": "حجز موعد",
  "Select patient and doctor, preview fees including insurance, then confirm the slot.": "اختر المريض والطبيب، واعرض الرسوم بما فيها التأمين، ثم أكّد الموعد.",
  "Slot": "الموعد",
  "Step": "الخطوة",
  "Find patient": "اختر المريض",
  "New Patient": "مريض جديد",
  "Search doctor or speciality": "ابحث عن طبيب أو تخصص",
  "Visit type": "نوع الزيارة",
  "In clinic": "في العيادة",
  "Voice call": "مكالمة صوتية",
  "Video call": "مكالمة فيديو",
  "Home visit": "زيارة منزلية",
  "Not available for this doctor": "غير متاح لهذا الطبيب",
  "Clinic locations": "مواقع العيادة",
  "slots this week": "مواعيد هذا الأسبوع",
  "Choose supported area": "اختر منطقة مدعومة",
  "Street name and number": "اسم الشارع والرقم",
  "Landmark or notes": "علامة مميزة أو ملاحظات",
  "Only the listed Cairo, Giza, and nearby areas are supported.": "المناطق المدعومة فقط هي القاهرة والجيزة والمجاورات المدرجة.",
  "Hide ratings": "إخفاء التقييمات",
  "Show ratings": "عرض التقييمات",
  "No doctor selected": "لم يُختر طبيب",
  "No slot selected": "لم يُختر موعد",
  "Booking summary": "ملخص الحجز",
  "Review before confirming. Payment is recorded later at the desk.": "راجع قبل التأكيد. يُسجَّل الدفع لاحقاً في الاستقبال.",
  "Fee preview & insurance": "معاينة الرسوم والتأمين",
  "Insurance % applies to the listed consultation fee, in addition to any active doctor promo.": "نسبة التأمين تُطبَّق على سعر الكشف المعلن، بالإضافة لأي عرض ترويجي مفعّل للطبيب.",
  "Insurance coverage (%)": "تغطية التأمين (%)",
  "List price": "سعر القائمة",
  "Promo discount": "خصم العرض",
  "Estimated due": "المتوقع مستحق",
  "Home visit fee (+50%)": "رسوم الزيارة المنزلية (+٥٠٪)",
  "Home visit fee (+{{pct}}%)": "رسوم الزيارة المنزلية (+{{pct}}٪)",
  "Home visit fee (fixed {{amount}})": "رسوم الزيارة المنزلية (ثابت {{amount}})",
  "Home visit pricing": "تسعير الزيارة المنزلية",
  "Global visit fees": "رسوم الكشف والاستشارة للجميع",
  "Global visit fees description": "حدد رسوم الكشف والاستشارة الافتراضية لجميع الأطباء. يُستخدم هذا السعر لكل طبيب لم يُحدَّد له سعر خاص.",
  "Apply global fees to all doctors": "تفعيل الأسعار الافتراضية لجميع الأطباء",
  "Global fees default hint": "يُطبَّق على الأطباء بدون رسوم خاصة. إذا أضاف المسؤول رسوماً لطبيب معيّن، تُلغى هذه الأسعار لذلك الطبيب فقط.",
  "Global fees override hint": "يُطبَّق على الأطباء بدون رسوم خاصة. إذا أضاف المسؤول رسوماً لطبيب معيّن، تُلغى هذه الأسعار لذلك الطبيب فقط.",
  "Examination fee (Kashf)": "رسوم الكشف",
  "Examination fee hint": "الزيارة الكاملة — الخيار الافتراضي عند الحجز.",
  "Follow-up consultation fee (Istishara)": "رسوم الاستشارة",
  "Follow-up consultation fee hint": "رسوم أقل — متاحة فقط خلال 30 يوماً بعد كشف مكتمل مع نفس الطبيب.",
  "Consultation must be lower than examination": "يجب أن تكون رسوم الاستشارة أقل من رسوم الكشف.",
  "User languages": "لغات المستخدمين",
  "User languages description": "تحكم في اللغات التي يمكن للمرضى والموظفين التبديل بينها في الموقع.",
  "English only": "الإنجليزية فقط",
  "Arabic only": "العربية فقط",
  "Both English and Arabic": "الإنجليزية والعربية معاً",
  "English only hint": "يظهر الموقع بالإنجليزية فقط ويُخفى مبدّل اللغة.",
  "Arabic only hint": "يظهر الموقع بالعربية فقط ويُخفى مبدّل اللغة.",
  "Both languages hint": "يمكن للمستخدمين التبديل بين الإنجليزية والعربية.",
  "Home visit pricing description": "حدد رسوم الزيارة المنزلية كنسبة من رسوم الكشف أو مبلغ ثابت. يظهر للمرضى عند الحجز.",
  "User languages settings": "إعدادات لغات المستخدمين",
  "User languages settings description": "فعّل أو عطّل الإنجليزية والعربية لكل نوع مستخدم على حدة.",
  "Patients language hint": "الموقع العام وتطبيق المرضى.",
  "Doctors language hint": "لوحة الطبيب وتطبيق الموظفين.",
  "Receptionists language hint": "لوحة موظف الاستقبال.",
  "Admins language hint": "لوحة المسؤول.",
  "Enable English": "تفعيل الإنجليزية",
  "Enable Arabic": "تفعيل العربية",
  "At least one language required": "يجب تفعيل لغة واحدة على الأقل لكل نوع مستخدم.",
  "Pricing mode": "طريقة التسعير",
  "Percentage of consultation fee": "نسبة من رسوم الكشف",
  "Percentage mode hint": "مثال: ٥٠٪ تعني نصف رسوم الطبيب تُضاف للزيارة المنزلية.",
  "Fixed amount": "مبلغ ثابت",
  "Fixed mode hint": "نفس الرسوم لكل زيارة منزلية بغض النظر عن رسوم الطبيب.",
  "Percentage value": "قيمة النسبة",
  "Fixed home visit amount": "مبلغ الزيارة المنزلية الثابت",
  "Example": "مثال",
  "If doctor fee is": "إذا كانت رسوم الطبيب",
  "home visit adds": "تُضاف للزيارة",
  "total": "الإجمالي",
  "Save settings": "حفظ الإعدادات",
  "Saving...": "جاري الحفظ...",
  "Booking...": "جاري الحجز...",
  "Patient & insurance admin": "إدارة المريض والتأمين",
  "Medical Card *": "البطاقة التأمينية *",
  "Add New Patient": "إضافة مريض جديد",
  "Prefer not to say": "تفضيل عدم الإفصاح",
  "Temporary password *": "كلمة مرور مؤقتة *",
  "Add Insurance": "إضافة تأمين",
  "Insurance Full Name *": "الاسم الكامل على التأمين *",
  "Save Patient": "حفظ المريض",
  "Add Insurance for Existing Patient": "إضافة تأمين لمريض مسجل",
  "Attach medical card": "إرفاق البطاقة التأمينية",
  "Save Insurance": "حفظ التأمين",
  "Insurance verification": "التحقق من التأمين",
  "Review card details and confirm coverage before using insurance on a visit.": "راجع بيانات البطاقة وأكد التغطية قبل استخدام التأمين في الزيارة.",
  "Pending review": "قيد المراجعة",
  "Approved": "مقبول",
  "Declined": "مرفوض",
  "No insurance": "بدون تأمين",
  "Approve insurance": "قبول التأمين",
  "Decline insurance": "رفض التأمين",
  "Approve for this visit": "قبول لهذه الزيارة",
  "Decline for this visit": "رفض لهذه الزيارة",
  "Decline reason (required if declining)": "سبب الرفض (مطلوب عند الرفض)",
  "Visit note (optional)": "ملاحظة الزيارة (اختياري)",
  "Verified for visit": "تم التحقق للزيارة",
  "Declined for visit": "مرفوض للزيارة",
  "Not checked for visit": "لم يُتحقق للزيارة",
  "Please confirm insurance status for this visit before booking.": "يرجى تأكيد حالة التأمين لهذه الزيارة قبل الحجز.",
  "Please provide a reason when declining insurance for this visit.": "يرجى إدخال سبب عند رفض التأمين لهذه الزيارة.",
  "Insurance card expiry date has passed. Update details or decline coverage.": "انتهت صلاحية بطاقة التأمين. حدّث البيانات أو ارفض التغطية.",
  "Reason": "السبب",
  "Please choose a patient": "يرجى اختيار مريض",
  "Please choose a doctor": "يرجى اختيار طبيب",
  "Please choose a day": "يرجى اختيار يوم",
  "Please choose a time": "يرجى اختيار وقت",
  "Please choose clinic location": "يرجى اختيار موقع العيادة",
  "Please choose an area and enter street name and number": "يرجى اختيار المنطقة وإدخال اسم الشارع والرقم",
  "No patient ID": "لا رقم مريض",
  "No patient selected": "لم يُختر مريض",
  "Confirm booking": "تأكيد الحجز",
  "Full Name *": "الاسم الكامل *",
  "Email *": "البريد الإلكتروني *",
  "Phone Number *": "رقم الهاتف *",
  "Loading ratings...": "جاري تحميل التقييمات...",
  "Reception desk": "مكتب الاستقبال",
  "The appointment is saved only after all required choices are complete.": "يُحفظ الموعد فقط بعد إكمال كل الخيارات المطلوبة.",
  "Doctor Dashboard": "لوحة تحكم الطبيب",
  "Financial Analysis": "التحليل المالي",
  "Financial Analytics": "التحليل المالي (الإدارة)",
  "Good morning": "صباح الخير",
  "Good afternoon": "مساء الخير",
  "Good evening": "مساء الخير",
  "Welcome back": "مرحباً بعودتك",
  "Here is your practice at a glance.": "إليك نظرة سريعة على عيادتك.",
  "Practice pulse": "نبض العيادة",
  "Scheduled for today": "مجدولة اليوم",
  "Open visits": "زيارات مفتوحة",
  "Finished visits": "زيارات منتهية",
  "Recent activity": "النشاط الأخير",
  "Your latest bookings, newest first.": "أحدث حجوزاتك، الأجدد أولاً.",
  "Quick actions": "إجراءات سريعة",
  "Manage calendar": "إدارة التقويم",
  "Schedule conflict": "تعارض في الجدول",
  "Each branch can override the repeat schedule below. The same date and time cannot be booked at two branches; the booking screen greys out slots already chosen elsewhere.": "يمكن لكل فرع تجاوز جدول التكرار أدناه. لا يمكن حجز نفس التاريخ والوقت في فرعين؛ شاشة الحجز تعطّل المواعيد المختارة مسبقاً في فرع آخر.",
  "Visit records": "سجلات الزيارات",
  "Revenue insights": "تحليلات الإيرادات",
  "Fee": "الكشف",
  "Ref": "المرجع",
  "Could not load your dashboard.": "تعذر تحميل لوحة التحكم.",
  "Try again": "حاول مرة أخرى",
  "Shortcuts to your most-used pages.": "اختصارات لأكثر الصفحات استخداماً.",
  "Paid or completed visits": "زيارات مدفوعة أو مكتملة",
  "All registered visits": "كل الزيارات المسجلة",
  "Unique patients served": "مرضى مميزون خدمتهم",
  "Manage appointments": "إدارة المواعيد",
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
    const direction = LANGUAGES[language].dir;
    const toggleLanguage = () => {
      const idx = allowedLanguages.indexOf(language);
      const next = allowedLanguages[(idx + 1) % allowedLanguages.length];
      if (next) setLanguage(next);
    };
    return {
      language,
      direction,
      isRtl: direction === "rtl",
      languagePolicy,
      allowedLanguages,
      setLanguagePolicy,
      setLanguage,
      toggleLanguage,
      t: (text) => translateString(text, language),
      tc: (content) => translateContent(content, language),
      localizeDigits: (v) => localizeWesternDigits(v, language),
    };
  }, [language, languagePolicy, allowedLanguages]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = value.direction;
    document.body.dir = value.direction;
    document.body.classList.toggle("rtl", value.isRtl);
  }, [language, value.direction, value.isRtl]);

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

/** Disabled: live DOM mutation breaks React click handlers. Use t() / tc() in React instead. */
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
  const { language, setLanguage, isRtl, allowedLanguages } = useLanguage();

  if (allowedLanguages.length <= 1) return null;

  return (
    <div
      className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1 shadow-sm"
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
            className={`cursor-pointer select-none rounded-full px-3 py-1 text-xs font-semibold transition active:bg-gray-100 ${
              language === key ? "bg-primary text-white" : "text-gray-600"
            }`}
            title={config.label}
          >
            {compact ? config.shortLabel : key === "ar" && !isRtl ? "AR" : config.shortLabel}
          </button>
        );
      })}
    </div>
  );
};
