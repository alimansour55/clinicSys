import React, { lazy, Suspense, useContext, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AppContext } from './context/AppContext'
import { getPolicyForRole } from './utils/languageAvailability'
import Home from './pages/Home'
import { Route, Routes, useLocation } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import { ToastViewport } from './components/ui/Toast'
import { LanguageDomSync, LanguagePolicySync } from './i18n'
import RouteMeta from './components/discovery/RouteMeta'

/* Home is in the first bundle. Every other page, and the assistant, loads when needed. */
const Doctors = lazy(() => import('./pages/Doctors'))
const Login = lazy(() => import('./pages/Login'))
const MyProfile = lazy(() => import('./pages/MyProfile'))
const Contact = lazy(() => import('./pages/Contact'))
const About = lazy(() => import('./pages/About'))
const MyAppointments = lazy(() => import('./pages/MyAppointments'))
const Appointment = lazy(() => import('./pages/Appointment'))
const EmailVerify = lazy(() => import('./pages/EmailVerify'))
const OtpVerify = lazy(() => import('./pages/OtpVerify'))
const AccountVerify = lazy(() => import('./pages/AccountVerify'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const MedicalHistory = lazy(() => import('./pages/MedicalHistory'))
const Insurance = lazy(() => import('./pages/Insurance'))
const ChatbotWidget = lazy(() => import('./components/Chatbot/ChatbotWidget'))

/* Discovery pages lay out their own full-width sections. The rest keep the original side margins. */
const isFullBleed = (pathname) => pathname === '/' || /^\/(doctors(\/|$)|about$|contact$)/.test(pathname)

const PageFallback = () => (
  <div className='flex min-h-[50vh] items-center justify-center' role='status' aria-live='polite'>
    <span className='size-8 animate-spin rounded-full border-2 border-line border-t-primary' aria-hidden='true' />
  </div>
)

const App = () => {
  const { siteSettings, t } = useContext(AppContext)
  const location = useLocation()

  const patientLanguagePolicy = useMemo(
    () => getPolicyForRole(siteSettings?.languagePolicies, 'patient', siteSettings?.languageAvailability),
    [siteSettings]
  )

  // Filters on /doctors change the path; keep that page mounted so its search box keeps focus.
  const routeKey = location.pathname.startsWith('/doctors') ? '/doctors' : location.pathname

  return (
    <div className='flex min-h-dvh flex-col'>
      <a
        href='#main'
        className='sr-only z-[100] rounded-control bg-primary px-4 py-2 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:start-4 focus:top-4'
      >
        {t('Skip to content')}
      </a>
      <LanguagePolicySync policy={patientLanguagePolicy} />
      <LanguageDomSync />
      <ScrollToTop />
      <RouteMeta />
      {createPortal(<ToastViewport />, document.body)}
      <Navbar />
      <main id='main' tabIndex={-1} className={`flex-1 outline-none ${isFullBleed(location.pathname) ? '' : 'mx-4 sm:mx-[10%]'}`}>
        <Suspense fallback={<PageFallback />}>
          <Routes location={location} key={routeKey}>
            <Route path='/' element={<Home />} />
            <Route path='/doctors' element={<Doctors />} />
            <Route path='/doctors/:speciality' element={<Doctors />} />
            <Route path='/login' element={<Login />} />
            <Route path='/email-verify' element={<EmailVerify />} />
            <Route path='/otp-verify' element={<OtpVerify />} />
            <Route path='/account-verify' element={<AccountVerify />} />
            <Route path='/reset-password' element={<ResetPassword />} />
            <Route path='/about' element={<About />} />
            <Route path='/contact' element={<Contact />} />
            <Route path='/my-profile' element={<MyProfile />} />
            <Route path='/medical-history' element={<MedicalHistory />} />
            <Route path='/insurance' element={<Insurance />} />
            <Route path='/my-appointments' element={<MyAppointments />} />
            <Route path='/appointment/:docId' element={<Appointment />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <Suspense fallback={null}>
        <ChatbotWidget />
      </Suspense>
    </div>
  )
}

export default App
