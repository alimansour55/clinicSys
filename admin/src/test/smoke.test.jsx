import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DEFAULT_APP_DISPLAY_NAME } from '../utils/appDisplayName.js'

describe('vitest + React Testing Library', () => {
  it('renders a React node', () => {
    render(<p>{DEFAULT_APP_DISPLAY_NAME}</p>)
    expect(screen.getByText(DEFAULT_APP_DISPLAY_NAME)).toBeInTheDocument()
  })
})
