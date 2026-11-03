import { useContext, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'
import { Button, Field, Input } from '../components/ui'
import { AuthShell, FormError } from '../components/account/accountUi'
import { NETWORK_ERROR, useServerText } from '../components/account/accountApi'

const EmailVerify = () => {
  const navigate = useNavigate()
  const { backendUrl } = useContext(AppContext)
  const { t } = useLanguage()
  const say = useServerText()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/send-reset-otp`, { email })
      if (data.success) {
        navigate('/otp-verify', { state: { email, sentMessage: data.message, resendAfterSeconds: data.resendAfterSeconds, otpExpiresInMinutes: data.otpExpiresInMinutes } })
      } else {
        setError(say(data.message))
      }
    } catch {
      setError(say(NETWORK_ERROR))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={t('Reset your password')}
      description={t('Enter the email on your account and we will send you a code.')}
      onBack={() => navigate('/login')}
      backLabel={t('Back to login')}
    >
      <form onSubmit={handleSubmit} className='space-y-4'>
        <Field label={t('Email')} required>
          <Input type='email' dir='ltr' value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('Enter your email')} autoComplete='email' />
        </Field>
        <FormError>{error}</FormError>
        <Button type='submit' fullWidth loading={loading}>{t('Send the code')}</Button>
      </form>
    </AuthShell>
  )
}

export default EmailVerify
