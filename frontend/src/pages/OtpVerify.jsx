import { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'
import { Button, notify } from '../components/ui'
import OtpCodeInput from '../components/OtpCodeInput'
import { AuthShell, FormError, ResendCountdown } from '../components/account/accountUi'
import { NETWORK_ERROR, useServerText } from '../components/account/accountApi'

const OtpVerify = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { backendUrl } = useContext(AppContext)
  const { t, localizeDigits } = useLanguage()
  const say = useServerText()

  const email = location.state?.email || ''
  const minutes = location.state?.otpExpiresInMinutes || 10
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [restart, setRestart] = useState(false)
  const [codeKey, setCodeKey] = useState(0)

  useEffect(() => {
    if (!email) navigate('/email-verify', { replace: true })
  }, [email, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (code.length !== 6) {
      setError(t('Enter the 6-digit code'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/verify-reset-otp`, { email, otp: code })
      if (data.success) {
        navigate('/reset-password', { state: { email, otp: code }, replace: true })
      } else {
        setError(say(data.message))
        setRestart(Boolean(data.restart))
        setCode('')
        setCodeKey((key) => key + 1)
      }
    } catch {
      setError(say(NETWORK_ERROR))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/send-reset-otp`, { email })
      if (data.success) {
        notify.success(say(data.message))
        setError('')
        setRestart(false)
        setCode('')
        setCodeKey((key) => key + 1)
      } else {
        setError(say(data.message))
      }
    } catch {
      setError(say(NETWORK_ERROR))
    }
  }

  return (
    <AuthShell
      title={t('Check your email')}
      description={localizeDigits(String(t('If this email has an account, a 6-digit code is on its way. It works for {{n}} minutes. Check your spam folder too.')).replace('{{n}}', minutes))}
      onBack={() => navigate('/email-verify')}
    >
      <form onSubmit={handleSubmit} className='space-y-4'>
        <p dir='ltr' className='text-center text-body-sm font-medium break-all text-brand'>{email}</p>
        <OtpCodeInput key={codeKey} onChange={setCode} disabled={loading} autoFocus />
        <FormError>{error}</FormError>
        {!restart && <Button type='submit' fullWidth loading={loading}>{t('Continue')}</Button>}
        <div className='text-center'>
          <ResendCountdown seconds={location.state?.resendAfterSeconds || 60} onResend={handleResend} />
        </div>
      </form>
    </AuthShell>
  )
}

export default OtpVerify
