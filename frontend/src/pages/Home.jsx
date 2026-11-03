import React, { useContext } from 'react'
import Header from '../components/Header'
import SpecialityMenu from '../components/SpecialityMenu'
import TopDoctors from '../components/TopDoctors'
import Banner from '../components/Banner'
import HomeMobileDock from '../components/HomeMobileDock'
import { AppContext } from '../context/AppContext'
import { useDoctorCatalog } from '../components/discovery/useDoctorCatalog'
import { usePageMeta } from '../components/discovery/usePageMeta'

const Home = () => {
  const { t, language } = useContext(AppContext)
  // Computed once here and shared, because every section reads the same openings
  const catalog = useDoctorCatalog()

  usePageMeta({
    title: '',
    description: t('Find the right doctor and book a real open time: at the clinic, by phone, by video or at home. In English and Arabic.'),
    path: '/',
    language,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'MedicalOrganization',
      name: 'Clinivo',
      url: window.location.origin,
      availableLanguage: ['en', 'ar'],
      potentialAction: {
        '@type': 'SearchAction',
        target: `${window.location.origin}/doctors?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  })

  return (
    <div className='overflow-x-clip'>
      <Header catalog={catalog} />
      <SpecialityMenu catalog={catalog} />
      <TopDoctors catalog={catalog} />
      <Banner catalog={catalog} />
      <HomeMobileDock />
    </div>
  )
}

export default Home
