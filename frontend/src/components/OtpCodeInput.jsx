import React, { useRef } from 'react'

const OtpCodeInput = ({ onChange, disabled = false }) => {
  const inputRefs = useRef([])

  const readOtp = () => inputRefs.current.map((input) => input?.value || '').join('')

  const notifyChange = () => {
    onChange?.(readOtp())
  }

  const handleInput = (e, index) => {
    const value = e.target.value.replace(/\D/g, '').slice(-1)
    e.target.value = value
    if (value && index < 5) {
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
    paste.split('').forEach((char, i) => {
      if (inputRefs.current[i]) inputRefs.current[i].value = char
    })
    inputRefs.current[Math.min(5, paste.length - 1)]?.focus()
    notifyChange()
  }

  return (
    <div className='flex justify-between gap-1.5 sm:gap-2' onPaste={handlePaste}>
      {[...Array(6)].map((_, i) => (
        <input
          key={i}
          type='text'
          inputMode='numeric'
          pattern='[0-9]*'
          maxLength={1}
          disabled={disabled}
          ref={(el) => {
            inputRefs.current[i] = el
          }}
          onInput={(e) => handleInput(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className='h-10 w-10 rounded-md border-2 border-gray-300 text-center text-lg font-semibold transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 sm:h-12 sm:w-12 sm:text-xl'
        />
      ))}
    </div>
  )
}

export default OtpCodeInput
