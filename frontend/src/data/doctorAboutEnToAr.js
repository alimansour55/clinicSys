/**
 * Curated Arabic bios for seeded / demo doctors (English `about` → Arabic).
 * Used before API machine-translation for consistent clinical copy.
 */
export const DOCTOR_ABOUT_EN_TO_AR = {
  'Experienced general physician specializing in chronic disease management, preventive care, and routine medical checkups.':
    'طبيب عام ذو خبرة في إدارة الأمراض المزمنة، والرعاية الوقائية، والفحوصات الطبية الدورية، مع اهتمام بتقديم رعاية صحية شاملة ومتابعة دقيقة للمرضى.',

  'doctor who looks awesome':
    'طبيبة متخصصة في صحة المرأة ومتابعة الحمل وعلاج المشكلات النسائية، مع اهتمام بتقديم رعاية طبية متكاملة بأعلى مستوى من الاحترافية.',

  "Specialized in women's reproductive health, pregnancy follow-up, infertility treatment, and minimally invasive gynecological procedures.":
    'متخصصة في صحة المرأة الإنجابية، ومتابعة الحمل، وعلاج تأخر الإنجاب، بالإضافة إلى الإجراءات النسائية الحديثة طفيفة التوغل.',

  'Specialized in women\u2019s reproductive health, pregnancy follow-up, infertility treatment, and minimally invasive gynecological procedures.':
    'متخصصة في صحة المرأة الإنجابية، ومتابعة الحمل، وعلاج تأخر الإنجاب، بالإضافة إلى الإجراءات النسائية الحديثة طفيفة التوغل.',

  'N/A':
    'طبيبة أطفال بخبرة واسعة في متابعة نمو الأطفال، وتشخيص وعلاج الأمراض الشائعة، وتقديم الرعاية الصحية الوقائية للأطفال بمختلف الأعمار.',

  'Expert in acne treatment, cosmetic dermatology, skin rejuvenation, and management of chronic skin diseases.':
    'متخصصة في علاج حب الشباب، والأمراض الجلدية المزمنة، والإجراءات التجميلية، وتجديد نضارة البشرة باستخدام أحدث التقنيات.',

  'Perfect':
    'طبيب متخصص في تشخيص وعلاج أمراض الجهاز العصبي، مع خبرة في متابعة حالات الصداع المزمن، واضطرابات الأعصاب، والمشكلات العصبية المختلفة.',

  '...':
    'طبيب أطفال يهتم بتقديم الرعاية الصحية للأطفال، ومتابعة النمو والتطور، وتشخيص الحالات المرضية الشائعة بدقة واهتمام.',

  'Dedicated physician focused on primary healthcare, patient counseling, and preventive medicine for all age groups.':
    'طبيبة متخصصة في الرعاية الصحية الأولية، وتقديم الاستشارات الطبية، وتعزيز الوقاية الصحية لجميع الفئات العمرية.',

  'Provides comprehensive gynecological care with expertise in prenatal care, hormonal disorders, and fertility management.':
    'يقدم رعاية متكاملة لصحة المرأة، مع خبرة في متابعة الحمل، وعلاج اضطرابات الهرمونات، وإدارة مشكلات الخصوبة والإنجاب.',
}

export const isKnownDoctorAboutEn = (about) => {
  const key = String(about || '').trim()
  return Boolean(key && DOCTOR_ABOUT_EN_TO_AR[key])
}

export const getStaticDoctorAboutAr = (about) => {
  const key = String(about || '').trim()
  return DOCTOR_ABOUT_EN_TO_AR[key] || ''
}
