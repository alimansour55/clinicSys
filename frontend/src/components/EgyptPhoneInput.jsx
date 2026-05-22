import React from 'react'
import { EGYPT_DIAL_CODE, parseEgyptLocalDigits } from '../utils/egyptPhone'

const EgyptFlag = () => (
  <svg
    className='h-4 w-5 shrink-0 rounded-sm border border-black/10'
    viewBox='0 0 24 16'
    aria-hidden='true'
  >
    <rect width='24' height='16' fill='#ce1126' />
    <rect y='5.33' width='24' height='5.34' fill='#fff' />
    <rect y='10.67' width='24' height='5.33' fill='#000' />
  </svg>
)

const EgyptPhoneInput = ({
  value,
  onChange,
  disabled = false,
  required = false,
  id = 'egypt-phone',
  className = '',
  inputClassName = '',
}) => {
  const handleChange = (e) => {
    onChange(parseEgyptLocalDigits(e.target.value))
  }

  return (
    <div className={`flex overflow-hidden rounded-md border-2 border-gray-300 bg-white transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${className}`}>
      <div
        className='flex shrink-0 items-center gap-2 border-r border-gray-200 bg-gray-50 px-3 text-sm text-gray-700'
        aria-hidden='true'
      >
        <EgyptFlag />
        <span className='font-semibold tabular-nums'>{EGYPT_DIAL_CODE}</span>
      </div>
      <input
        id={id}
        type='tel'
        inputMode='numeric'
        autoComplete='tel-national'
        disabled={disabled}
        required={required}
        value={value}
        onChange={handleChange}
        maxLength={10}
        placeholder='10 1234 5678'
        pattern='1[0125][0-9]{8}'
        title='Egyptian mobile: 10 digits starting with 10, 11, 12, or 15'
        className={`min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-0 sm:py-3 sm:text-base tabular-nums ${inputClassName}`}
        aria-label='Egyptian mobile number without country code'
      />
    </div>
  )
}

export default EgyptPhoneInput
