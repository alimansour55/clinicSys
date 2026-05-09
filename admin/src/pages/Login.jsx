import React, { useContext, useState } from 'react'
import { AdminContext } from '../context/AdminContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { DoctorContext } from '../context/DoctorContext'
import { Eye, EyeOff } from 'lucide-react'
import { ReceptionistContext } from '../context/ReceptionistContext'
import { useNavigate } from 'react-router-dom'
import { LanguageToggle, useLanguage } from '../i18n'
 
const Login = () => {
  
  const [state, setState] = useState('Admin')
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const {setAToken, backendUrl} = useContext(AdminContext)
  const {setDToken} = useContext(DoctorContext)
  const {setRToken} = useContext(ReceptionistContext)
  const { t, isRtl } = useLanguage()
  const navigate = useNavigate()


  const onSubmithandler = async (e) => {
    e.preventDefault()

    try {
     if(state === 'Admin') {
      const { data } = await axios.post(backendUrl + '/api/admin/login', {email, password})
      if(data.success) {
        localStorage.setItem('aToken', data.token)
        setAToken(data.token)
        navigate('/admin-dashboard')
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
      } else {
        toast.error(data.message)
      }
     } else {
      const { data } = await axios.post(backendUrl + '/api/receptionist/login', {email, password})
      if(data.success) {
        localStorage.setItem('rToken', data.token)
        setRToken(data.token)
        navigate('/receptionist-dashboard')
      } else {
        toast.error(data.message)
      }
     }
    } catch (error) {
      toast.error(error.message)
    }
  }


  
  return (
    <form onSubmit={onSubmithandler} className='min-h-[80vh] flex items-center'>
      <div className='flex flex-col gap-3 m-auto items-start p-8 min-w-[340px] sm:min-w-96 border rounded-xl text-[#5E5E5E] text-sm shadow-lg'>
        <div dir='ltr' className='w-full flex justify-end'>
          <LanguageToggle compact />
        </div>
        <p className='text-2xl font-semibold m-auto' ><span className='text-primary'>{t(state)}</span> {t('Login')}</p>
        <div className='w-full'>
          <p>{t('Email')}</p>
          <input onChange={(e) => setEmail(e.target.value)} value={email} className='border border-[#DADADA] rounded w-full p-2 mt-1' type="email" required />
        </div>
        <div className='w-full'>
          <p>{t('Password')}</p>
          <div className='relative' >
          <input onChange={(e) => setPassword(e.target.value)} value={password} className='border border-[#DADADA] rounded w-full p-2 mt-1'
          type={showPassword ? "text" : "password"}
          required 
          />
          <button
            type='button'
            onClick={() => setShowPassword(!showPassword)}
            className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700`}
          >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          </div>
        </div>
        <button className='bg-primary text-white w-full py-2 rounded-md text-base cursor-pointer '>{t('Login')}</button>
        <div className='flex w-full gap-2 pt-1'>
          {['Admin', 'Doctor', 'Receptionist'].map((role) => (
            <button
              key={role}
              type='button'
              onClick={() => setState(role)}
              className={`flex-1 rounded-md border py-2 text-xs font-medium ${state === role ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {t(role)}
            </button>
          ))}
        </div>
      
      </div>
    </form>
  )
}

export default Login
