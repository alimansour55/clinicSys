/**
 * PDFKit's built-in fonts have no Arabic, so an Arabic patient name or address printed as garbage.
 * Names, branches and doctors' notes can be either language or mix both, so each line is laid out
 * here: words are ordered for display, Arabic words use the Arabic font, everything else (spaces,
 * digits, Latin) the Latin one, because each bundled font file covers only its own script.
 */
export const TEXT_FONT_FILES = {
  'text-arabic': 'ibm-plex-sans-arabic-arabic-400-normal.woff',
  'text-latin': 'ibm-plex-sans-arabic-latin-400-normal.woff'
}

const ARABIC_CHARS = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/
const LATIN_LETTERS = /[A-Za-z]/

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

const wordDirection = (word) => {
  if (ARABIC_CHARS.test(word)) return 'rtl'
  if (LATIN_LETTERS.test(word)) return 'ltr'
  return ''
}

/**
 * Display order for one line, as a list of { text, arabic } pieces drawn left to right.
 * A simplified bidi: runs of Arabic words read right to left, Latin runs left to right, and
 * numbers or punctuation take the direction of the words around them.
 */
export const layoutLine = (text) => {
  const words = String(text).split(/\s+/).filter(Boolean)
  if (!words.length) return []

  const strong = words.map(wordDirection)
  const base = strong.find(Boolean) || 'ltr'
  const directions = strong.map((dir, index) => {
    if (dir) return dir
    const before = strong.slice(0, index).reverse().find(Boolean)
    const after = strong.slice(index + 1).find(Boolean)
    return before && before === after ? before : before || after || base
  })

  const segments = []
  words.forEach((word, index) => {
    const last = segments[segments.length - 1]
    if (last && last.dir === directions[index]) last.words.push(word)
    else segments.push({ dir: directions[index], words: [word] })
  })

  const ordered = base === 'rtl' ? [...segments].reverse() : segments
  const pieces = []
  ordered.forEach((segment, segmentIndex) => {
    const segmentWords = segment.dir === 'rtl' ? [...segment.words].reverse() : segment.words
    segmentWords.forEach((word, wordIndex) => {
      if (segmentIndex > 0 || wordIndex > 0) pieces.push({ text: ' ', arabic: false })
      // A word mixing scripts ("12أ") is split again so each part gets a font that has its glyphs.
      for (const part of word.match(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+|[^؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+/g)) {
        pieces.push({ text: part, arabic: ARABIC_CHARS.test(part) })
      }
    })
  })
  return pieces
}

const fontFor = (piece) => (piece.arabic ? 'text-arabic' : 'text-latin')

const widthOf = (doc, text) => layoutLine(text).reduce((sum, piece) => sum + doc.font(fontFor(piece)).widthOfString(piece.text), 0)

/** Breaks a logical line into lines that fit, before reordering, so wrapped Arabic still reads in order. */
const wrapLogical = (doc, text, maxWidth) => {
  const lines = []
  let current = ''
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word
    if (current && widthOf(doc, candidate) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

const drawLine = (doc, line) => {
  const startX = doc.x
  const pieces = layoutLine(line)
  pieces.forEach((piece, index) => {
    doc.font(fontFor(piece)).text(piece.text, { continued: index < pieces.length - 1, lineBreak: false })
  })
  doc.x = startX
  // Unwrapped text leaves the cursor on its line.
  doc.y += doc.currentLineHeight(true)
}

/** Writes one logical line. Pure Latin keeps the document's default font, so existing PDFs look the same. */
export const writeText = (doc, text) => {
  const value = String(text ?? '')
  if (!hasArabic(value) || !doc.textFonts?.['text-arabic'] || !doc.textFonts?.['text-latin']) {
    // Without the Arabic font a Latin-only encoder would print garbage, so mark the gap instead.
    const safe = hasArabic(value) ? value.replace(new RegExp(ARABIC_CHARS, 'g'), '?') : value
    doc.font('Helvetica').text(safe)
    return
  }

  const maxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  wrapLogical(doc, value, maxWidth).forEach((line) => drawLine(doc, line))
  doc.font('Helvetica')
}
