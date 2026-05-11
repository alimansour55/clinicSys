import React, { useContext } from 'react'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import { Phone, Mail } from 'lucide-react'
import { AppContext } from '../context/AppContext'

const Footer = () => {
  const navigate = useNavigate()
  const { token, t, siteSettings } = useContext(AppContext)
  const footer = siteSettings?.footer || {}
  const description = footer.description || "Simplifying healthcare access through smart appointment management. Book your doctor, anytime, anywhere with Prescripto's intelligent scheduling system. No more long waits or booking hassles - just efficient, reliable, and patient-focused healthcare at your convenience."
  const companyTitle = footer.companyTitle || 'COMPANY'
  const contactTitle = footer.contactTitle || 'GET IN TOUCH'
  const phoneLabel = footer.phoneLabel || 'Phone'
  const phoneNumber = footer.phoneNumber || '+92 343 2705821'
  const emailLabel = footer.emailLabel || 'Email'
  const email = footer.email || 'marqum987@gmail.com'
  const copyrightText = footer.copyrightText || 'Copyright 2026 © Prescripto - All Rights Reserved.'
  const footerLinks = [
    { label: footer.homeLabel || 'Home', path: '/', show: footer.showHomeLink !== false },
    { label: footer.aboutLabel || 'About', path: '/about', show: footer.showAboutLink !== false },
    { label: footer.doctorsLabel || 'All Doctors', path: '/doctors', show: footer.showDoctorsLink !== false },
    { label: footer.contactLabel || 'Contact Us', path: '/contact', show: footer.showContactLink !== false }
  ]
  const patientLinks = [
    { label: footer.appointmentsLabel || 'My Appointments', path: '/my-appointments' },
    { label: footer.profileLabel || 'My Profile', path: '/my-profile' }
  ]
  const showPatientLinks = token && footer.showPatientLinks !== false
  const showPrivacyLink = footer.showPrivacyLink !== false

  const goTo = (path) => {
    navigate(path)
    scrollTo(0, 0)
  }

  return (
    <div className='px-4 sm:px-6 md:px-10'>
      <div className='flex flex-col sm:grid sm:grid-cols-[1.5fr_1fr_1fr] md:grid-cols-[1.5fr_1fr_1fr] gap-8 sm:gap-10 md:gap-14 my-10 mt-20 sm:mt-32 md:mt-40 text-sm'>
        <div>
          <img className='mb-4 sm:mb-5 w-32 sm:w-36 md:w-40 cursor-pointer' src={assets.logo} alt='Prescripto Logo' onClick={() => goTo('/')} />
          <p className='w-full md:w-2/3 text-gray-600 leading-6 text-sm sm:text-base'>
            {t(description)}
          </p>
        </div>

        <div>
          <p className='text-lg sm:text-xl font-medium mb-4 sm:mb-5'>{t(companyTitle)}</p>
          <ul className='flex flex-col gap-2 text-gray-600 text-sm sm:text-base'>
            {footerLinks.filter((link) => link.show).map((link) => (
              <li key={link.path} className='hover:text-gray-900 cursor-pointer transition-colors duration-200' onClick={() => goTo(link.path)}>
                {t(link.label)}
              </li>
            ))}
            {showPatientLinks && patientLinks.map((link) => (
              <li key={link.path} className='hover:text-gray-900 cursor-pointer transition-colors duration-200' onClick={() => goTo(link.path)}>
                {t(link.label)}
              </li>
            ))}
            {showPrivacyLink && (
              <li className='hover:text-gray-900 cursor-pointer transition-colors duration-200' onClick={() => goTo('/')}>
                {t(footer.privacyLabel || 'Privacy Policy')}
              </li>
            )}
          </ul>
        </div>

        <div>
          <p className='text-lg sm:text-xl font-medium mb-4 sm:mb-5'>{t(contactTitle)}</p>
          <ul className='flex flex-col gap-3 sm:gap-4 text-gray-600'>
            <li className='flex items-start gap-2 group'>
              <Phone className='w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-primary mt-1' />
              <div>
                <p className='font-medium text-gray-900 text-xs sm:text-sm md:text-base'>{t(phoneLabel)}</p>
                <a href={`tel:${phoneNumber.replace(/\s/g, '')}`} className='text-gray-600 hover:text-primary transition-colors text-xs sm:text-sm md:text-base'>
                  {phoneNumber}
                </a>
              </div>
            </li>

            <li className='flex items-start gap-2 group'>
              <Mail className='w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-primary mt-1' />
              <div>
                <p className='font-medium text-gray-900 text-xs sm:text-sm md:text-base'>{t(emailLabel)}</p>
                <a href={`mailto:${email}`} className='text-gray-600 hover:text-primary transition-colors break-all text-xs sm:text-sm md:text-base'>
                  {email}
                </a>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div>
        <hr className='border-gray-300' />
        <p className='py-4 sm:py-5 text-xs sm:text-sm text-center text-gray-600'>
          {t(copyrightText)}
        </p>
      </div>
    </div>
  )
}

export default Footer
