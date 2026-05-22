import React, { useContext, useMemo, useState } from 'react'
import { AdminContext } from '../context/AdminContext'
import { useLocation } from 'react-router-dom'
import StaffNavButton from './StaffNavButton'
import { assets } from '../assets/assets'
import { DoctorContext } from '../context/DoctorContext'
import { BarChart3, Building2, CalendarCheck2, CalendarClock, CalendarPlus, ChevronDown, ClipboardList, Globe, HeartHandshake, Home, Image, LayoutDashboard, LayoutTemplate, PanelBottom, ShieldCheck, Stethoscope, UserCog, UserRound, UsersRound, Wallet } from 'lucide-react'
import { ReceptionistContext } from '../context/ReceptionistContext'
import { useLanguage } from '../i18n'

const Sidebar = () => {
  const { aToken } = useContext(AdminContext)
  const { dToken } = useContext(DoctorContext)
  const { rToken } = useContext(ReceptionistContext)
  const { isRtl } = useLanguage()
  const location = useLocation()
  const [openAdminSections, setOpenAdminSections] = useState({})

  const iconClass = 'w-5 sm:w-5 md:w-5 flex-shrink-0'
  const adminSections = [
    {
      title: 'Overview',
      icon: <LayoutDashboard className={iconClass} />,
      links: [
        { label: 'Dashboard', path: '/admin-dashboard', icon: <img className='w-4 sm:w-5 md:w-5 flex-shrink-0' src={assets.home_icon} alt="Dashboard" /> },
        { label: 'Clinics', path: '/clinics', icon: <Building2 className={iconClass} /> },
        { label: 'Financial Analytics', path: '/admin-financial-analytics', icon: <BarChart3 className={iconClass} /> },
        { label: 'Insurance providers', path: '/insurance-providers-settings', icon: <HeartHandshake className={iconClass} /> },
        { label: 'Home visit pricing', path: '/home-visit-pricing-settings', icon: <Home className={iconClass} /> },
        { label: 'Global visit fees', path: '/global-visit-fees-settings', icon: <Wallet className={iconClass} /> },
        { label: 'User languages', path: '/language-settings', icon: <Globe className={iconClass} /> }
      ]
    },
    {
      title: 'Users',
      icon: <UsersRound className={iconClass} />,
      links: [
        { label: 'All Users', path: '/users', icon: <UsersRound className={iconClass} /> },
        { label: 'Patients', path: '/patients', icon: <UserRound className={iconClass} /> },
        { label: 'Doctors', path: '/doctor-list', icon: <Stethoscope className={iconClass} /> },
        { label: 'Receptionists', path: '/receptionist-list', icon: <UserCog className={iconClass} /> }
      ]
    },
    {
      title: 'Appointments',
      icon: <CalendarClock className={iconClass} />,
      links: [
        { label: 'All Appointments', path: '/all-appointments', icon: <ClipboardList className={iconClass} /> },
        { label: 'Actual Appointments', path: '/actual-appointments', icon: <CalendarPlus className={iconClass} /> },
        { label: 'Finished Appointments', path: '/finished-appointments', icon: <CalendarCheck2 className={iconClass} /> }
      ]
    },
    {
      title: 'Page Design',
      icon: <LayoutTemplate className={iconClass} />,
      links: [
        { label: 'Site logo', path: '/site-logo-settings', icon: <Image className={iconClass} /> },
        { label: 'Home Hero', path: '/home-hero-settings', icon: <LayoutTemplate className={iconClass} /> },
        { label: 'Home Banner', path: '/home-banner-settings', icon: <LayoutTemplate className={iconClass} /> },
        { label: 'Service Cards', path: '/home-service-cards-settings', icon: <LayoutTemplate className={iconClass} /> },
        { label: 'Footer', path: '/footer-settings', icon: <PanelBottom className={iconClass} /> }
      ]
    },
    {
      title: 'Security Options',
      icon: <ShieldCheck className={iconClass} />,
      links: [
        { label: 'Security', path: '/security-settings', icon: <ShieldCheck className={iconClass} /> },
        { label: 'Audit Logs', path: '/audit-logs', icon: <ClipboardList className={iconClass} /> }
      ]
    }
  ]

  const isPathActive = (path) => {
    if (path === '/doctor-list') {
      return location.pathname === '/doctor-list' || location.pathname === '/add-doctor'
    }
    if (path === '/receptionist-list') {
      return (
        location.pathname === '/receptionist-list' ||
        location.pathname === '/add-receptionist' ||
        location.pathname.startsWith('/edit-receptionist/')
      )
    }
    if (path === '/patients') {
      return location.pathname === '/patients' || location.pathname === '/receptionist-patients'
    }
    return location.pathname === path
  }
  const sectionHasActiveLink = (section) => section.links.some((link) => isPathActive(link.path))
  const activeAdminSection = useMemo(() => adminSections.find((section) => sectionHasActiveLink(section))?.title, [location.pathname])
  const isSectionOpen = (section) => openAdminSections[section.title] ?? section.title === activeAdminSection
  const toggleSection = (sectionTitle) => {
    setOpenAdminSections((previous) => ({
      ...previous,
      [sectionTitle]: !(previous[sectionTitle] ?? sectionTitle === activeAdminSection)
    }))
  }

  const adminNavInactiveClass =
    'flex w-full items-center gap-2 rounded-lg py-2.5 px-2 text-left transition-colors text-gray-600 hover:bg-gray-50 hover:text-gray-950 md:gap-3 md:px-3'
  const adminNavActiveClass =
    'flex w-full items-center gap-2 rounded-lg bg-primary py-2.5 px-2 text-left text-white shadow-sm transition-colors md:gap-3 md:px-3'
  const staffRowInactiveClass =
    'flex w-full cursor-pointer items-center gap-2 py-3 text-left text-[#515151] transition-colors hover:bg-gray-50 md:gap-3 md:py-3.5 md:px-6'
  const staffRowActiveClass = `${staffRowInactiveClass} bg-[#F2F3FF] border-r-4 border-primary`

  return (
    <div className={`fixed ${isRtl ? 'right-0 border-l' : 'left-0 border-r'} top-[4.5rem] bottom-0 w-14 sm:w-16 md:w-64 bg-white overflow-y-auto z-40`}>
      {aToken && (
        <div className='px-2 py-4 text-sm'>
          <nav className='space-y-4'>
            {adminSections.map((section) => {
              const activeSection = sectionHasActiveLink(section)
              const openSection = isSectionOpen(section)

              return (
                <div key={section.title} className='space-y-1'>
                  <button
                    type='button'
                    onClick={() => toggleSection(section.title)}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-left transition md:justify-between md:px-3 ${
                      activeSection
                        ? 'bg-[#F2F3FF] text-primary'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950'
                    }`}
                  >
                    <span className='flex min-w-0 items-center gap-2'>
                      {section.icon}
                      <span className='hidden truncate text-sm font-semibold md:block'>{section.title}</span>
                    </span>
                    <ChevronDown className={`hidden h-4 w-4 shrink-0 transition-transform md:block ${openSection ? 'rotate-180' : ''}`} />
                  </button>
                  {openSection && (
                    <ul className='space-y-1 border-l border-gray-100 pl-2 md:ml-5'>
                      {section.links.map((link) => (
                        <li key={link.path}>
                          <StaffNavButton
                            to={link.path}
                            inactiveClassName={adminNavInactiveClass}
                            activeClassName={adminNavActiveClass}
                          >
                            {link.icon}
                            <span className='hidden truncate md:block'>{link.label}</span>
                          </StaffNavButton>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </nav>
        </div>
      )}

      {dToken && (
        <ul className='text-[#515151] mt-5'>
          <li>
            <StaffNavButton
              to='/doctor-dashboard'
              inactiveClassName={staffRowInactiveClass}
              activeClassName={staffRowActiveClass}
            >
              <img className='w-4 sm:w-5 md:w-6 flex-shrink-0' src={assets.home_icon} alt='Dashboard' />
              <p className='hidden md:block text-sm lg:text-base'>Dashboard</p>
            </StaffNavButton>
          </li>
          <li>
            <StaffNavButton
              to='/doctor-appointments'
              inactiveClassName={staffRowInactiveClass}
              activeClassName={staffRowActiveClass}
            >
              <img className='w-4 sm:w-5 md:w-6 flex-shrink-0' src={assets.appointment_icon} alt='Appointments' />
              <p className='hidden md:block text-sm lg:text-base'>Appointments</p>
            </StaffNavButton>
          </li>
          <li>
            <StaffNavButton
              to='/patient-history'
              inactiveClassName={staffRowInactiveClass}
              activeClassName={staffRowActiveClass}
            >
              <ClipboardList className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
              <p className='hidden md:block text-sm lg:text-base'>Patient History</p>
            </StaffNavButton>
          </li>
          <li>
            <StaffNavButton
              to='/doctor-availability'
              inactiveClassName={staffRowInactiveClass}
              activeClassName={staffRowActiveClass}
            >
              <CalendarClock className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
              <p className='hidden md:block text-sm lg:text-base'>Availability</p>
            </StaffNavButton>
          </li>
          <li>
            <StaffNavButton
              to='/doctor-financial-analysis'
              inactiveClassName={staffRowInactiveClass}
              activeClassName={staffRowActiveClass}
            >
              <BarChart3 className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
              <p className='hidden md:block text-sm lg:text-base'>Financial Analysis</p>
            </StaffNavButton>
          </li>
          <li>
            <StaffNavButton
              to='/doctor-profile'
              inactiveClassName={staffRowInactiveClass}
              activeClassName={staffRowActiveClass}
            >
              <img className='w-4 sm:w-5 md:w-6 flex-shrink-0' src={assets.people_icon} alt='Profile' />
              <p className='hidden md:block text-sm lg:text-base'>Profile</p>
            </StaffNavButton>
          </li>
        </ul>
      )}

      {rToken && (
        <ul className='text-[#515151] mt-5'>
          <li>
            <StaffNavButton
              to='/receptionist-dashboard'
              inactiveClassName={staffRowInactiveClass}
              activeClassName={staffRowActiveClass}
            >
              <img className='w-4 sm:w-5 md:w-6 flex-shrink-0' src={assets.home_icon} alt='Dashboard' />
              <p className='hidden md:block text-sm lg:text-base'>Dashboard</p>
            </StaffNavButton>
          </li>
          <li>
            <StaffNavButton
              to='/receptionist-appointments'
              inactiveClassName={staffRowInactiveClass}
              activeClassName={staffRowActiveClass}
            >
              <ClipboardList className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
              <p className='hidden md:block text-sm lg:text-base'>Appointments</p>
            </StaffNavButton>
          </li>
          <li>
            <StaffNavButton
              to='/receptionist-book-appointment'
              inactiveClassName={staffRowInactiveClass}
              activeClassName={staffRowActiveClass}
            >
              <CalendarPlus className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
              <p className='hidden md:block text-sm lg:text-base'>Book Appointment</p>
            </StaffNavButton>
          </li>
          <li>
            <StaffNavButton
              to='/receptionist-patients'
              inactiveClassName={staffRowInactiveClass}
              activeClassName={staffRowActiveClass}
            >
              <UserRound className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
              <p className='hidden md:block text-sm lg:text-base'>All Patients</p>
            </StaffNavButton>
          </li>
          <li>
            <StaffNavButton
              to='/receptionist-clinics'
              inactiveClassName={staffRowInactiveClass}
              activeClassName={staffRowActiveClass}
            >
              <Stethoscope className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
              <p className='hidden md:block text-sm lg:text-base'>Clinics</p>
            </StaffNavButton>
          </li>
          <li>
            <StaffNavButton
              to='/receptionist-profile'
              inactiveClassName={staffRowInactiveClass}
              activeClassName={staffRowActiveClass}
            >
              <img className='w-4 sm:w-5 md:w-6 flex-shrink-0' src={assets.people_icon} alt='My profile' />
              <p className='hidden md:block text-sm lg:text-base'>My Profile</p>
            </StaffNavButton>
          </li>
        </ul>
      )}
      
    </div>
  )
}

export default Sidebar
