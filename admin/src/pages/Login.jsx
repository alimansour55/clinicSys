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
import MfaSetupBox from '../components/MfaSetupBox'
import { assets } from '../assets/assets'
import { staffLoginLogoClassName } from '../utils/brandingLogo'
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

  const {setAToken, backendUrl, siteSettings} = useContext(AdminContext)
  const {setDToken} = useContext(DoctorContext)
  const {setRToken} = useContext(ReceptionistContext)
  const { t, isRtl } = useLanguage()
  const navigate = useNavigate()

  const headerLogoSrc = siteSettings?.branding?.headerLogoUrl || assets.site_default_logo
  const logoAltText = siteSettings?.branding?.altText || DEFAULT_APP_DISPLAY_NAME
  const logoImgClassName = staffLoginLogoClassName

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
        toast.error(data.message)
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
        toast.success(data.message)
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
        toast.error(data.message)
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
        toast.info(data.message || 'Enter your MFA code')
      } else if (data.mfaSetupRequired) {
        setMfaStep('setup')
        setMfaRole('Admin')
        setMfaToken(data.mfaToken)
        setMfaSetup(data.setup)
        setMfaCode('')
        toast.info(data.message || 'MFA setup is required')
      } else {
        toast.error(data.message)
      }
     } else if (state === 'Doctor') {
         
      const { data } = await axios.post(backendUrl + '/api/doctor/login', {email, password})
      if(data.success) {
        localStorage.setItem('dToken', data.token)
        setDToken(data.token)
        navigate('/doctor-dashboard')
        console.log(data.token)
      } else if (data.mfaRequired) {
        setMfaStep('verify')
        setMfaRole('Doctor')
        setMfaToken(data.mfaToken)
        setMfaCode('')
        toast.info(data.message || 'Enter your MFA code')
      } else if (data.mfaSetupRequired) {
        setMfaStep('setup')
        setMfaRole('Doctor')
        setMfaToken(data.mfaToken)
        setMfaSetup(data.setup)
        setMfaCode('')
        toast.info(data.message || 'MFA setup is required')
      } else {
        toast.error(data.message)
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
        toast.info(data.message || 'Enter your MFA code')
      } else if (data.mfaSetupRequired) {
        setMfaStep('setup')
        setMfaRole('Receptionist')
        setMfaToken(data.mfaToken)
        setMfaSetup(data.setup)
        setMfaCode('')
        toast.info(data.message || 'MFA setup is required')
      } else {
        toast.error(data.message)
      }
     }
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Network Error'
      toast.error(isDatabaseConfig503(error) ? getApiErrorMessage(error, t) : msg)
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
    <form onSubmit={onSubmithandler} className='relative z-10 flex min-h-[80vh] touch-manipulation items-center justify-center p-4'>
      <div className='relative z-10 flex w-full max-w-md flex-col items-start gap-3 rounded-xl border bg-white p-6 text-sm text-[#5E5E5E] shadow-lg sm:p-8'>
        <div className='w-full flex flex-col items-center gap-3'>
          <img
            src={headerLogoSrc}
            alt={logoAltText}
            className={logoImgClassName}
          />
        </div>
        <div dir='ltr' className='w-full flex justify-end'>
          <LanguageToggle compact />
        </div>

        {apiStatus === 'checking' && (
          <p className='w-full rounded-lg bg-gray-50 px-3 py-2 text-center text-xs text-gray-500'>
            {t('Connecting to server...')}
          </p>
        )}
        {apiStatus === 'db_error' && (
          <div className='w-full rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-900'>
            <p className='flex items-start gap-2 font-semibold'>
              <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />
              {t('Database not configured on server')}
            </p>
            <p className='mt-2 leading-relaxed'>
              {t('Backend Vercel MONGODB_URI hint')}
            </p>
            <p className='mt-2 font-mono text-[11px] break-all opacity-80'>{backendUrl}/api</p>
          </div>
        )}
        {apiStatus === 'error' && (
          <div className='w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900'>
            <p className='flex items-start gap-2 font-semibold'>
              <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />
              {t('Cannot reach the API server')}
            </p>
            <p className='mt-2 leading-relaxed'>
              {t('Expected API')}: <span className='font-mono break-all'>{backendUrl}</span>
            </p>
            {shouldShowMobileApiHint() ? (
              <p className='mt-2 flex items-start gap-2 leading-relaxed'>
                <Wifi className='mt-0.5 h-3.5 w-3.5 shrink-0' />
                {t('On your phone, start the backend on this PC and allow port 4000 in Windows Firewall. Patient site uses port 5173; staff login uses 5174.')}
              </p>
            ) : (
              <p className='mt-2 leading-relaxed'>
                {t('In Vercel (or your host), set VITE_BACKEND_URL to your live API URL (e.g. https://your-api.onrender.com), then redeploy. The API must be running and reachable from the internet.')}
              </p>
            )}
          </div>
        )}

        <p className='text-2xl font-semibold m-auto' ><span className='text-primary'>{t(state)}</span> {t('Login')}</p>
        {mfaStep && <MfaSetupBox mode={mfaStep} setup={mfaSetup} />}
        <div className='w-full'>
          <p>{t('Email')}</p>
          <input disabled={Boolean(mfaStep)} onChange={(e) => setEmail(e.target.value)} value={email} className='min-h-[44px] w-full rounded border border-[#DADADA] p-2.5 mt-1 text-sm disabled:bg-gray-100' type="email" required autoComplete='email' />
        </div>
        {!mfaStep && <div className='w-full'>
          <p>{t('Password')}</p>
          <div className='relative' >
          <input onChange={(e) => setPassword(e.target.value)} value={password} className='min-h-[44px] w-full rounded border border-[#DADADA] p-2.5 pr-10 mt-1 text-sm'
          type={showPassword ? "text" : "password"}
          required
          autoComplete='current-password'
          />
          <button
            type='button'
            onClick={() => setShowPassword(!showPassword)}
            className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700`}
          >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          </div>
        </div>}
        {mfaStep && (
          <div className='w-full'>
            <p>MFA Code</p>
            <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className='min-h-[44px] w-full rounded border border-[#DADADA] p-2.5 mt-1 text-center text-sm font-semibold tracking-[0.4em]' inputMode='numeric' required />
          </div>
        )}
        <button className='min-h-[44px] w-full cursor-pointer rounded-md bg-primary py-2.5 text-base font-medium text-white transition active:scale-[0.98]'>{mfaStep ? 'Continue' : t('Login')}</button>
        {mfaStep && <button type='button' onClick={resetMfaFlow} className='w-full rounded-md border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50'>Back to login</button>}
        {!mfaStep && <div className='flex w-full gap-2 pt-1'>
          {['Admin', 'Doctor', 'Receptionist'].map((role) => (
            <button
              key={role}
              type='button'
              onClick={() => setState(role)}
              className={`min-h-[44px] flex-1 cursor-pointer select-none rounded-md border py-2.5 text-xs font-medium active:scale-[0.98] active:bg-gray-100 ${state === role ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600'}`}
            >
              {t(role)}
            </button>
          ))}
        </div>}
      
      </div>
    </form>
  )
}

export default Login
