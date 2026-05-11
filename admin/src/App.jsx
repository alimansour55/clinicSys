import React, { useContext } from 'react'
import Login from './pages/Login'
import { ToastContainer } from 'react-toastify';
import { AdminContext } from './context/AdminContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import Dashboad from './pages/Admin/Dashboad';
import AllAppointments from './pages/Admin/AllAppointments';
import AddDoctor from './pages/Admin/AddDoctor';
import DoctorsList from './pages/Admin/DoctorsList';
import { DoctorContext } from './context/DoctorContext';
import DoctorDashboard from './pages/Doctor/DoctorDashboard';
import DoctorAppointments from './pages/Doctor/DoctorAppointments';
import PatientHistory from './pages/Doctor/PatientHistory';
import DoctorProfile from './pages/Doctor/DoctorProfile';
import DoctorAvailability from './pages/Doctor/DoctorAvailability';
import AppointmentHistory from './pages/Admin/AppointmentHistory';
import AddReceptionist from './pages/Admin/AddReceptionist';
import ReceptionistList from './pages/Admin/ReceptionistList';
import { ReceptionistContext } from './context/ReceptionistContext';
import ReceptionistDashboard from './pages/Receptionist/ReceptionistDashboard';
import ReceptionistAppointments from './pages/Receptionist/ReceptionistAppointments';
import ReceptionistBookAppointment from './pages/Receptionist/ReceptionistBookAppointment';
import AuditLogs from './pages/Admin/AuditLogs';
import Clinics from './pages/Admin/Clinics';
import Patients from './pages/Admin/Patients';
import HomeHeroSettings from './pages/Admin/HomeHeroSettings';
import HomeBannerSettings from './pages/Admin/HomeBannerSettings';
import HomeServiceCardsSettings from './pages/Admin/HomeServiceCardsSettings';
import FooterSettings from './pages/Admin/FooterSettings';
import { Building2, CalendarDays, ClipboardList, LayoutTemplate, PanelBottom, ShieldCheck, Stethoscope, UserPlus, UserRound, UsersRound } from 'lucide-react';
import { LanguageDomSync, useLanguage } from './i18n';

const AdminOptionsBar = () => {
  const { t } = useLanguage()
  const options = [
    { label: t('Dashboard'), path: '/admin-dashboard', icon: <CalendarDays className='w-4 h-4' /> },
    { label: t('Patients'), path: '/patients', icon: <UserRound className='w-4 h-4' /> },
    { label: t('Doctors'), path: '/doctor-list', icon: <Stethoscope className='w-4 h-4' /> },
    { label: t('Appointments'), path: '/all-appointments', icon: <ClipboardList className='w-4 h-4' /> },
    { label: t('Clinics'), path: '/clinics', icon: <Building2 className='w-4 h-4' /> },
    { label: t('Home Hero'), path: '/home-hero-settings', icon: <LayoutTemplate className='w-4 h-4' /> },
    { label: t('Home Banner'), path: '/home-banner-settings', icon: <LayoutTemplate className='w-4 h-4' /> },
    { label: t('Service Cards'), path: '/home-service-cards-settings', icon: <LayoutTemplate className='w-4 h-4' /> },
    { label: t('Footer'), path: '/footer-settings', icon: <PanelBottom className='w-4 h-4' /> },
    { label: t('Add Doctor'), path: '/add-doctor', icon: <UserPlus className='w-4 h-4' /> },
    { label: t('Receptionists'), path: '/receptionist-list', icon: <UsersRound className='w-4 h-4' /> },
    { label: t('Audit'), path: '/audit-logs', icon: <ShieldCheck className='w-4 h-4' /> }
  ]

  return (
    <div className='sticky top-0 z-30 bg-[#F8F9FD]/95 backdrop-blur border-b border-gray-200 px-3 sm:px-5 md:px-6 lg:px-8 py-3'>
      <div className='flex gap-2 overflow-x-auto'>
        {options.map((option) => (
          <NavLink
            key={option.path}
            to={option.path}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap border transition ${
                isActive
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`
            }
          >
            {option.icon}
            {option.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

const App = () => {
  const { aToken } = useContext(AdminContext)
  const { dToken } = useContext(DoctorContext)
  const { rToken } = useContext(ReceptionistContext)
  const { isRtl } = useLanguage()

  return aToken || dToken || rToken ? (
    <div className='h-screen overflow-hidden bg-[#F8F9FD]'>
      <LanguageDomSync />
      <ToastContainer />
      
      {/* Navbar  */}
      <Navbar />
      
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area - Scrollable */}
      <div className={`${isRtl ? 'mr-14 sm:mr-16 md:mr-64' : 'ml-14 sm:ml-16 md:ml-64'} mt-16 h-[calc(100vh-4rem)] overflow-y-auto`}>
        {aToken && <AdminOptionsBar />}
        <Routes>
          {/* Admin Routes */}
          <Route
            path='/'
            element={
              aToken
                ? <Navigate to='/admin-dashboard' replace />
                : dToken
                  ? <Navigate to='/doctor-dashboard' replace />
                  : <Navigate to='/receptionist-dashboard' replace />
            }
          />
          <Route path='/admin-dashboard' element={<Dashboad />} />
          <Route path='/all-appointments' element={<AllAppointments />} />
          <Route path='/appointment-history' element={<AppointmentHistory />} />
          <Route path='/add-doctor' element={<AddDoctor />} />
          <Route path='/doctor-list' element={<DoctorsList />} />
          <Route path='/patients' element={<Patients />} />
          <Route path='/clinics' element={<Clinics />} />
          <Route path='/home-hero-settings' element={<HomeHeroSettings />} />
          <Route path='/home-banner-settings' element={<HomeBannerSettings />} />
          <Route path='/home-service-cards-settings' element={<HomeServiceCardsSettings />} />
          <Route path='/footer-settings' element={<FooterSettings />} />
          <Route path='/add-receptionist' element={<AddReceptionist />} />
          <Route path='/receptionist-list' element={<ReceptionistList />} />
          <Route path='/audit-logs' element={<AuditLogs />} />
          
          {/* Doctor Routes */}
          <Route path='/doctor-dashboard' element={<DoctorDashboard />} />
          <Route path='/doctor-appointments' element={<DoctorAppointments />} />
          <Route path='/doctor-profile' element={<DoctorProfile />} />
          <Route path='/patient-history' element={<PatientHistory />} />
          <Route path='/doctor-availability' element={<DoctorAvailability />} />

          {/* Receptionist Routes */}
          <Route path='/receptionist-dashboard' element={<ReceptionistDashboard />} />
          <Route path='/receptionist-appointments' element={<ReceptionistAppointments />} />
          <Route path='/receptionist-book-appointment' element={<ReceptionistBookAppointment />} />
        </Routes>
      </div>
    </div>
  ) : (
    <>
      <LanguageDomSync />
      <Login />
      <ToastContainer />
    </>
  )
}

export default App
