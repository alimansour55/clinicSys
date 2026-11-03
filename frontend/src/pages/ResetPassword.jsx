import { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'
import { Button, Field, notify } from '../components/ui'
import { AuthShell, FormError, NETWORK_ERROR, PasswordChecklist, PasswordInput, meetsPolicy, usePasswordPolicy, useServerText } from '../components/account/accountUi'

const ResetPassword = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { backendUrl } = useContext(AppContext)
  const { t } = useLanguage()
  const say = useServerText()
  const policy = usePasswordPolicy()

  const email = location.state?.email || ''
  const otp = location.state?.otp || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [codeExpired, setCodeExpired] = useState(false)

  useEffect(() => {
    if (!email || !otp) navigate('/email-verify', { replace: true })
  }, [email, otp, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (!meetsPolicy(newPassword, policy)) return setError(t('Please choose a password that meets all the requirements'))
    if (newPassword !== confirmPassword) return setError(t('Passwords do not match'))

    setLoading(true)
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/reset-password`, { email, otp, newPassword })
      if (data.success) {
        // The code must not stay in browser history once it has done its job.
        window.history.replaceState({}, '')
        notify.success(say(data.message))
        navigate('/login?mode=login', { replace: true })
      } else {
        setError(say(data.message))
        // A password the policy refused can be retried. A dead code cannot, so offer the way out.
        if (!/^Password/.test(data.message || '') && !/different/.test(data.message || '')) setCodeExpired(true)
      }
    } catch {
      setError(say(NETWORK_ERROR))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={t('Choose a new password')}
      description={t('Other devices will be signed out when you change it.')}
      onBack={() => navigate('/otp-verify', { state: { email } })}
    >
      <form onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <Field label={t('New password')} required>
            <PasswordInput value={newPassword} onChange={setNewPassword} autoComplete='new-password' />
          </Field>
          <PasswordChecklist password={newPassword} policy={policy} />
        </div>
        <Field label={t('Confirm new password')} required>
          <PasswordInput value={confirmPassword} onChange={setConfirmPassword} autoComplete='new-password' />
        </Field>
        <FormError>{error}</FormError>
        {codeExpired ? (
          <Button type='button' fullWidth variant='secondary' onClick={() => navigate('/email-verify')}>{t('Request a new code')}</Button>
        ) : (
          <Button type='submit' fullWidth loading={loading}>{t('Change password')}</Button>
        )}
      </form>
    </AuthShell>
  )
}

export default ResetPassword
