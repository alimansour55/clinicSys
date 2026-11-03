import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithLanguage } from '../test/renderWithLanguage'
import { LanguageToggle, useLanguage } from '../i18n'

const Probe = () => {
  const { t, language, isRtl, setLanguagePolicy } = useLanguage()
  return (
    <>
      <p data-testid='text'>{t('Close')}</p>
      <p data-testid='state'>{`${language}:${isRtl}`}</p>
      <button type='button' onClick={() => setLanguagePolicy({ en: true, ar: false })}>
        English only
      </button>
      <button type='button' onClick={() => setLanguagePolicy({ en: true, ar: true })}>
        Both
      </button>
    </>
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('dir')
  document.documentElement.removeAttribute('lang')
})

afterEach(cleanup)

describe('language switching', () => {
  it('updates text, lang and dir at once, without a reload', () => {
    renderWithLanguage(
      <>
        <LanguageToggle compact />
        <Probe />
      </>,
    )
    expect(screen.getByTestId('state')).toHaveTextContent('en:false')
    expect(document.documentElement.dir).toBe('ltr')

    fireEvent.click(screen.getByRole('button', { name: /العربية/ }))

    expect(screen.getByTestId('text')).toHaveTextContent('إغلاق')
    expect(screen.getByTestId('state')).toHaveTextContent('ar:true')
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.body.dir).toBe('rtl')
  })

  it('remembers the choice across a reload', () => {
    localStorage.setItem('clinicSysLanguage', 'ar')
    renderWithLanguage(<Probe />)
    expect(screen.getByTestId('state')).toHaveTextContent('ar:true')
  })

  it('returns to the chosen language after a role policy forced another', () => {
    renderWithLanguage(
      <>
        <LanguageToggle compact />
        <Probe />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: /العربية/ }))
    fireEvent.click(screen.getByText('English only'))
    expect(screen.getByTestId('state')).toHaveTextContent('en:false')
    act(() => {
      fireEvent.click(screen.getByText('Both'))
    })
    expect(screen.getByTestId('state')).toHaveTextContent('ar:true')
  })
})

describe('LanguageToggle', () => {
  it('names the language it switches to, in that language', () => {
    renderWithLanguage(<LanguageToggle compact />)
    const button = screen.getByRole('button', { name: /العربية/ })
    expect(button).toHaveAttribute('lang', 'ar')
  })

  it('shows both languages with the current one pressed in the full form', () => {
    renderWithLanguage(<LanguageToggle />)
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'العربية' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'العربية' }))
    expect(screen.getByRole('button', { name: 'العربية' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('hides itself when only one language is allowed', () => {
    const Restricted = () => {
      const { setLanguagePolicy } = useLanguage()
      return (
        <button type='button' onClick={() => setLanguagePolicy({ en: true, ar: false })}>
          Restrict
        </button>
      )
    }
    renderWithLanguage(
      <>
        <LanguageToggle />
        <Restricted />
      </>,
    )
    fireEvent.click(screen.getByText('Restrict'))
    expect(screen.queryByRole('group', { name: 'Language' })).not.toBeInTheDocument()
  })
})
