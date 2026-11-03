/**
 * The last line of safety for when the server cannot be reached. The server holds the full rules.
 * This keeps only the clearest red flags, so an outage can never turn "chest pain" into a booking.
 */
const normalize = (text = '') =>
  String(text)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')

const RED_FLAGS = [
  /chest (pain|hurts?|tight)|pain in (my|the) chest|heart attack/,
  /(can'?t|cannot|can not|trouble|difficulty|hard to) breath|short of breath|not breathing|choking/,
  /\bstroke\b|face droop|slurred speech|paraly[sz]ed/,
  /(severe|heavy|won'?t stop).{0,20}bleed|bleed.{0,20}(severe|heavy|won'?t stop)/,
  /suicid|kill myself|end my life|want to die|hurt myself|self.?harm/,
  /unconscious|passed out|overdose/,
  /(الم|وجع|بيوجع|واجع|كتمه).{0,20}صدر|صدر.{0,20}(الم|وجع|بيوجع|واجع|كتمه)|ازمه قلبيه|نوبه قلبيه/,
  /مش (قادر|قادره|عارف|عارفه) (ات|يت|تت)نفس|صعوبه.{0,6}تنفس|ضيق.{0,6}(تنفس|نفس)|لا استطيع التنفس|اختناق|بيتخنق/,
  /سكته|جلطه|شلل|اتشل|(وش|وجه).{0,4}مايل/,
  /نزيف|بينزف|بتنزف/,
  /انتحار|انتحر|اقتل نفسي|(عايز|عايزه|عاوز|عاوزه|نفسي) اموت|مش (عايز|عايزه|عاوز|عاوزه) اعيش|اذي نفسي/,
  /فقد.{0,4}الوعي|اغمي علي|مش بيفوق|تشنجات|جرعه زايده/,
  /wag3 f? ?sedr|mesh (3aref|2ader) atnafes|3ayez amot|entehar/
]

export const isLocalRedFlag = (text = '') => {
  const norm = normalize(text)
  return RED_FLAGS.some((pattern) => pattern.test(norm))
}
