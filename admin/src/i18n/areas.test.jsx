import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderWithLanguage } from '../test/renderWithLanguage'
import { useLanguage } from '../i18n'
import { areas } from './loadAreas'
import { mergeAreas } from './mergeAreas'

const Show = ({ text }) => {
  const { t } = useLanguage()
  return <p>{t(text)}</p>
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('mergeAreas', () => {
  it('merges every area, whatever order the files arrive in', () => {
    const merged = mergeAreas({
      './areas/b.js': { default: { ar: { Two: '٢' } } },
      './areas/a.js': { default: { ar: { One: '١' }, en: { 'a.key': 'One' } } },
    })
    expect(merged.ar).toEqual({ One: '١', Two: '٢' })
    expect(merged.en).toEqual({ 'a.key': 'One' })
    expect(merged.conflicts).toEqual([])
  })

  it('reports two areas giving one key different text', () => {
    const merged = mergeAreas({
      './areas/a.js': { default: { ar: { Book: 'احجز' } } },
      './areas/b.js': { default: { ar: { Book: 'كتاب' } } },
    })
    expect(merged.conflicts).toEqual([{ language: 'ar', key: 'Book', files: ['./areas/a.js', './areas/b.js'] }])
  })

  it('allows two areas to repeat the same text', () => {
    const merged = mergeAreas({
      './areas/a.js': { default: { ar: { Book: 'احجز' } } },
      './areas/b.js': { default: { ar: { Book: 'احجز' } } },
    })
    expect(merged.conflicts).toEqual([])
  })

  it('tolerates an empty area file', () => {
    expect(mergeAreas({ './areas/a.js': { default: { ar: {} } }, './areas/b.js': {} }).ar).toEqual({})
  })
})

describe('area files in this app', () => {
  it('do not disagree about any key', () => {
    expect(areas.conflicts).toEqual([])
  })
})

describe('t() with area strings', () => {
  it('translates a key that only exists in an area file', () => {
    localStorage.setItem('clinicSysLanguage', 'ar')
    renderWithLanguage(<Show text='Dark mode' />)
    expect(screen.getByText('الوضع الداكن')).toBeInTheDocument()
  })

  it('keeps existing keys from the base dictionary working', () => {
    localStorage.setItem('clinicSysLanguage', 'ar')
    renderWithLanguage(<Show text='Close' />)
    expect(screen.getByText('إغلاق')).toBeInTheDocument()
  })

  it('shows an area key as itself in English', () => {
    renderWithLanguage(<Show text='Dark mode' />)
    expect(screen.getByText('Dark mode')).toBeInTheDocument()
  })

  it('turns a stored Arabic string back into English', () => {
    renderWithLanguage(<Show text='الوضع الداكن' />)
    expect(screen.getByText('Dark mode')).toBeInTheDocument()
  })
})
