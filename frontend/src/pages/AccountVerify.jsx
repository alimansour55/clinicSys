import React, { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'
import { Button, notify } from '../components/ui'
import OtpCodeInput from '../components/OtpCodeInput'
import { AuthShell, FormError, ResendCountdown } from '../components/account/accountUi'
import { NETWORK_ERROR, useServerText } from '../components/account/accountApi'

const AccountVerify = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { backendUrl, setToken } = useContext(AppContext)
  const { t, localizeDigits } = useLanguage()
  const say = useServerText()

  const verificationToken = location.state?.verificationToken || ''
  const [status, setStatus] = useState({ email: location.state?.email || '', otpExpiresInMinutes: 10 })
  const [code, setCode] = useState('')
  const [codeKey, setCodeKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const backToLogin = (message) => {
    if (message) notify.info(say(message))
    navigate('/login?mode=login', { replace: true })
  }

  useEffect(() => {
    if (!verificationToken) {
      backToLogin()
      return
    }
    axios.post(`${backendUrl}/api/user/verify-account/status`, { verificationToken })
      .then(({ data }) => {
        if (data.success) setStatus(data)
        else if (data.sessionExpired) backToLogin(data.message)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for this verification session
  }, [verificationToken, backendUrl])

  const finish = (data) => {
    if (data.token) {
      localStorage.setItem('token', data.token)
      setToken(data.token)
      notify.success(t('Account verified! Welcome.'))
      navigate('/', { replace: true })
    } else {
      backToLogin(data.message)
    }
  }

  const verifyEmail = async (event) => {
    event.preventDefault()
    if (code.length !== 6) return setError(t('Enter the 6-digit code'))
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/verify-account/verify-email`, { verificationToken, code })
      if (data.success) {
        finish(data)
      } else if (data.sessionExpired) {
        backToLogin(data.message)
      } else {
        setError(say(data.message))
        setCode('')
        setCodeKey((key) => key + 1)
      }
    } catch {
      setError(say(NETWORK_ERROR))
    } finally {
      setLoading(false)
    }
  }

  const resendCode = async () => {
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/verify-account/resend`, { verificationToken, channel: 'email' })
      if (data.signInRequired || data.sessionExpired) return backToLogin(data.message)
      if (data.success) {
        notify.success(say(data.message))
        setError('')
      } else {
        setError(say(data.message))
      }
    } catch {
      setError(say(NETWORK_ERROR))
    }
  }

  return (
    <AuthShell
      title={t('Verify your account')}
      description={localizeDigits(String(t('Enter the code we sent to your email. It expires in {{n}} minutes.')).replace('{{n}}', status.otpExpiresInMinutes))}
      onBack={() => backToLogin()}
      backLabel={t('Back to login')}
    >
      <form onSubmit={verifyEmail} className='space-y-4'>
        {status.email && <p dir='ltr' className='text-center text-body-sm font-medium text-brand'>{status.email}</p>}
        <OtpCodeInput key={codeKey} onChange={setCode} disabled={loading} autoFocus />
        <FormError>{error}</FormError>
        <Button type='submit' fullWidth loading={loading}>{t('Verify email')}</Button>
        <div className='text-center'>
          <ResendCountdown seconds={60} onResend={resendCode} />
        </div>
      </form>
    </AuthShell>
  )
}

export default AccountVerify
