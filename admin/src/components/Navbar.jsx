import React, { useContext } from 'react'
import { assets } from '../assets/assets'
import { AdminContext } from '../context/AdminContext'
import { useNavigate } from 'react-router-dom'
import { DoctorContext } from '../context/DoctorContext'
import { ReceptionistContext } from '../context/ReceptionistContext'
import { LanguageToggle, useLanguage } from '../i18n'

const Navbar = () => {
  const { aToken, setAToken } = useContext(AdminContext)
  const { dToken, setDToken } = useContext(DoctorContext)
  const { rToken, setRToken } = useContext(ReceptionistContext)
  const { t } = useLanguage()
  
  const navigate = useNavigate()
  
  const logout = () => {
    navigate('/')
    aToken && setAToken('')
    aToken && localStorage.removeItem('aToken')
    dToken && setDToken('')
    dToken && localStorage.removeItem('dToken')
    rToken && setRToken('')
    rToken && localStorage.removeItem('rToken')
  }
  
  return (
    <div dir='ltr' className='fixed top-0 left-0 right-0 z-50 h-16 flex justify-between items-center px-4 md:px-6 py-3 border-b bg-white shadow-sm'>
      <div className='flex items-center gap-2 md:gap-3'>
        <img className='w-28 sm:w-36 md:w-40 cursor-pointer' src={assets.admin_logo} alt="Admin Logo" />
        <p className='border px-2 sm:px-2.5 py-0.5 rounded-full border-gray-500 text-gray-600 text-[10px] sm:text-xs md:text-sm font-medium whitespace-nowrap'>
          {aToken ? t('Admin') : dToken ? t('Doctor') : t('Receptionist')}
        </p>
      </div>

      <div className='flex items-center gap-2 sm:gap-3'>
        <LanguageToggle compact />
        <button onClick={logout} className='bg-primary text-white text-xs sm:text-sm md:text-base px-4 sm:px-6 md:px-10 py-1.5 sm:py-2 rounded-full hover:bg-primary/90 transition-colors font-medium'>
          {t('Logout')}
        </button>
      </div>
    </div>
  )
}

export default Navbar
