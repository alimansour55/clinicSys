import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Calendar, Eye, EyeOff, FileUp, Lock, Mail, Phone, User } from 'lucide-react'

const today = new Date().toISOString().split('T')[0]

const Login = () => {

  const { backendUrl, token, setToken } = useContext(AppContext)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [state, setState] = useState(searchParams.get('mode') === 'login' ? 'Login' : 'Sign Up')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [insuranceEnabled, setInsuranceEnabled] = useState(false)
  const [insuranceFullName, setInsuranceFullName] = useState('')
  const [insuranceBirthDate, setInsuranceBirthDate] = useState('')
  const [insuranceIdNumber, setInsuranceIdNumber] = useState('')
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState('')
  const [insuranceCardPhoto, setInsuranceCardPhoto] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  
  const onSubmitHandler = async (event) => {
    event.preventDefault()
    setLoading(true)

    try {
      
      if(state === 'Sign Up'){

        if (insuranceEnabled) {
          const formData = new FormData()
          formData.append('name', name)
          formData.append('email', email)
          formData.append('phone', phone)
          formData.append('dob', dob)
          formData.append('password', password)
          formData.append('insuranceEnabled', insuranceEnabled)
          formData.append('insuranceFullName', insuranceFullName)
          formData.append('insuranceBirthDate', insuranceBirthDate)
          formData.append('insuranceIdNumber', insuranceIdNumber)
          formData.append('insuranceExpiryDate', insuranceExpiryDate)
          if (insuranceCardPhoto) formData.append('insuranceCardPhoto', insuranceCardPhoto)
          const { data } = await axios.post(backendUrl + '/api/user/register', formData)
          if(data.success) {
            localStorage.setItem('token', data.token)
            setToken(data.token)
          } else {
            toast.error(data.message)
          }
          return
        }

        const { data } = await axios.post(backendUrl + '/api/user/register', { name, email, phone, dob, password, insuranceEnabled: false })
        if(data.success) {
          localStorage.setItem('token', data.token)
          setToken(data.token)
        } else {
          toast.error(data.message)
        }

      } else {

        const { data } = await axios.post(backendUrl + '/api/user/login', { password, loginId: email})
        if(data.success) {
          localStorage.setItem('token', data.token)
          setToken(data.token)
        } else {
          toast.error(data.message)
        }

      }

    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if(token){
     navigate('/')
    }
  },[token])

  useEffect(() => {
    setState(searchParams.get('mode') === 'login' ? 'Login' : 'Sign Up')
  }, [searchParams])

  return (
    <div className='min-h-[80vh] flex items-center justify-center px-4 py-8'>
      <form onSubmit={onSubmitHandler} className='w-full max-w-md p-6 sm:p-8 border rounded-xl shadow-lg bg-white'>
        
        {/* Title */}
        <h1 className='text-xl sm:text-2xl font-semibold text-center mb-2 text-gray-800'>
          {state === 'Sign Up' ? 'Create Account' : 'Welcome Back'}
        </h1>
        <p className='text-center text-gray-600 text-xs sm:text-sm mb-6'>
          Please {state === 'Sign Up' ? 'sign up' : 'login'} to book appointment
        </p>
        
        {/* Name Field (Sign Up Only) */}
        {state === 'Sign Up' && (
          <div className='mb-4'>
            <label className='block text-xs sm:text-sm font-medium mb-1.5 text-gray-700'>
              Full Name *
            </label>
            <div className='relative'>
              <User size={16} className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[18px] sm:h-[18px]' />
              <input 
                className='w-full pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all' 
                type="text" 
                onChange={(e) => setName(e.target.value)} 
                value={name}
                placeholder='Enter your full name'
                required 
              />
            </div>
          </div>
        )}
        
        {/* Email Field */}
        <div className='mb-4'>
          <label className='block text-xs sm:text-sm font-medium mb-1.5 text-gray-700'>
            {state === 'Sign Up' ? 'Email *' : 'Email or Phone'}
          </label>
          <div className='relative'>
            <Mail size={16} className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[18px] sm:h-[18px]' />
            <input 
              className='w-full pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all' 
              type={state === 'Sign Up' ? 'email' : 'text'} 
              onChange={(e) => setEmail(e.target.value)} 
              value={email}
              placeholder={state === 'Sign Up' ? 'Enter your email' : 'Enter email or phone number'}
              required 
            />
          </div>
        </div>

        {state === 'Sign Up' && (
          <>
            <div className='mb-4'>
              <label className='block text-xs sm:text-sm font-medium mb-1.5 text-gray-700'>
                Phone Number *
              </label>
              <div className='relative'>
                <Phone size={16} className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[18px] sm:h-[18px]' />
                <input
                  className='w-full pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all'
                  type='tel'
                  onChange={(e) => setPhone(e.target.value)}
                  value={phone}
                  placeholder='Enter your phone number'
                  required
                />
              </div>
            </div>

            <div className='mb-4'>
              <label className='block text-xs sm:text-sm font-medium mb-1.5 text-gray-700'>
                Birth Date *
              </label>
              <div className='relative'>
                <Calendar size={16} className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[18px] sm:h-[18px]' />
                <input
                  className='w-full pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all'
                  type='date'
                  max={today}
                  onChange={(e) => setDob(e.target.value)}
                  value={dob}
                  required
                />
              </div>
            </div>

            <div className='mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4'>
              <label className='flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer'>
                <input type='checkbox' checked={insuranceEnabled} onChange={(e) => setInsuranceEnabled(e.target.checked)} className='w-4 h-4 accent-primary' />
                Add Insurance
              </label>

              {insuranceEnabled && (
                <div className='mt-4 space-y-3'>
                  <div>
                    <label className='block text-xs font-medium text-gray-700 mb-1'>Full Name *</label>
                    <input value={insuranceFullName} onChange={(e) => setInsuranceFullName(e.target.value)} className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20' required={insuranceEnabled} />
                  </div>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                    <div>
                      <label className='block text-xs font-medium text-gray-700 mb-1'>Birth Date *</label>
                      <input type='date' max={today} value={insuranceBirthDate} onChange={(e) => setInsuranceBirthDate(e.target.value)} className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20' required={insuranceEnabled} />
                    </div>
                    <div>
                      <label className='block text-xs font-medium text-gray-700 mb-1'>ID Number *</label>
                      <input value={insuranceIdNumber} onChange={(e) => setInsuranceIdNumber(e.target.value)} className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20' required={insuranceEnabled} />
                    </div>
                  </div>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                    <div>
                      <label className='block text-xs font-medium text-gray-700 mb-1'>Expiry Date *</label>
                      <input type='date' value={insuranceExpiryDate} onChange={(e) => setInsuranceExpiryDate(e.target.value)} className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20' required={insuranceEnabled} />
                    </div>
                    <div>
                      <label className='block text-xs font-medium text-gray-700 mb-1'>Photo of Medical Card *</label>
                      <label className='flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 cursor-pointer hover:border-primary'>
                        <FileUp className='w-4 h-4' />
                        <span className='truncate'>{insuranceCardPhoto ? insuranceCardPhoto.name : 'Attach file'}</span>
                        <input type='file' accept='image/*,.pdf' onChange={(e) => setInsuranceCardPhoto(e.target.files?.[0] || null)} hidden required={insuranceEnabled} />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Password Field */}
        <div className='mb-4'>
          <label className='block text-xs sm:text-sm font-medium mb-1.5 text-gray-700'>
            Password
          </label>
          <div className='relative'>
            <Lock size={16} className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[18px] sm:h-[18px]' />
            <input 
              className='w-full pl-10 pr-10 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all' 
              type={showPassword ? "text" : "password"} 
              onChange={(e) => setPassword(e.target.value)} 
              value={password}
              placeholder='Enter your password'
              required 
            />

            <button
              type='button'
              onClick={() => setShowPassword(!showPassword)}
              className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors'
            >
              {showPassword ? <EyeOff size={18} className='sm:w-5 sm:h-5' /> : <Eye size={18} className='sm:w-5 sm:h-5' />}
            </button>
          </div>
          
          {/* Forgot Password Link */}
          {state === 'Login' && (
            <p
              onClick={() => navigate("/email-verify")}
              className="text-primary text-xs sm:text-sm underline cursor-pointer text-right mt-2 hover:text-primary/80 transition-colors"
            >
              Forgot Password?
            </p>
          )}
        </div>
        
        {/* Submit Button */}
        <button 
          type='submit'
          disabled={loading}
          className={`w-full py-2.5 sm:py-3 rounded-md text-white text-sm sm:text-base font-medium transition-all ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-primary hover:bg-primary/90 active:scale-[0.98]'
          }`}
        >
          {loading 
            ? (state === 'Sign Up' ? 'Creating Account...' : 'Logging in...') 
            : (state === 'Sign Up' ? 'Create Account' : 'Login')
          }
        </button>
        
        {/* Toggle State */}
        <div className='text-center mt-4'>
          {state === 'Sign Up' ? (
            <p className='text-xs sm:text-sm text-gray-600'>
              Already have an account?{' '}
              <span onClick={() => setState('Login')} className='text-primary font-medium underline cursor-pointer hover:text-primary/80 transition-colors'>
                Login here
              </span>
            </p>
          ) : (
            <p className='text-xs sm:text-sm text-gray-600'>
              Don't have an account?{' '}
              <span onClick={() => setState('Sign Up')} className='text-primary font-medium underline cursor-pointer hover:text-primary/80 transition-colors'>
                Sign up here
              </span>
            </p>
          )}
        </div>
        
      </form>
    </div>
  )
}

export default Login
