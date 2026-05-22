import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  formatRatingDate,
  RatingBadge,
  StarRow,
  RatingsList,
} from './DoctorRating'
import { renderWithLanguage } from '../test/renderWithLanguage'

describe('DoctorRating exports', () => {
  it('formatRatingDate returns empty for missing value', () => {
    expect(formatRatingDate(null)).toBe('')
  })

  it('formatRatingDate localizes for Arabic', () => {
    const out = formatRatingDate('2026-01-15T12:00:00Z', 'ar')
    expect(out.length).toBeGreaterThan(0)
  })

  it('RatingBadge shows New when no ratings', () => {
    renderWithLanguage(<RatingBadge summary={{ averageRating: 0, ratingCount: 0 }} />)
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('RatingBadge shows average and count', () => {
    renderWithLanguage(<RatingBadge summary={{ averageRating: 4.5, ratingCount: 3 }} />)
    expect(screen.getByText(/4\.5 \(3\)/)).toBeInTheDocument()
  })

  it('StarRow renders five stars', () => {
    const { container } = render(<StarRow value={3} />)
    expect(container.querySelectorAll('svg')).toHaveLength(5)
  })

  it('RatingsList shows empty state', () => {
    renderWithLanguage(<RatingsList ratings={[]} />)
    expect(screen.getByText(/no ratings yet/i)).toBeInTheDocument()
  })

  it('RatingsList renders ratings and delete action', () => {
    const onDelete = vi.fn()
    renderWithLanguage(
      <RatingsList
        ratings={[
          {
            _id: 'r1',
            rating: 5,
            patientName: 'Ali',
            createdAt: '2026-05-01T10:00:00Z',
            comment: 'Great',
          },
        ]}
        canDelete
        onDelete={onDelete}
      />
    )
    expect(screen.getByText('Great')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledWith('r1')
  })
})
