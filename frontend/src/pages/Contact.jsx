import React, { useContext } from 'react'
import { assets } from '../assets/assets'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'

const DEFAULT_CONTACT_PHONE = '+20 101 881 1142'
const DEFAULT_CONTACT_EMAIL = 'contact@clinivo.com'

const Contact = () => {
  const { siteSettings } = useContext(AppContext)
  const { t } = useLanguage()
  const footer = siteSettings?.footer || {}
  const phoneNumber = footer.phoneNumber || DEFAULT_CONTACT_PHONE
  const email = footer.email || DEFAULT_CONTACT_EMAIL

  return (
    <div>
      <div className='text-center text-2xl pt-10 text-gray-500'>
        <p>
          {t('Contact page title prefix')}{' '}
          <span className='text-gray-700 font-semibold'>{t('Contact page title emphasis')}</span>
        </p>
      </div>

      <div className='my-10 flex flex-col justify-center md:flex-row gap-10 mb-28 text-sm'>
        <img
          className='w-full md:max-w-[360px] rounded-lg shadow-lg'
          src={assets.contact_image}
          alt=''
        />
        <div className='flex flex-col justify-center items-start gap-6'>
          <p className='font-semibold text-lg text-gray-600'>{t('Our Office')}</p>
          <p className='text-gray-500'>
            {t('Building 18, El Teseen Street')}
            <br />
            {t('New Cairo, Cairo, Egypt')}
          </p>
          <p className='text-gray-500'>
            {t('Tel:')} {phoneNumber}
            <br />
            {t('Email:')} {email}
          </p>
          <p className='font-semibold text-lg text-gray-600'>{t('Emergency Support')}</p>
          <p className='text-gray-500'>
            {t('For urgent medical assistance, please call:')}
            <br />
            <span className='font-semibold text-gray-700'>{phoneNumber}</span>{' '}
            {t('(24/7 Support)')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default Contact
