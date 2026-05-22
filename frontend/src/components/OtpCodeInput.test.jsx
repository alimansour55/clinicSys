import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import OtpCodeInput from './OtpCodeInput'

describe('OtpCodeInput', () => {
  it('renders six digit inputs', () => {
    const { container } = render(<OtpCodeInput onChange={() => {}} />)
    expect(container.querySelectorAll('input')).toHaveLength(6)
  })

  it('notifies onChange as digits are entered', () => {
    const onChange = vi.fn()
    const { container } = render(<OtpCodeInput onChange={onChange} />)
    const inputs = container.querySelectorAll('input')
    fireEvent.input(inputs[0], { target: { value: '1' } })
    expect(onChange).toHaveBeenLastCalledWith('1')
    fireEvent.input(inputs[1], { target: { value: '2' } })
    expect(onChange).toHaveBeenLastCalledWith('12')
  })

  it('fills all boxes on paste', () => {
    const onChange = vi.fn()
    const { container } = render(<OtpCodeInput onChange={onChange} />)
    fireEvent.paste(container.firstChild, {
      clipboardData: { getData: () => '123456' },
    })
    expect(onChange).toHaveBeenCalledWith('123456')
    const inputs = container.querySelectorAll('input')
    expect(inputs[0].value).toBe('1')
    expect(inputs[5].value).toBe('6')
  })

  it('disables all inputs when disabled', () => {
    const { container } = render(<OtpCodeInput onChange={() => {}} disabled />)
    container.querySelectorAll('input').forEach((input) => {
      expect(input).toBeDisabled()
    })
  })
})
