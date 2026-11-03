import React from 'react'
import { EGYPT_DIAL_CODE, parseEgyptLocalDigits } from '../utils/egyptPhone'
import { useLanguage } from '../i18n'

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
  const { t } = useLanguage()
  const handleChange = (e) => {
    onChange(parseEgyptLocalDigits(e.target.value))
  }

  // Phone numbers read left to right in every language.
  return (
    <div dir='ltr' className={`flex overflow-hidden rounded-control border border-field bg-surface transition focus-within:border-primary focus-within:outline-2 focus-within:outline-primary/30 ${className}`} data-input-field>
      <div
        className='flex shrink-0 items-center gap-2 border-e border-line bg-surface-sunken px-3 text-body-sm text-ink-2'
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
        title={t('Egyptian mobile: 10 digits starting with 10, 11, 12 or 15')}
        className={`min-h-11 min-w-0 flex-1 border-0 bg-transparent px-3 text-body-sm text-ink outline-none tabular-nums placeholder:text-ink-3 focus:ring-0 ${inputClassName}`}
        aria-label={t('Egyptian mobile number without country code')}
      />
    </div>
  )
}

export default EgyptPhoneInput
