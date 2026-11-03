import React, { useContext, useEffect, useMemo } from 'react'
import Login from './pages/Login'
import { toast } from 'react-toastify';
import { ToastViewport } from './components/ui/Toast';
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
import AdminMobileNav from './components/admin/AdminMobileNav';
import CommandPalette from './components/admin/CommandPalette';
import { getAdminSections, isAdminPathActive } from './config/adminNav';
import LanguageSettings from './pages/Admin/LanguageSettings';
import { getPolicyForRole, getStaffLoginLanguagePolicy } from './utils/languageAvailability';
import { LanguageDomSync, LanguagePolicySync, useLanguage } from './i18n';

/** The pages next to this one in the sidebar's section, as tabs. Everything else is one ctrl+K away. */
const AdminOptionsBar = () => {
  const { t } = useLanguage()
  const { pathname } = useLocation()
  const sections = useMemo(() => getAdminSections(t), [t])
  const section = sections.find((item) => item.links.some((link) => isAdminPathActive(pathname, link.path)))
  if (!section) return null

  return (
    <div className='sticky top-0 z-30 hidden border-b border-line bg-canvas px-gutter py-2 md:block'>
      <nav aria-label={section.title} className='mx-auto flex max-w-7xl gap-1 overflow-x-auto'>
        {section.links.map((link) => {
          const active = isAdminPathActive(pathname, link.path)
          const Icon = link.icon
          return (
            <NavLink
              key={link.path}
              to={link.path}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-9 items-center gap-2 whitespace-nowrap rounded-control px-3 text-body-sm font-medium transition duration-(--duration-fast) ease-standard ${
                active ? 'bg-primary-soft text-brand' : 'text-ink-2 hover:bg-surface-sunken hover:text-ink'
              }`}
            >
              <Icon aria-hidden='true' className='size-4' />
              {link.label}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

const App = () => {
  const { aToken, siteSettings } = useContext(AdminContext)
  const { dToken, doctorNavSummary } = useContext(DoctorContext)
  const { rToken, receptionistNavSummary } = useContext(ReceptionistContext)
  const { t } = useLanguage()
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
    <div className='h-dvh overflow-hidden bg-canvas'>
      <LanguagePolicySync policy={activeLanguagePolicy} />
      <LanguageDomSync />
      <ScrollToTop />
      <ToastViewport
        limit={2}
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
        className='relative z-10 min-w-0 max-w-full mt-[4.5rem] h-[calc(100dvh-4.5rem)] overflow-y-auto overflow-x-hidden md:ms-64'
      >
        {aToken && (
          <>
            <AdminMobileNav />
            <AdminOptionsBar />
            <CommandPalette />
          </>
        )}
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
          <Route path='*' element={<Navigate to='/' replace />} />
        </Routes>
      </div>
    </div>
  ) : (
    <>
      <LanguagePolicySync policy={activeLanguagePolicy} />
      <LanguageDomSync />
      <Login />
      <ToastViewport
        limit={2}
        style={{ pointerEvents: 'none' }}
        toastStyle={{ pointerEvents: 'auto' }}
      />
    </>
  )
}

export default App
