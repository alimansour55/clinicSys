import React, { useContext, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import OtpCodeInput from '../components/OtpCodeInput'
import CountdownTimer from '../components/CountdownTimer'

const AccountVerify = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { backendUrl, setToken } = useContext(AppContext)

  const verificationToken = location.state?.verificationToken || ''
  const [status, setStatus] = useState({
    email: location.state?.email || '',
    emailVerified: false,
    accountVerified: false,
    otpExpiresInMinutes: 10
  })
  const [emailCode, setEmailCode] = useState('')
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [loadingResend, setLoadingResend] = useState(false)

  useEffect(() => {
    if (!verificationToken) {
      navigate('/login')
      return
    }
    refreshStatus()
  }, [verificationToken, navigate])

  const refreshStatus = async () => {
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/verify-account/status`, {
        verificationToken
      })
      if (data.success) {
        setStatus(data)
        if (data.accountVerified && data.token) {
          localStorage.setItem('token', data.token)
          setToken(data.token)
          navigate('/')
        }
      }
    } catch (error) {
      console.log(error)
    }
  }

  const finishIfVerified = (data) => {
    setStatus((prev) => ({ ...prev, ...data }))
    if (data.token) {
      localStorage.setItem('token', data.token)
      setToken(data.token)
      toast.success('Account verified! Welcome.')
      navigate('/')
    }
  }

  const verifyEmail = async (e) => {
    e.preventDefault()
    if (emailCode.length !== 6) {
      toast.error('Enter the 6-digit email code')
      return
    }
    setLoadingEmail(true)
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/verify-account/verify-email`, {
        verificationToken,
        code: emailCode
      })
      if (data.success) {
        toast.success(data.message)
        finishIfVerified(data)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoadingEmail(false)
    }
  }

  const resendCode = async () => {
    setLoadingResend(true)
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/verify-account/resend`, {
        verificationToken,
        channel: 'email'
      })
      if (data.success) {
        if (data.token) {
          finishIfVerified(data)
          return
        }
        toast.success(data.message || 'Code sent')
        setStatus((prev) => ({ ...prev, ...data }))
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoadingResend(false)
    }
  }

  return (
    <div className='min-h-[80vh] flex items-center justify-center px-4 py-8'>
      <div className='w-full max-w-lg rounded-xl border bg-white p-6 shadow-lg sm:p-8'>
        <button
          type='button'
          onClick={() => navigate('/login')}
          className='mb-4 flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-800'
        >
          <ArrowLeft size={18} />
          <span className='text-sm'>Back to login</span>
        </button>

        <div className='mb-6 text-center'>
          <ShieldCheck className='mx-auto mb-2 h-10 w-10 text-primary' />
          <h1 className='text-xl font-semibold text-gray-800 sm:text-2xl'>Verify your account</h1>
          <p className='mt-2 text-xs text-gray-600 sm:text-sm'>
            Enter the code we sent to your email. It expires in {status.otpExpiresInMinutes} minutes.
          </p>
        </div>

        <form onSubmit={verifyEmail} className='rounded-lg border border-gray-200 p-4'>
          <div className='mb-3 flex items-center gap-2 text-sm font-medium text-gray-800'>
            <Mail className='h-4 w-4 text-primary' />
            Email code
            {status.emailVerified && (
              <span className='ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'>Verified</span>
            )}
          </div>
          <p className='mb-3 text-xs text-gray-500'>Sent to {status.email}</p>
          {!status.emailVerified && (
            <>
              <OtpCodeInput onChange={setEmailCode} disabled={loadingEmail} />
              <button
                type='submit'
                disabled={loadingEmail}
                className='mt-4 w-full rounded-md bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:bg-gray-400'
              >
                {loadingEmail ? 'Verifying…' : 'Verify email'}
              </button>
            </>
          )}
        </form>

        <div className='mt-6 text-center'>
          <CountdownTimer
            duration={60}
            onResend={() => !loadingResend && resendCode()}
          />
          <p className='mt-2 text-[11px] text-gray-500'>Resend waits 60 seconds between requests</p>
        </div>
      </div>
    </div>
  )
}

export default AccountVerify
