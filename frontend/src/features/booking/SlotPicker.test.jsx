import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithLanguage } from '../../test/renderWithLanguage'
import SlotPicker from './SlotPicker'

const day = (slotDate, dateKey, slots) => ({
  slotDate,
  dateKey,
  weekday: 3,
  availableCount: slots.filter((slot) => slot.available).length,
  takenCount: slots.filter((slot) => slot.status === 'taken').length,
  slots
})

const slot = (time, minutes, available = true, status = available ? 'available' : 'taken') => ({ time, minutes, startsAt: 1_900_000_000_000 + minutes * 60000, available, status })

const availability = (days, nextAvailable = null) => ({ timeZone: 'Africa/Cairo', days, nextAvailable, needsBranchChoice: false })

const renderPicker = (props) => {
  const onSelect = vi.fn()
  renderWithLanguage(<SlotPicker loading={false} failed={false} selection={null} onSelect={onSelect} headingId='h' {...props} />)
  return { onSelect }
}

describe('SlotPicker', () => {
  afterEach(cleanup)

  it('offers the soonest time and selects it in one tap', () => {
    const open = slot('09:30 AM', 570)
    const { onSelect } = renderPicker({
      availability: availability([day('16_1_2030', '2030-01-16', [open])], { slotDate: '16_1_2030', slotTime: '09:30 AM', startsAt: open.startsAt })
    })
    fireEvent.click(screen.getByRole('button', { name: /Soonest open time/ }))
    expect(onSelect).toHaveBeenCalledWith({ slotDate: '16_1_2030', slotTime: '09:30 AM', startsAt: open.startsAt })
  })

  it('shows taken times as disabled and open times as selectable', () => {
    const { onSelect } = renderPicker({
      availability: availability([day('16_1_2030', '2030-01-16', [slot('09:00 AM', 540, false), slot('09:30 AM', 570)])])
    })
    expect(screen.getByRole('button', { name: '9:00 AM' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '9:30 AM' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('offers the waitlist on a full day, and never on a day with open times', () => {
    const onJoinWaitlist = vi.fn()
    renderPicker({
      availability: availability([day('16_1_2030', '2030-01-16', [slot('09:00 AM', 540, false)])]),
      onJoinWaitlist
    })
    fireEvent.click(screen.getByRole('button', { name: 'Wait for this day' }))
    expect(onJoinWaitlist).toHaveBeenCalledWith('16_1_2030', 0)
  })

  it('does not offer the waitlist while times are open', () => {
    renderPicker({
      availability: availability([day('16_1_2030', '2030-01-16', [slot('09:00 AM', 540)])]),
      onJoinWaitlist: vi.fn()
    })
    expect(screen.queryByRole('button', { name: 'Wait for this day' })).toBeNull()
  })

  it('opens a slot reserved for this patient even though everyone else sees it taken', () => {
    const { onSelect } = renderPicker({
      availability: availability([day('16_1_2030', '2030-01-16', [slot('09:00 AM', 540, false)])]),
      reservedSlot: { slotDate: '16_1_2030', slotTime: '09:00 AM' }
    })
    const button = screen.getByRole('button', { name: '9:00 AM' })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Reserved for you')).toBeTruthy()
  })

  it('asks for a branch before showing times', () => {
    renderPicker({ availability: { ...availability([]), needsBranchChoice: true } })
    expect(screen.getByText('Choose a branch above to see its times.')).toBeTruthy()
  })

  it('offers a retry when loading fails', () => {
    const onRetry = vi.fn()
    renderPicker({ availability: null, failed: true, onRetry })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()
  })
})
