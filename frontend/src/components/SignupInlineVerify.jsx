import React, { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'react-toastify'
import OtpCodeInput from './OtpCodeInput'
import { useServerText } from './account/accountApi'
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
  const { t, localizeDigits } = useLanguage()
  const say = useServerText()
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const id = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

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
        setCooldown(Number(data.resendAfterSeconds) || 60)
        toast.success(say(data.message))
        if (data.smsDevMode) {
          toast.info(t('SMS dev mode: check the backend terminal for your code'))
        }
      } else {
        toast.error(say(data.message))
      }
    } catch {
      toast.error(t('We could not reach the server. Please check your connection and try again.'))
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
        toast.success(data.message ? say(data.message) : verifiedMessage)
      } else {
        toast.error(say(data.message))
      }
    } catch {
      toast.error(t('We could not reach the server. Please check your connection and try again.'))
    } finally {
      setConfirming(false)
    }
  }

  if (verified) {
    return (
      <div className='mt-2 flex items-center gap-2 rounded-control bg-success-soft px-3 py-2 text-caption text-success-ink'>
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
          className='min-h-9 text-body-sm font-semibold text-brand underline disabled:opacity-50'
        >
          {sending ? t('Sending code…') : t('Verify now')}
        </button>
      ) : (
        <div className='rounded-control bg-surface-sunken p-3'>
          <p className='mb-2 text-caption text-ink-2'>
            {codeSentMessage}
            {smsDevHint && ' (or check backend terminal in dev mode)'}
          </p>
          <OtpCodeInput onChange={setCode} disabled={confirming} />
          <div className='mt-3 flex flex-wrap items-center gap-2'>
            <button
              type='button'
              onClick={handleConfirm}
              disabled={confirming}
              className='min-h-9 rounded-control bg-primary px-3 text-body-sm font-semibold text-on-primary disabled:opacity-60'
            >
              {confirming ? t('Checking…') : t('Confirm code')}
            </button>
            <button
              type='button'
              onClick={handleSend}
              disabled={sending || cooldown > 0}
              className='min-h-9 rounded-control border border-line-strong px-3 text-body-sm font-medium text-ink disabled:opacity-60'
            >
              {t('Resend')}{cooldown > 0 ? ` (${localizeDigits(String(cooldown))})` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SignupInlineVerify
