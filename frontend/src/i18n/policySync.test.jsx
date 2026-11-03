import React, { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, screen } from '@testing-library/react'
import { renderWithLanguage } from '../test/renderWithLanguage'
import { LanguagePolicySync, useLanguage } from '../i18n'

/* "Maximum update depth exceeded" is reported through console.error before React gives up. */
const watchConsole = () => vi.spyOn(console, 'error').mockImplementation(() => {})

const loopErrors = (spy) =>
  spy.mock.calls.filter((args) => args.some((arg) => /Maximum update depth/i.test(String(arg?.message ?? arg))))

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('language policy sync', () => {
  it('keeps setLanguagePolicy stable across renders and policy changes', () => {
    const seen = new Set()
    const Probe = () => {
      const { setLanguagePolicy } = useLanguage()
      seen.add(setLanguagePolicy)
      return (
        <button type='button' onClick={() => setLanguagePolicy({ en: true, ar: false })}>
          apply
        </button>
      )
    }
    renderWithLanguage(<Probe />)
    act(() => screen.getByRole('button').click())
    act(() => screen.getByRole('button').click())
    expect(seen.size).toBe(1)
  })

  it('does not loop when an effect applies the policy on every setter change', () => {
    const spy = watchConsole()
    const counts = { effects: 0 }
    /* The unguarded pattern that used to loop: it re-runs whenever the setter's identity changes. */
    const NaiveSync = ({ policy }) => {
      const { setLanguagePolicy } = useLanguage()
      useEffect(() => {
        counts.effects += 1
        /* Cap it, so a regression fails the assertion below instead of hanging the run. */
        if (counts.effects > 20) return
        setLanguagePolicy({ en: policy.en, ar: policy.ar })
      }, [policy.en, policy.ar, setLanguagePolicy])
      return null
    }
    renderWithLanguage(<NaiveSync policy={{ en: true, ar: false }} />)
    expect(loopErrors(spy)).toHaveLength(0)
    expect(counts.effects).toBeLessThanOrEqual(2)
  })

  it('applies a new policy object on every parent render without looping', () => {
    const spy = watchConsole()
    const counts = { renders: 0 }
    const Parent = () => {
      const [tick, setTick] = useState(0)
      // eslint-disable-next-line react-hooks/immutability -- counting renders is the point of this test
      counts.renders += 1
      if (counts.renders > 50) throw new Error('render loop')
      const { language, allowedLanguages } = useLanguage()
      return (
        <>
          {/* A fresh object each render, like the app's memo on siteSettings. */}
          <LanguagePolicySync policy={{ en: true, ar: tick > 0 }} />
          <p data-testid='state'>{`${language}:${allowedLanguages.join(',')}`}</p>
          <button type='button' onClick={() => setTick((n) => n + 1)}>
            rerender
          </button>
        </>
      )
    }
    renderWithLanguage(<Parent />)
    expect(screen.getByTestId('state')).toHaveTextContent('en:en')
    act(() => screen.getByRole('button').click())
    expect(screen.getByTestId('state')).toHaveTextContent('en:en,ar')
    act(() => screen.getByRole('button').click())
    expect(loopErrors(spy)).toHaveLength(0)
    expect(counts.renders).toBeLessThan(15)
  })
})
