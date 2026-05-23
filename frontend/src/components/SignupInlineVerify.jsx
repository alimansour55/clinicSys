import React, { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'react-toastify'
import OtpCodeInput from './OtpCodeInput'
import { useLanguage } from '../i18n'

const SignupInlineVerify = ({
  label,
  verified,
  onVerified,
  canSend,
  onSendCode,
  onConfirmCode,
  smsDevHint = false
}) => {
  const { t } = useLanguage()
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const verifiedMessage =
    label === 'Email' ? t('Email verified') : label === 'Phone' ? t('Phone verified') : `${t(label)} verified`

  const codeSentMessage =
    label === 'Email'
      ? t('Enter the 6-digit code sent to your email.')
      : label === 'Phone'
        ? t('Enter the 6-digit code sent to your phone.')
        : `Enter the 6-digit code sent to your ${label.toLowerCase()}.`

  const handleSend = async () => {
    if (!canSend()) return
    setSending(true)
    try {
      const data = await onSendCode()
      if (data.success) {
        setCodeSent(true)
        setCode('')
        if (data.alreadyVerified) {
          onVerified(data.verificationToken, data.message)
        } else {
          toast.success(data.message)
          if (data.smsDevMode) {
            toast.info('SMS dev mode: check the backend terminal for your code')
          }
        }
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSending(false)
    }
  }

  const handleConfirm = async () => {
    if (code.length !== 6) {
      toast.error(t('Enter the 6-digit code'))
      return
    }
    setConfirming(true)
    try {
      const data = await onConfirmCode(code)
      if (data.success) {
        onVerified(data.verificationToken, data.message)
        toast.success(data.message || verifiedMessage)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setConfirming(false)
    }
  }

  if (verified) {
    return (
      <div className='mt-2 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800'>
        <CheckCircle2 className='h-4 w-4 shrink-0' />
        <span>{verifiedMessage}</span>
      </div>
    )
  }

  return (
    <div className='mt-2 space-y-2'>
      {!codeSent ? (
        <button
          type='button'
          onClick={handleSend}
          disabled={sending}
          className='text-xs font-semibold text-primary underline hover:text-primary/80 disabled:opacity-50'
        >
          {sending ? t('Sending code…') : t('Verify now')}
        </button>
      ) : (
        <div className='rounded-md border border-gray-200 bg-gray-50 p-3'>
          <p className='mb-2 text-xs text-gray-600'>
            {codeSentMessage}
            {smsDevHint && ' (or check backend terminal in dev mode)'}
          </p>
          <OtpCodeInput onChange={setCode} disabled={confirming} />
          <div className='mt-2 flex flex-wrap gap-2'>
            <button
              type='button'
              onClick={handleConfirm}
              disabled={confirming}
              className='rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:bg-gray-400'
            >
              {confirming ? t('Checking…') : t('Confirm code')}
            </button>
            <button
              type='button'
              onClick={handleSend}
              disabled={sending}
              className='rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white'
            >
              {t('Resend')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SignupInlineVerify
