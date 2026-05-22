import React, { useContext, useMemo } from 'react'
import { AppContext } from './context/AppContext'
import { getPolicyForRole } from './utils/languageAvailability'
import Home from './pages/Home'
import { Route, Routes, useLocation } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import Doctors from './pages/Doctors'
import Login from './pages/Login'
import MyProfile from './pages/MyProfile'
import Contact from './pages/Contact'
import About from './pages/About'
import MyAppointments from './pages/MyAppointments'
import Appointment from './pages/Appointment'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import { ToastContainer } from 'react-toastify'
import EmailVerify from './pages/EmailVerify'
import OtpVerify from './pages/OtpVerify'
import AccountVerify from './pages/AccountVerify'
import ResetPassword from './pages/ResetPassword'
import MedicalHistory from './pages/MedicalHistory'
import Insurance from './pages/Insurance'
import { LanguageDomSync, LanguagePolicySync } from './i18n'

const App = () => {
  const { siteSettings } = useContext(AppContext)
  const location = useLocation()

  const patientLanguagePolicy = useMemo(
    () => getPolicyForRole(siteSettings?.languagePolicies, 'patient', siteSettings?.languageAvailability),
    [siteSettings]
  )

  return (
    <div className='mx-4 sm:mx-[10%]'>
      <LanguagePolicySync policy={patientLanguagePolicy} />
      <LanguageDomSync />
      <ScrollToTop />
      <ToastContainer position='top-right' />
      <Navbar />
      {/* Add routes to file and import it here */}
      <Routes location={location} key={location.pathname}>
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
      <Footer />
    </div>
  )
}

export default App
