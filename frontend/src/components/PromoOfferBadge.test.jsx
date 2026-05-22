import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PromoOfferBadge from './PromoOfferBadge'
import { renderWithLanguage } from '../test/renderWithLanguage'

const promoDoctor = {
  promoCode: { active: true, code: 'SAVE', discountType: 'percentage', discountValue: 15 },
}

describe('PromoOfferBadge', () => {
  it('renders nothing when doctor has no active promo', () => {
    const { container } = renderWithLanguage(<PromoOfferBadge doctor={{}} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows promo label when offer is active', () => {
    renderWithLanguage(<PromoOfferBadge doctor={promoDoctor} currencySymbol='EGP ' />)
    expect(screen.getByText(/off/i)).toBeInTheDocument()
  })
})
