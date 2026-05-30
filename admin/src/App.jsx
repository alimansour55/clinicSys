import React, { useContext, useEffect, useMemo } from 'react'
import Login from './pages/Login'
import { ToastContainer, toast } from 'react-toastify';
import { AdminContext } from './context/AdminContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import StaffMobileNav from './components/StaffMobileNav';
import StaffOptionsBar from './components/StaffOptionsBar';
import { getDoctorNavLinks, findActiveDoctorLink } from './config/doctorNav';
import { getReceptionistNavLinks, findActiveReceptionistLink } from './config/receptionistNav';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
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
import DoctorFinancialAnalysis from './pages/Doctor/DoctorFinancialAnalysis';
import AppointmentHistory from './pages/Admin/AppointmentHistory';
import AddReceptionist from './pages/Admin/AddReceptionist';
import ReceptionistList from './pages/Admin/ReceptionistList';
import EditReceptionist from './pages/Admin/EditReceptionist';
import { ReceptionistContext } from './context/ReceptionistContext';
import ReceptionistDashboard from './pages/Receptionist/ReceptionistDashboard';
import ReceptionistAppointments from './pages/Receptionist/ReceptionistAppointments';
import ReceptionistBookAppointment from './pages/Receptionist/ReceptionistBookAppointment';
import ReceptionistPatients from './pages/Receptionist/ReceptionistPatients';
import ReceptionistClinics from './pages/Receptionist/ReceptionistClinics';
import ReceptionistProfile from './pages/Receptionist/ReceptionistProfile';
import AuditLogs from './pages/Admin/AuditLogs';
import Clinics from './pages/Admin/Clinics';
import Users from './pages/Admin/Users';
import HomeHeroSettings from './pages/Admin/HomeHeroSettings';
import HomeBannerSettings from './pages/Admin/HomeBannerSettings';
import HomeServiceCardsSettings from './pages/Admin/HomeServiceCardsSettings';
import FooterSettings from './pages/Admin/FooterSettings';
import LogoSettings from './pages/Admin/LogoSettings';
import InsuranceProvidersSettings from './pages/Admin/InsuranceProvidersSettings';
import SecuritySettings from './pages/Admin/SecuritySettings';
import HomeVisitPricingSettings from './pages/Admin/HomeVisitPricingSettings';
import GlobalVisitFeesSettings from './pages/Admin/GlobalVisitFeesSettings';
import AdminProfile from './pages/Admin/AdminProfile';
import AdminFinancialAnalytics from './pages/Admin/AdminFinancialAnalytics';
import { Building2, CalendarDays, ClipboardList, Globe, HeartHandshake, Image, LayoutTemplate, PanelBottom, ShieldCheck, Stethoscope, UserCog, UserRound, UsersRound, LineChart } from 'lucide-react';
import LanguageSettings from './pages/Admin/LanguageSettings';
import { getPolicyForRole, getStaffLoginLanguagePolicy } from './utils/languageAvailability';
import { LanguageDomSync, LanguagePolicySync, useLanguage } from './i18n';

const AdminOptionsBar = () => {
  const { t } = useLanguage()
  const { pathname } = useLocation()
  /* Same leaf order as the admin sidebar (Overview → Users → Appointments → Page Design → Security) */
  const options = [
    { label: t('Dashboard'), path: '/admin-dashboard', icon: <CalendarDays className='w-4 h-4' />, tone: 'text-blue-700 bg-blue-50 border-blue-100 hover:bg-blue-100', active: 'bg-blue-600 border-blue-600' },
    { label: t('Clinics'), path: '/clinics', icon: <Building2 className='w-4 h-4' />, tone: 'text-emerald-700 bg-emerald-50 border-emerald-100 hover:bg-emerald-100', active: 'bg-emerald-600 border-emerald-600' },
    { label: t('Financial Analytics'), path: '/admin-financial-analytics', icon: <LineChart className='w-4 h-4' />, tone: 'text-indigo-700 bg-indigo-50 border-indigo-100 hover:bg-indigo-100', active: 'bg-indigo-600 border-indigo-600' },
    { label: t('Insurance providers'), path: '/insurance-providers-settings', icon: <HeartHandshake className='w-4 h-4' />, tone: 'text-teal-700 bg-teal-50 border-teal-100 hover:bg-teal-100', active: 'bg-teal-600 border-teal-600' },
    { label: t('Global visit fees'), path: '/global-visit-fees-settings', icon: <Stethoscope className='w-4 h-4' />, tone: 'text-violet-700 bg-violet-50 border-violet-100 hover:bg-violet-100', active: 'bg-violet-600 border-violet-600' },
    { label: t('User languages settings'), path: '/language-settings', icon: <Globe className='w-4 h-4' />, tone: 'text-sky-700 bg-sky-50 border-sky-100 hover:bg-sky-100', active: 'bg-sky-600 border-sky-600' },
    { label: t('User accounts'), path: '/users', icon: <UsersRound className='w-4 h-4' />, tone: 'text-indigo-700 bg-indigo-50 border-indigo-100 hover:bg-indigo-100', active: 'bg-indigo-600 border-indigo-600' },
    {
      label: t('Patients'),
      path: '/patients',
      matchPaths: ['/patients', '/receptionist-patients'],
      icon: <UserRound className='w-4 h-4' />,
      tone: 'text-sky-700 bg-sky-50 border-sky-100 hover:bg-sky-100',
      active: 'bg-sky-600 border-sky-600'
    },
    {
      label: t('Doctors'),
      path: '/doctor-list',
      matchPaths: ['/doctor-list', '/add-doctor'],
      icon: <Stethoscope className='w-4 h-4' />,
      tone: 'text-violet-700 bg-violet-50 border-violet-100 hover:bg-violet-100',
      active: 'bg-violet-600 border-violet-600'
    },
    {
      label: t('Receptionists'),
      path: '/receptionist-list',
      matchPaths: ['/receptionist-list', '/add-receptionist', '/edit-receptionist'],
      icon: <UserCog className='w-4 h-4' />,
      tone: 'text-red-700 bg-red-50 border-red-100 hover:bg-red-100',
      active: 'bg-red-600 border-red-600'
    },
    {
      label: t('Appointments'),
      path: '/all-appointments',
      matchPaths: ['/all-appointments', '/actual-appointments', '/finished-appointments'],
      icon: <ClipboardList className='w-4 h-4' />,
      tone: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-100 hover:bg-fuchsia-100',
      active: 'bg-fuchsia-600 border-fuchsia-600'
    },
    { label: t('Appointment History'), path: '/appointment-history', icon: <ClipboardList className='w-4 h-4' />, tone: 'text-slate-700 bg-slate-100 border-slate-200 hover:bg-slate-200', active: 'bg-slate-700 border-slate-700' },
    { label: t('Site logo'), path: '/site-logo-settings', icon: <Image className='w-4 h-4' />, tone: 'text-purple-700 bg-purple-50 border-purple-100 hover:bg-purple-100', active: 'bg-purple-600 border-purple-600' },
    { label: t('Home Hero'), path: '/home-hero-settings', icon: <LayoutTemplate className='w-4 h-4' />, tone: 'text-cyan-700 bg-cyan-50 border-cyan-100 hover:bg-cyan-100', active: 'bg-cyan-600 border-cyan-600' },
    { label: t('Home Banner'), path: '/home-banner-settings', icon: <LayoutTemplate className='w-4 h-4' />, tone: 'text-teal-700 bg-teal-50 border-teal-100 hover:bg-teal-100', active: 'bg-teal-600 border-teal-600' },
    { label: t('Service Cards'), path: '/home-service-cards-settings', icon: <LayoutTemplate className='w-4 h-4' />, tone: 'text-lime-700 bg-lime-50 border-lime-100 hover:bg-lime-100', active: 'bg-lime-600 border-lime-600' },
    { label: t('Footer'), path: '/footer-settings', icon: <PanelBottom className='w-4 h-4' />, tone: 'text-amber-700 bg-amber-50 border-amber-100 hover:bg-amber-100', active: 'bg-amber-600 border-amber-600' },
    { label: t('Security'), path: '/security-settings', icon: <ShieldCheck className='w-4 h-4' />, tone: 'text-gray-800 bg-gray-100 border-gray-200 hover:bg-gray-200', active: 'bg-gray-800 border-gray-800' },
    { label: t('Audit Logs'), path: '/audit-logs', icon: <ClipboardList className='w-4 h-4' />, tone: 'text-rose-700 bg-rose-50 border-rose-100 hover:bg-rose-100', active: 'bg-rose-600 border-rose-600' }
  ]

  return (
    <div className='sticky top-0 z-30 hidden bg-[#F8F9FD]/95 backdrop-blur border-b border-gray-200 px-3 py-3 sm:px-5 md:block md:px-6 lg:px-8'>
      <div className='flex gap-2 overflow-x-auto'>
        {options.map((option) => {
          const active = option.matchPaths?.length
            ? option.matchPaths.some(
                (p) => pathname === p || pathname.startsWith(`${p}/`)
              )
            : pathname === option.path
          return (
            <NavLink
              key={option.path}
              to={option.path}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap border transition ${
                active ? `${option.active} text-white` : option.tone
              }`}
            >
              {option.icon}
              {option.label}
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}

const App = () => {
  const { aToken, siteSettings } = useContext(AdminContext)
  const { dToken, doctorNavSummary } = useContext(DoctorContext)
  const { rToken, receptionistNavSummary } = useContext(ReceptionistContext)
  const { isRtl, t } = useLanguage()
  const location = useLocation()

  const doctorNavLinks = useMemo(() => getDoctorNavLinks(t), [t])
  const receptionistNavLinks = useMemo(() => getReceptionistNavLinks(t), [t])

  const activeLanguagePolicy = useMemo(() => {
    const legacy = siteSettings?.languageAvailability
    const policies = siteSettings?.languagePolicies
    if (aToken) return getPolicyForRole(policies, 'admin', legacy)
    if (dToken) return getPolicyForRole(policies, 'doctor', legacy)
    if (rToken) return getPolicyForRole(policies, 'receptionist', legacy)
    return getStaffLoginLanguagePolicy(policies, legacy)
  }, [aToken, dToken, rToken, siteSettings])

  useEffect(() => {
    toast.dismiss()
  }, [])

  return aToken || dToken || rToken ? (
    <div className='h-screen overflow-hidden bg-[#F8F9FD]'>
      <LanguagePolicySync policy={activeLanguagePolicy} />
      <LanguageDomSync />
      <ScrollToTop />
      <ToastContainer
        position='top-right'
        limit={2}
        autoClose={3500}
        closeOnClick
        draggable={false}
        style={{ pointerEvents: 'none' }}
        toastStyle={{ pointerEvents: 'auto' }}
      />

      {/* Navbar  */}
      <Navbar />
      
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area - Scrollable */}
      <div
        id='staff-main-scroll'
        className={`relative z-10 min-w-0 max-w-full mt-[4.5rem] h-[calc(100vh-4.5rem)] overflow-y-auto overflow-x-hidden ${
          aToken
            ? 'ml-64'
            : isRtl
              ? 'mr-14 sm:mr-16 md:mr-64'
              : 'ml-14 sm:ml-16 md:ml-64'
        }`}
      >
        {aToken && <AdminOptionsBar />}
        {dToken && (
          <>
            <StaffMobileNav
              links={doctorNavLinks}
              findActiveLink={findActiveDoctorLink}
              navSummary={doctorNavSummary}
              roleLabel={t('Doctor')}
              drawerAriaLabel={t('Doctor navigation')}
            />
            <StaffOptionsBar links={doctorNavLinks} />
          </>
        )}
        {rToken && (
          <>
            <StaffMobileNav
              links={receptionistNavLinks}
              findActiveLink={findActiveReceptionistLink}
              navSummary={receptionistNavSummary}
              roleLabel={t('Receptionist')}
              drawerAriaLabel={t('Receptionist navigation')}
            />
            <StaffOptionsBar links={receptionistNavLinks} />
          </>
        )}
        <Routes key={location.pathname}>
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
          <Route path='/language-settings' element={<LanguageSettings />} />
          <Route path='/all-appointments' element={<AllAppointments />} />
          <Route path='/actual-appointments' element={<AllAppointments />} />
          <Route path='/finished-appointments' element={<AllAppointments />} />
          <Route path='/appointment-history' element={<AppointmentHistory />} />
          <Route path='/add-doctor' element={<AddDoctor />} />
          <Route path='/doctor-list' element={<DoctorsList />} />
          <Route path='/users' element={<Users />} />
          <Route path='/patients' element={<ReceptionistPatients />} />
          <Route path='/clinics' element={<Clinics />} />
          <Route path='/admin-financial-analytics' element={<AdminFinancialAnalytics />} />
          <Route path='/site-logo-settings' element={<LogoSettings />} />
          <Route path='/home-hero-settings' element={<HomeHeroSettings />} />
          <Route path='/home-banner-settings' element={<HomeBannerSettings />} />
          <Route path='/home-service-cards-settings' element={<HomeServiceCardsSettings />} />
          <Route path='/footer-settings' element={<FooterSettings />} />
          <Route path='/insurance-providers-settings' element={<InsuranceProvidersSettings />} />
          <Route path='/admin-profile' element={<AdminProfile />} />
          <Route path='/security-settings' element={<SecuritySettings />} />
          <Route path='/home-visit-pricing-settings' element={<HomeVisitPricingSettings />} />
          <Route path='/global-visit-fees-settings' element={<GlobalVisitFeesSettings />} />
          <Route path='/add-receptionist' element={<AddReceptionist />} />
          <Route path='/receptionist-list' element={<ReceptionistList />} />
          <Route path='/edit-receptionist/:receptionistId' element={<EditReceptionist />} />
          <Route path='/audit-logs' element={<AuditLogs />} />
          
          {/* Doctor Routes */}
          <Route path='/doctor-dashboard' element={<DoctorDashboard />} />
          <Route path='/doctor-appointments' element={<DoctorAppointments />} />
          <Route path='/doctor-profile' element={<DoctorProfile />} />
          <Route path='/patient-history' element={<PatientHistory />} />
          <Route path='/doctor-availability' element={<DoctorAvailability />} />
          <Route path='/doctor-financial-analysis' element={<DoctorFinancialAnalysis />} />

          {/* Receptionist Routes */}
          <Route path='/receptionist-dashboard' element={<ReceptionistDashboard />} />
          <Route path='/receptionist-appointments' element={<ReceptionistAppointments />} />
          <Route path='/receptionist-book-appointment' element={<ReceptionistBookAppointment />} />
          <Route path='/receptionist-patients' element={<ReceptionistPatients />} />
          <Route path='/receptionist-clinics' element={<ReceptionistClinics />} />
          <Route path='/receptionist-profile' element={<ReceptionistProfile />} />
        </Routes>
      </div>
    </div>
  ) : (
    <>
      <LanguagePolicySync policy={activeLanguagePolicy} />
      <LanguageDomSync />
      <Login />
      <ToastContainer
        position='top-right'
        limit={2}
        autoClose={3500}
        closeOnClick
        draggable={false}
        style={{ pointerEvents: 'none' }}
        toastStyle={{ pointerEvents: 'auto' }}
      />
    </>
  )
}

export default App
