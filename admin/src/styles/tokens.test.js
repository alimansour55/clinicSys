import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

const readColors = (block) =>
  Object.fromEntries([...block.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6});/g)].map(([, name, hex]) => [name, hex]))

const light = readColors(css.slice(css.indexOf('@theme'), css.indexOf(':root {')))
const dark = { ...light, ...readColors(css.slice(css.indexOf(":root[data-theme='dark']"))) }

const luminance = (hex) => {
  const channel = (start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const SURFACES = ['canvas', 'surface', 'surface-raised', 'surface-sunken']

const TEXT_PAIRS = [
  ...['ink', 'ink-2', 'ink-3', 'brand'].flatMap((text) => SURFACES.map((bg) => [text, bg])),
  ['on-primary', 'primary'],
  ['on-primary', 'primary-dark'],
  ['brand', 'primary-soft'],
  ['ink', 'primary-soft'],
  ['on-accent', 'accent'],
  ['accent-ink', 'accent-soft'],
  ...['success', 'warning', 'danger', 'info'].flatMap((status) => [
    ['on-status', status],
    [`${status}-ink`, `${status}-soft`],
    [`${status}-ink`, 'surface'],
  ]),
]

/* WCAG 1.4.11: control borders and focus indicators need 3:1 against what is next to them */
const NON_TEXT_PAIRS = [
  ['field', 'surface'],
  ['field', 'canvas'],
  ['focus', 'canvas'],
  ['focus', 'surface'],
]

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_name, colors) => {
  it.each(TEXT_PAIRS)('%s on %s meets AA text (4.5:1)', (text, bg) => {
    expect(contrast(colors[text], colors[bg])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(NON_TEXT_PAIRS)('%s against %s meets AA non-text (3:1)', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(3)
  })
})

describe('reduced motion', () => {
  it('zeroes every motion duration', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(block).toMatch(/--duration-fast: 0ms/)
    expect(block).toMatch(/--duration-base: 0ms/)
    expect(block).toMatch(/--duration-slow: 0ms/)
  })
})
