import React, { useRef } from 'react'
import { useLanguage } from '../i18n'

const OtpCodeInput = ({ onChange, disabled = false, autoFocus = false }) => {
  const { t, localizeDigits } = useLanguage()
  const inputRefs = useRef([])

  const readOtp = () => inputRefs.current.map((input) => input?.value || '').join('')

  const notifyChange = () => {
    onChange?.(readOtp())
  }

  const fill = (digits, from = 0) => {
    digits.split('').forEach((char, i) => {
      if (inputRefs.current[from + i]) inputRefs.current[from + i].value = char
    })
    inputRefs.current[Math.min(5, from + digits.length - 1)]?.focus()
  }

  const handleInput = (e, index) => {
    const digits = e.target.value.replace(/\D/g, '')
    // Phones autofill the whole code into one box.
    if (digits.length > 1) {
      fill(digits.slice(0, 6 - index), index)
      notifyChange()
      return
    }
    e.target.value = digits
    if (digits && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
    notifyChange()
  }

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    fill(paste)
    notifyChange()
  }

  // Codes read left to right in every language.
  return (
    <div dir='ltr' className='flex justify-between gap-1.5 sm:gap-2' onPaste={handlePaste} data-input-field>
      {[...Array(6)].map((_, i) => (
        <input
          key={i}
          type='text'
          inputMode='numeric'
          pattern='[0-9]*'
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          aria-label={localizeDigits(String(t('Digit {{n}} of 6')).replace('{{n}}', i + 1))}
          ref={(el) => {
            inputRefs.current[i] = el
          }}
          onInput={(e) => handleInput(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className='h-12 w-full min-w-0 max-w-12 rounded-control border border-field bg-surface text-center text-title font-semibold text-ink transition focus:border-primary focus:outline-2 focus:outline-primary/30 disabled:opacity-60'
        />
      ))}
    </div>
  )
}

export default OtpCodeInput
