import React, { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, User } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { Button, Field, Input, notify } from '../components/ui'
import MfaSetupBox from '../components/MfaSetupBox'
import EgyptPhoneInput from '../components/EgyptPhoneInput'
import SignupInlineVerify from '../components/SignupInlineVerify'
import { AuthShell, FormError, NETWORK_ERROR, PasswordChecklist, PasswordInput, RecoveryCodesPanel, meetsPolicy, usePasswordPolicy, useServerText } from '../components/account/accountUi'
import InsuranceFields, { emptyInsurance, insuranceProblem } from '../components/account/InsuranceFields'
import { isValidEgyptPhone, normalizeEgyptPhone } from '../utils/egyptPhone'

const today = new Date().toISOString().split('T')[0]

const Login = () => {
  const { backendUrl, token, setToken, userData, t } = useContext(AppContext)
  const say = useServerText()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Sign in is the default: reset, verify and session-expiry all send people to plain /login.
  const [state, setState] = useState(searchParams.get('mode') === 'signup' ? 'Sign Up' : 'Login')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [insuranceEnabled, setInsuranceEnabled] = useState(false)
  const [insurance, setInsurance] = useState(emptyInsurance)
  const [cardFile, setCardFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mfaStep, setMfaStep] = useState(null)
  const [mfaToken, setMfaToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaSetup, setMfaSetup] = useState(null)
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)
  const [pendingSession, setPendingSession] = useState(null)
  const [emailVerified, setEmailVerified] = useState(false)
  const [emailVerificationToken, setEmailVerificationToken] = useState('')
  const policy = usePasswordPolicy()

  const isSignUp = state === 'Sign Up'

  useEffect(() => {
    setState(searchParams.get('mode') === 'signup' ? 'Sign Up' : 'Login')
    setError('')
  }, [searchParams])

  useEffect(() => {
    if (token && userData && !pendingSession) navigate('/')
  }, [token, userData, navigate, pendingSession])

  const startSession = (sessionToken) => {
    localStorage.setItem('token', sessionToken)
    setToken(sessionToken)
  }

  const resetMfaFlow = () => {
    setMfaStep(null)
    setMfaToken('')
    setMfaCode('')
    setMfaSetup(null)
    setUseRecoveryCode(false)
    setError('')
  }

  const switchMode = (next) => {
    setState(next)
    setError('')
  }

  const submitMfa = async () => {
    const path = mfaStep === 'verify' ? '/api/user/mfa/verify-login' : '/api/user/mfa/complete-login-setup'
    const { data } = await axios.post(backendUrl + path, { mfaToken, code: mfaCode })
    if (data.success) {
      if (data.recoveryCodes?.length) {
        setPendingSession({ token: data.token, codes: data.recoveryCodes })
        return
      }
      if (data.recoveryCodeUsed) {
        notify.warning(say(`Recovery code used. ${data.recoveryCodesLeft} codes left.`))
      }
      startSession(data.token)
      return
    }
    if (data.sessionExpired) {
      resetMfaFlow()
      setPassword('')
    }
    setError(say(data.message))
    setMfaCode('')
  }

  const submitSignUp = async () => {
    const phoneNormalized = normalizeEgyptPhone(phone)
    if (!isValidEgyptPhone(phoneNormalized)) return setError(t('Enter a valid Egyptian mobile number (10 digits after +20)'))
    if (!emailVerified) return setError(t('Please verify your email using Verify now'))
    if (!meetsPolicy(password, policy)) return setError(t('Please choose a password that meets all the requirements'))

    if (insuranceEnabled) {
      const problem = insuranceProblem(insurance, { file: cardFile })
      if (problem) return setError(say(problem))
    }

    const formData = new FormData()
    Object.entries({ name, email, phone: phoneNormalized, dob, password, insuranceEnabled, emailVerificationToken }).forEach(([key, value]) => formData.append(key, value))
    if (insuranceEnabled) {
      formData.append('insuranceProvider', insurance.provider)
      formData.append('insuranceFullName', insurance.fullName)
      formData.append('insuranceBirthDate', insurance.birthDate)
      formData.append('insuranceIdNumber', insurance.idNumber)
      formData.append('insuranceExpiryDate', insurance.expiryDate)
      formData.append('insuranceCardPhoto', cardFile)
    }

    const { data } = await axios.post(`${backendUrl}/api/user/register`, formData)
    if (data.success && data.token) {
      startSession(data.token)
      notify.success(say(data.message))
      navigate('/my-profile?welcome=1', { replace: true })
    } else {
      setError(say(data.message))
    }
  }

  const submitLogin = async () => {
    const { data } = await axios.post(`${backendUrl}/api/user/login`, { password, loginId: email })
    if (data.success) return startSession(data.token)

    if (data.verificationRequired) {
      notify.info(say(data.message))
      navigate('/account-verify', { state: { verificationToken: data.verificationToken, email: data.email } })
    } else if (data.mfaRequired || data.mfaSetupRequired) {
      setMfaStep(data.mfaRequired ? 'verify' : 'setup')
      setMfaToken(data.mfaToken)
      setMfaSetup(data.setup || null)
      setMfaCode('')
    } else {
      setError(say(data.message))
    }
  }

  const onSubmitHandler = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mfaStep) await submitMfa()
      else if (isSignUp) await submitSignUp()
      else await submitLogin()
    } catch (requestError) {
      setError(say(requestError.response?.data?.message || NETWORK_ERROR))
    } finally {
      setLoading(false)
    }
  }

  if (pendingSession) {
    return (
      <AuthShell title={t('You are almost in')}>
        <RecoveryCodesPanel
          codes={pendingSession.codes}
          onDone={() => {
            startSession(pendingSession.token)
            setPendingSession(null)
          }}
        />
      </AuthShell>
    )
  }

  if (mfaStep) {
    return (
      <AuthShell
        title={mfaStep === 'setup' ? t('Set up your authenticator') : t('One more step')}
        onBack={resetMfaFlow}
        backLabel={t('Back to login')}
      >
        <form onSubmit={onSubmitHandler} className='space-y-4'>
          <MfaSetupBox mode={mfaStep} setup={mfaSetup} />
          <FormError>{error}</FormError>
          {useRecoveryCode ? (
            <Field label={t('Recovery code')} hint={t('Each recovery code works once.')} required>
              <Input data-autofocus dir='ltr' value={mfaCode} onChange={(event) => setMfaCode(event.target.value.toUpperCase().slice(0, 12))} className='text-center font-mono' autoComplete='off' placeholder='XXXXX-XXXXX' />
            </Field>
          ) : (
            <Field label={t('Authenticator code')} required>
              <Input dir='ltr' value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className='text-center font-bold tracking-[0.4em]' inputMode='numeric' autoComplete='one-time-code' placeholder='000000' />
            </Field>
          )}
          <Button type='submit' fullWidth loading={loading}>{t('Continue')}</Button>
          {mfaStep === 'verify' && (
            <button
              type='button'
              onClick={() => {
                setUseRecoveryCode((value) => !value)
                setMfaCode('')
                setError('')
              }}
              className='min-h-9 w-full text-body-sm font-medium text-brand underline'
            >
              {useRecoveryCode ? t('Use my authenticator app') : t('Lost your phone? Use a recovery code')}
            </button>
          )}
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={isSignUp ? t('Create Account') : t('Welcome Back')}
      description={isSignUp ? t('Please sign up to book appointment') : t('Please login to book appointment')}
    >
      <form onSubmit={onSubmitHandler} className='space-y-4' noValidate={false}>
        {isSignUp && (
          <Field label={t('Full name')} required>
            <Input id='signup-name' dir='auto' value={name} onChange={(event) => setName(event.target.value)} placeholder={t('Enter your full name')} autoComplete='name' maxLength={120} />
          </Field>
        )}

        <div>
          <Field label={isSignUp ? t('Email') : t('Email or Phone')} required>
            <Input
              id='login-email'
              dir='ltr'
              type={isSignUp ? 'email' : 'text'}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                if (isSignUp) {
                  setEmailVerified(false)
                  setEmailVerificationToken('')
                }
              }}
              placeholder={isSignUp ? t('Enter your email') : t('Enter email or phone number')}
              autoComplete={isSignUp ? 'email' : 'username'}
            />
          </Field>
          {isSignUp && (
            <SignupInlineVerify
              key={email}
              label='Email'
              verified={emailVerified}
              onVerified={(verified) => {
                setEmailVerified(true)
                setEmailVerificationToken(verified)
              }}
              canSend={() => {
                if (!email.trim()) {
                  setError(t('Enter your email first'))
                  return false
                }
                setError('')
                return true
              }}
              onSendCode={async () => (await axios.post(`${backendUrl}/api/user/signup-verify/send-email`, { email })).data}
              onConfirmCode={async (code) => (await axios.post(`${backendUrl}/api/user/signup-verify/confirm-email`, { email, code })).data}
            />
          )}
        </div>

        {isSignUp && (
          <>
            <div className='flex flex-col gap-1.5'>
              <label htmlFor='signup-phone' className='text-body-sm font-medium text-ink'>
                {t('Phone number')}<span aria-hidden='true' className='ms-1 text-danger-ink'>*</span>
              </label>
              <EgyptPhoneInput id='signup-phone' value={phone} onChange={setPhone} required />
              <p className='text-caption text-ink-3'>{t('Egypt only — enter your 10-digit mobile after +20 (e.g. 10 1234 5678).')}</p>
            </div>

            <Field label={t('Birth date')} required>
              <Input id='signup-dob' type='date' max={today} value={dob} onChange={(event) => setDob(event.target.value)} className='date-field-input' />
            </Field>
          </>
        )}

        <div>
          <Field label={t('Password')} required>
            <PasswordInput
              id='login-password'
              value={password}
              onChange={setPassword}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder={t('Enter your password')}
            />
          </Field>
          {isSignUp && <PasswordChecklist password={password} policy={policy} />}
          {!isSignUp && (
            <div className='mt-2 text-end'>
              <Link to='/email-verify' className='text-body-sm text-brand underline'>{t('Forgot Password?')}</Link>
            </div>
          )}
        </div>

        {isSignUp && (
          <div className='rounded-control bg-surface-sunken p-3'>
            <label className='flex min-h-9 cursor-pointer items-center gap-3 text-body-sm font-semibold text-ink'>
              <input type='checkbox' checked={insuranceEnabled} onChange={(event) => setInsuranceEnabled(event.target.checked)} className='size-4 accent-primary' />
              {t('I have medical insurance')}
            </label>
            <p className='ms-7 text-caption text-ink-3'>{t('Optional. You can add it later too.')}</p>
            {insuranceEnabled && (
              <div className='mt-4'>
                <InsuranceFields values={insurance} onChange={setInsurance} file={cardFile} onFileChange={setCardFile} today={today} />
              </div>
            )}
          </div>
        )}

        <FormError>{error}</FormError>

        {isSignUp && !emailVerified && (
          <p className='text-center text-caption text-warning-ink'>{t('Verify your email with "Verify now" before creating an account.')}</p>
        )}

        <Button type='submit' fullWidth size='lg' loading={loading} disabled={isSignUp && !emailVerified}>
          {isSignUp ? t('Create Account') : t('Login')}
        </Button>

        <p className='text-center text-body-sm text-ink-2'>
          {isSignUp ? t('Already have an account?') : t("Don't have an account?")}{' '}
          <button type='button' onClick={() => switchMode(isSignUp ? 'Login' : 'Sign Up')} className='min-h-9 font-medium text-brand underline'>
            {isSignUp ? t('Login here') : t('Sign up here')}
          </button>
        </p>
      </form>
    </AuthShell>
  )
}

export default Login
