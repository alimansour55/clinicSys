import React, { useContext, useEffect, useState } from 'react'
import { AlertCircle, Wifi } from 'lucide-react'
import { AdminContext } from '../context/AdminContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { DoctorContext } from '../context/DoctorContext'
import { Eye, EyeOff } from 'lucide-react'
import { ReceptionistContext } from '../context/ReceptionistContext'
import { useNavigate } from 'react-router-dom'
import { LanguageToggle, useLanguage } from '../i18n'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import MfaSetupBox from '../components/MfaSetupBox'
import { assets } from '../assets/assets'
import { staffHeaderLogoClassName } from '../utils/brandingLogo'
import { Button, Field, Input } from '../components/ui'
import { DEFAULT_APP_DISPLAY_NAME } from '../utils/appDisplayName'
import { shouldShowMobileApiHint } from '../utils/resolveBackendUrl'
import { getApiErrorMessage, isDatabaseConfig503 } from '../utils/apiErrorMessage'

const Login = () => {
  
  const [state, setState] = useState('Admin')
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mfaStep, setMfaStep] = useState(null)
  const [mfaRole, setMfaRole] = useState('')
  const [mfaToken, setMfaToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaSetup, setMfaSetup] = useState(null)
  const [apiStatus, setApiStatus] = useState('checking') // checking | ok | error | db_error
  const [submitting, setSubmitting] = useState(false)

  const {setAToken, backendUrl, siteSettings} = useContext(AdminContext)
  const {setDToken} = useContext(DoctorContext)
  const {setRToken} = useContext(ReceptionistContext)
  const { t } = useLanguage()
  const navigate = useNavigate()

  const headerLogoSrc = siteSettings?.branding?.headerLogoUrl || assets.site_default_logo
  const logoAltText = siteSettings?.branding?.altText || DEFAULT_APP_DISPLAY_NAME
  const logoImgClassName = staffHeaderLogoClassName

  useEffect(() => {
    let cancelled = false
    setApiStatus('checking')
    axios
      .get(`${backendUrl}/api/user/site-settings`, { timeout: 15_000 })
      .then(() => {
        if (!cancelled) setApiStatus('ok')
      })
      .catch((error) => {
        if (cancelled) return
        setApiStatus(isDatabaseConfig503(error) ? 'db_error' : 'error')
      })
    return () => {
      cancelled = true
    }
  }, [backendUrl])

  const onSubmithandler = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)

    try {
     if (mfaStep === 'verify') {
      const mfaEndpoint = mfaRole === 'Admin'
        ? '/api/admin/mfa/verify-login'
        : mfaRole === 'Receptionist'
          ? '/api/receptionist/mfa/verify-login'
          : '/api/doctor/mfa/verify-login'
      const { data } = await axios.post(backendUrl + mfaEndpoint, { mfaToken, code: mfaCode })
      if(data.success) {
        if (mfaRole === 'Admin') {
          localStorage.setItem('aToken', data.token)
          setAToken(data.token)
          navigate('/admin-dashboard')
        } else if (mfaRole === 'Receptionist') {
          localStorage.setItem('rToken', data.token)
          setRToken(data.token)
          navigate('/receptionist-dashboard')
        } else {
          localStorage.setItem('dToken', data.token)
          setDToken(data.token)
          navigate('/doctor-dashboard')
        }
      } else {
        toast.error(t(data.message))
      }
      return
     }

     if (mfaStep === 'setup') {
      const mfaEndpoint = mfaRole === 'Admin'
        ? '/api/admin/mfa/complete-login-setup'
        : mfaRole === 'Receptionist'
          ? '/api/receptionist/mfa/complete-login-setup'
          : '/api/doctor/mfa/complete-login-setup'
      const { data } = await axios.post(backendUrl + mfaEndpoint, { mfaToken, code: mfaCode })
      if(data.success) {
        toast.success(t(data.message))
        if (mfaRole === 'Admin') {
          localStorage.setItem('aToken', data.token)
          setAToken(data.token)
          navigate('/admin-dashboard')
        } else if (mfaRole === 'Receptionist') {
          localStorage.setItem('rToken', data.token)
          setRToken(data.token)
          navigate('/receptionist-dashboard')
        } else {
          localStorage.setItem('dToken', data.token)
          setDToken(data.token)
          navigate('/doctor-dashboard')
        }
      } else {
        toast.error(t(data.message))
      }
      return
     }

     if(state === 'Admin') {
      const { data } = await axios.post(backendUrl + '/api/admin/login', {email, password})
      if(data.success) {
        localStorage.setItem('aToken', data.token)
        setAToken(data.token)
        navigate('/admin-dashboard')
      } else if (data.mfaRequired) {
        setMfaStep('verify')
        setMfaRole('Admin')
        setMfaToken(data.mfaToken)
        setMfaCode('')
        toast.info(t(data.message || 'Enter your MFA code'))
      } else if (data.mfaSetupRequired) {
        setMfaStep('setup')
        setMfaRole('Admin')
        setMfaToken(data.mfaToken)
        setMfaSetup(data.setup)
        setMfaCode('')
        toast.info(t(data.message || 'MFA setup is required'))
      } else {
        toast.error(t(data.message))
      }
     } else if (state === 'Doctor') {
         
      const { data } = await axios.post(backendUrl + '/api/doctor/login', {email, password})
      if(data.success) {
        localStorage.setItem('dToken', data.token)
        setDToken(data.token)
        navigate('/doctor-dashboard')
      } else if (data.mfaRequired) {
        setMfaStep('verify')
        setMfaRole('Doctor')
        setMfaToken(data.mfaToken)
        setMfaCode('')
        toast.info(t(data.message || 'Enter your MFA code'))
      } else if (data.mfaSetupRequired) {
        setMfaStep('setup')
        setMfaRole('Doctor')
        setMfaToken(data.mfaToken)
        setMfaSetup(data.setup)
        setMfaCode('')
        toast.info(t(data.message || 'MFA setup is required'))
      } else {
        toast.error(t(data.message))
      }
     } else {
      const { data } = await axios.post(backendUrl + '/api/receptionist/login', {email, password})
      if(data.success) {
        localStorage.setItem('rToken', data.token)
        setRToken(data.token)
        navigate('/receptionist-dashboard')
      } else if (data.mfaRequired) {
        setMfaStep('verify')
        setMfaRole('Receptionist')
        setMfaToken(data.mfaToken)
        setMfaCode('')
        toast.info(t(data.message || 'Enter your MFA code'))
      } else if (data.mfaSetupRequired) {
        setMfaStep('setup')
        setMfaRole('Receptionist')
        setMfaToken(data.mfaToken)
        setMfaSetup(data.setup)
        setMfaCode('')
        toast.info(t(data.message || 'MFA setup is required'))
      } else {
        toast.error(t(data.message))
      }
     }
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Network Error'
      toast.error(isDatabaseConfig503(error) ? getApiErrorMessage(error, t) : t(msg))
    } finally {
      setSubmitting(false)
    }
  }

  const resetMfaFlow = () => {
    setMfaStep(null)
    setMfaRole('')
    setMfaToken('')
    setMfaCode('')
    setMfaSetup(null)
  }


  
  return (
    <div className='flex min-h-dvh bg-canvas'>
      <aside className='relative hidden w-[42%] max-w-xl flex-col justify-between overflow-hidden bg-primary-dark p-10 text-on-primary lg:flex'>
        <div aria-hidden='true' className='absolute -end-32 -top-32 size-96 rounded-se-signature rounded-[4rem] bg-primary opacity-60' />
        <div aria-hidden='true' className='absolute -bottom-24 -start-24 size-72 rounded-[3rem] bg-primary opacity-40' />
        <p className='relative font-display text-title-lg'>{DEFAULT_APP_DISPLAY_NAME}</p>
        <div className='relative'>
          <p className='font-display text-display-xl'>{t('The whole clinic, on one screen.')}</p>
          <p className='mt-4 max-w-md text-body opacity-90'>{t('Staff portal for the people who keep the clinic running.')}</p>
        </div>
      </aside>

      <form onSubmit={onSubmithandler} className='flex flex-1 touch-manipulation items-center justify-center p-4'>
        <div className='w-full max-w-md rounded-card rounded-se-signature border border-line bg-surface p-6 shadow-e2 sm:p-8'>
          <div className='flex items-start justify-between gap-3'>
            <img src={headerLogoSrc} alt={logoAltText} className={logoImgClassName} />
            <div className='flex shrink-0 items-center gap-2'>
              <ThemeToggle />
              <LanguageToggle compact />
            </div>
          </div>

          <h1 className='mt-6 font-display text-display text-ink'>
            <span className='text-brand'>{t(state)}</span> {t('Login')}
          </h1>

          <div className='mt-4 space-y-3'>
            {apiStatus === 'checking' && (
              <p role='status' className='rounded-control bg-surface-sunken px-3 py-2 text-caption text-ink-3'>
                {t('Connecting to server...')}
              </p>
            )}
            {apiStatus === 'db_error' && (
              <div className='rounded-control bg-danger-soft px-3 py-3 text-caption text-danger-ink'>
                <p className='flex items-start gap-2 font-semibold'>
                  <AlertCircle aria-hidden='true' className='mt-0.5 size-4 shrink-0' />
                  {t('Database not configured on server')}
                </p>
                <p className='mt-2'>{t('Backend Vercel MONGODB_URI hint')}</p>
                <p dir='ltr' className='mt-2 break-all font-mono opacity-80'>{backendUrl}/api</p>
              </div>
            )}
            {apiStatus === 'error' && (
              <div className='rounded-control bg-warning-soft px-3 py-3 text-caption text-warning-ink'>
                <p className='flex items-start gap-2 font-semibold'>
                  <AlertCircle aria-hidden='true' className='mt-0.5 size-4 shrink-0' />
                  {t('Cannot reach the API server')}
                </p>
                <p className='mt-2'>
                  {t('Expected API')}: <span dir='ltr' className='break-all font-mono'>{backendUrl}</span>
                </p>
                {shouldShowMobileApiHint() ? (
                  <p className='mt-2 flex items-start gap-2'>
                    <Wifi aria-hidden='true' className='mt-0.5 size-3.5 shrink-0' />
                    {t('On your phone, start the backend on this PC and allow port 4000 in Windows Firewall. Patient site uses port 5173; staff login uses 5174.')}
                  </p>
                ) : (
                  <p className='mt-2'>
                    {t('In Vercel (or your host), set VITE_BACKEND_URL to your live API URL (e.g. https://your-api.onrender.com), then redeploy. The API must be running and reachable from the internet.')}
                  </p>
                )}
              </div>
            )}

            {mfaStep && <MfaSetupBox mode={mfaStep} setup={mfaSetup} />}

            {!mfaStep && (
              <div role='group' aria-label={t('Sign in as')} className='grid grid-cols-3 gap-1 rounded-control bg-surface-sunken p-1'>
                {['Admin', 'Doctor', 'Receptionist'].map((role) => (
                  <button
                    key={role}
                    type='button'
                    aria-pressed={state === role}
                    onClick={() => setState(role)}
                    className={`min-h-10 cursor-pointer select-none rounded-[0.5rem] px-1 text-caption font-semibold transition duration-(--duration-fast) ease-standard sm:text-body-sm ${
                      state === role ? 'bg-primary text-on-primary shadow-e1' : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    {t(role)}
                  </button>
                ))}
              </div>
            )}

            <Field label={t('Email')}>
              <Input dir='ltr' style={{ textAlign: 'start' }} disabled={Boolean(mfaStep)} value={email} onChange={(e) => setEmail(e.target.value)} type='email' required autoComplete='email' />
            </Field>

            {!mfaStep && (
              <div className='relative'>
                <Field label={t('Password')}>
                  <Input
                    className='pe-11'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete='current-password'
                  />
                </Field>
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('Hide password') : t('Show password')}
                  className='absolute bottom-1 end-1 flex size-9 cursor-pointer items-center justify-center text-ink-3 hover:text-ink'
                >
                  {showPassword ? <EyeOff aria-hidden='true' size={20} /> : <Eye aria-hidden='true' size={20} />}
                </button>
              </div>
            )}

            {mfaStep && (
              <Field label={t('MFA Code')}>
                <Input
                  dir='ltr'
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className='text-center font-semibold tracking-[0.4em]'
                  inputMode='numeric'
                  autoComplete='one-time-code'
                  required
                  autoFocus
                />
              </Field>
            )}

            <Button type='submit' size='lg' fullWidth loading={submitting}>
              {mfaStep ? t('Continue') : t('Login')}
            </Button>
            {mfaStep && (
              <Button variant='secondary' fullWidth onClick={resetMfaFlow}>
                {t('Back to login')}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

export default Login
