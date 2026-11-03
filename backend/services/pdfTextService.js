/**
 * PDFKit's built-in fonts have no Arabic, so an Arabic patient name or address printed as garbage.
 * Names, branches and doctors' notes can be either language or mix both, so a line is split into
 * Arabic and Latin runs, each drawn in a font that has the glyphs.
 */
export const TEXT_FONT_FILES = {
  'text-arabic': 'ibm-plex-sans-arabic-arabic-400-normal.woff',
  'text-latin': 'ibm-plex-sans-arabic-latin-400-normal.woff'
}

const ARABIC_CHARS = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/
const LATIN_ONLY_WHEN_NO_LETTERS = /^[\s\d.,:;()\-+/#%&'"!?·•—]*$/

export const hasArabic = (text) => ARABIC_CHARS.test(String(text || ''))

export const registerTextFonts = (doc, fontBytes) => {
  const available = {}
  for (const [name, bytes] of Object.entries(fontBytes)) {
    if (!bytes) continue
    doc.registerFont(name, bytes)
    available[name] = true
  }
  doc.textFonts = available
}

/** Splits into runs of one script. Digits and punctuation stay with the run they sit in. */
export const splitTextRuns = (text) => {
  const runs = []
  for (const char of String(text)) {
    const arabic = ARABIC_CHARS.test(char)
    const neutral = !arabic && LATIN_ONLY_WHEN_NO_LETTERS.test(char)
    const last = runs[runs.length - 1]
    if (last && (neutral || last.arabic === arabic)) {
      last.text += char
    } else {
      runs.push({ arabic, text: char })
    }
  }
  return runs
}

/** Moves trailing neutrals out of a run, so "اسم (Ali)" keeps its spaces and brackets where they read naturally. */
const orderRunsForDisplay = (runs, baseIsArabic) => (baseIsArabic ? [...runs].reverse() : runs)

const drawRuns = (doc, runs) => {
  runs.forEach((run, index) => {
    const continued = index < runs.length - 1
    doc.font(run.arabic ? 'text-arabic' : 'text-latin').text(run.text, { continued })
  })
}

/** Writes one logical line. Pure Latin keeps the document's default font, so existing PDFs look the same. */
export const writeText = (doc, text) => {
  const value = String(text ?? '')
  if (!hasArabic(value) || !doc.textFonts?.['text-arabic'] || !doc.textFonts?.['text-latin']) {
    // Without the Arabic font a Latin-only encoder would print garbage, so say so rather than print it.
    const safe = hasArabic(value) ? value.replace(new RegExp(ARABIC_CHARS, 'g'), '?') : value
    doc.font('Helvetica').text(safe)
    return
  }

  const runs = splitTextRuns(value)
  const baseIsArabic = runs[0]?.arabic === true
  drawRuns(doc, orderRunsForDisplay(runs, baseIsArabic))
  doc.font('Helvetica')
}
