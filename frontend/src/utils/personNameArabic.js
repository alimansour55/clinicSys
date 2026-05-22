/**
 * Latin personal names → Arabic display when UI language is Arabic.
 * Uses a dictionary of common names; unknown tokens get a simple letter transliteration.
 */

const COMMON_NAMES = {
  ahmed: 'أحمد',
  ahmad: 'أحمد',
  mohamed: 'محمد',
  muhammad: 'محمد',
  muhammed: 'محمد',
  mohammed: 'محمد',
  mahmoud: 'محمود',
  mahmud: 'محمود',
  mansour: 'منصور',
  mansur: 'منصور',
  martin: 'مارتين',
  martine: 'مارتين',
  sara: 'سارة',
  sarah: 'سارة',
  ali: 'علي',
  omar: 'عمر',
  amr: 'عمرو',
  hossam: 'حسام',
  husam: 'حسام',
  yasmine: 'ياسمين',
  yasmin: 'ياسمين',
  fatima: 'فاطمة',
  mariam: 'مريم',
  maryam: 'مريم',
  nada: 'ندى',
  nadia: 'ناديا',
  heba: 'هبة',
  hiba: 'هبة',
  khaled: 'خالد',
  khalid: 'خالد',
  tarek: 'طارق',
  tarik: 'طارق',
  waleed: 'وليد',
  walid: 'وليد',
  mostafa: 'مصطفى',
  mustafa: 'مصطفى',
  ibrahim: 'إبراهيم',
  youssef: 'يوسف',
  yusuf: 'يوسف',
  karim: 'كريم',
  kareem: 'كريم',
  sherif: 'شريف',
  sharif: 'شريف',
  ehab: 'إيهاب',
  rami: 'رامي',
  ramy: 'رامي',
  hassan: 'حسن',
  hasan: 'حسن',
  hussain: 'حسين',
  hussein: 'حسين',
  sayed: 'سيد',
  saeed: 'سعيد',
  mona: 'منى',
  maya: 'مايا',
  menna: 'منة',
  mohsen: 'محسن',
  layla: 'ليلى',
  leila: 'ليلى',
  dina: 'دينا',
  reem: 'ريم',
  hana: 'هنا',
  hannah: 'حنا',
  john: 'جون',
  james: 'جيمس',
  michael: 'مايكل',
  david: 'ديفيد',
  daniel: 'دانيال',
  emily: 'إيميلي',
  anna: 'آنا',
  lisa: 'ليزا',
  mark: 'مارك',
  paul: 'بول',
  peter: 'بيتر',
  robert: 'روبرت',
  thomas: 'توماس',
  william: 'ويليام',
  jennifer: 'جينيفر',
  jessica: 'جيسيكا',
  nicole: 'نيكول',
  rachel: 'راشيل',
  samuel: 'صموئيل',
  benjamin: 'بنيامين',
  natalie: 'ناتالي',
  victoria: 'فيكتوريا',
  alexander: 'ألكسندر',
  christopher: 'كريستوفر',
  andrew: 'أندرو',
  jonathan: 'جوناثان',
  nicholas: 'نيكولاس',
  anthony: 'أنتوني',
  joseph: 'جوزيف',
  charles: 'تشارلز',
  george: 'جورج',
  henry: 'هنري',
  edward: 'إدوارد',
  richard: 'ريتشارد',
  steven: 'ستيفن',
  kevin: 'كيفن',
  brian: 'براين',
  jason: 'جيسون',
  ryan: 'ريان',
  jacob: 'يعقوب',
  ethan: 'إيثان',
  noah: 'نوح',
  lucas: 'لوكاس',
  jack: 'جاك',
  adam: 'آدم',
  oliver: 'أوليفر',
  sophia: 'صوفيا',
  emma: 'إيما',
  olivia: 'أوليفيا',
  ava: 'آفا',
  mia: 'ميا',
  chloe: 'كلوي',
  lily: 'ليلي',
  grace: 'غريس',
  zoe: 'زوي',
  ella: 'إيلا',
  scarlett: 'سكارليت',
  victor: 'فيكتور',
  simon: 'سيمون',
  louis: 'لويس',
  pierre: 'بيير',
  marie: 'ماري',
  claire: 'كلير',
  sophie: 'صوفي',
  nina: 'نينا',
  ola: 'علا',
  lina: 'لينا',
  tamer: 'تامر',
  shadi: 'شادي',
  wael: 'وائل',
  bassem: 'باسم',
  bassel: 'باسل',
  fadi: 'فادي',
  nader: 'نادر',
  gamal: 'جمال',
  farid: 'فريد',
  salma: 'سلمى',
  nour: 'نور',
  laila: 'ليلى',
}

const LETTER = {
  a: 'ا',
  b: 'ب',
  c: 'ك',
  d: 'د',
  e: 'ي',
  f: 'ف',
  g: 'ج',
  h: 'ه',
  i: 'ي',
  j: 'ج',
  k: 'ك',
  l: 'ل',
  m: 'م',
  n: 'ن',
  o: 'و',
  p: 'ب',
  q: 'ق',
  r: 'ر',
  s: 'س',
  t: 'ت',
  u: 'و',
  v: 'ف',
  w: 'و',
  x: 'كس',
  y: 'ي',
  z: 'ز',
}

const transliterateToken = (token) => {
  const letters = token.toLowerCase().replace(/[^a-z]/g, '')
  if (!letters) return token
  let out = ''
  for (const ch of letters) {
    out += LETTER[ch] || ''
  }
  return out || token
}

const translateToken = (raw) => {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  if (/[\u0600-\u06FF]/.test(trimmed)) return trimmed
  const hyphenParts = trimmed.split('-')
  return hyphenParts
    .map((part) => {
      const lettersOnly = part.replace(/[^a-zA-Z']/g, '')
      if (!lettersOnly) return part
      const key = lettersOnly.toLowerCase().replace(/'/g, '')
      if (COMMON_NAMES[key]) return COMMON_NAMES[key]
      return transliterateToken(lettersOnly)
    })
    .join('-')
}

/** Full display name: space-separated tokens, hyphens preserved. */
export const displayPersonName = (name, language) => {
  const s = String(name || '').trim()
  if (!s) return ''
  if (language !== 'ar') return s
  if (/[\u0600-\u06FF]/.test(s)) return s
  return s.split(/\s+/).map(translateToken).join(' ')
}
