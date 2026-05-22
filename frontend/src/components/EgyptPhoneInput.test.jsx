import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import EgyptPhoneInput from './EgyptPhoneInput'
import { EGYPT_DIAL_CODE } from '../utils/egyptPhone'

describe('EgyptPhoneInput', () => {
  it('renders Egypt dial code and phone field', () => {
    const { container } = render(<EgyptPhoneInput value='' onChange={() => {}} />)
    const scope = within(container)
    expect(scope.getByText(EGYPT_DIAL_CODE)).toBeInTheDocument()
    expect(scope.getByRole('textbox')).toBeInTheDocument()
  })

  it('parses input and calls onChange with local digits only', () => {
    const onChange = vi.fn()
    const { container } = render(<EgyptPhoneInput value='' onChange={onChange} id='phone-test' />)
    const input = within(container).getByRole('textbox')
    fireEvent.change(input, { target: { value: '+20 010 1234 5678' } })
    expect(onChange).toHaveBeenCalledWith('1012345678')
  })

  it('respects disabled and required attributes', () => {
    const { container } = render(
      <EgyptPhoneInput value='1012345678' onChange={() => {}} disabled required />
    )
    const input = within(container).getByRole('textbox')
    expect(input).toBeDisabled()
    expect(input).toBeRequired()
    expect(input).toHaveValue('1012345678')
  })
})
