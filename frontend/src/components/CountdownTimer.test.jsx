import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithLanguage } from '../test/renderWithLanguage'
import CountdownTimer from './CountdownTimer'

describe('CountdownTimer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('offers resend when the code timer ends, then restarts', () => {
    const onResend = vi.fn()
    renderWithLanguage(<CountdownTimer duration={2} onResend={onResend} />)
    expect(screen.getByText('0:02')).toBeTruthy()

    act(() => vi.advanceTimersByTime(3000))
    fireEvent.click(screen.getByRole('button', { name: 'Resend OTP' }))
    expect(onResend).toHaveBeenCalledTimes(1)
    expect(screen.getByText('0:02')).toBeTruthy()
  })

  it('counts to a fixed moment even when ticks are delayed, and fires once', () => {
    const onExpire = vi.fn()
    renderWithLanguage(<CountdownTimer expiresAt={Date.now() + 90_000} onExpire={onExpire} />)
    expect(screen.getByRole('timer').textContent).toBe('1:30')

    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('timer').textContent).toBe('0:30')

    act(() => vi.advanceTimersByTime(40_000))
    expect(screen.getByRole('timer').textContent).toBe('0:00')
    expect(onExpire).toHaveBeenCalledTimes(1)
  })
})
