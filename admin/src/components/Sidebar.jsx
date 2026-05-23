import React, { useContext, useMemo, useState } from 'react'
import { AdminContext } from '../context/AdminContext'
import { useLocation } from 'react-router-dom'
import StaffNavButton from './StaffNavButton'
import { assets } from '../assets/assets'
import { DoctorContext } from '../context/DoctorContext'
import { BarChart3, CalendarClock, CalendarPlus, ChevronDown, ClipboardList, Menu, PanelLeftClose, Stethoscope, UserCog, UserRound } from 'lucide-react'
import { ReceptionistContext } from '../context/ReceptionistContext'
import { useLanguage } from '../i18n'
import { ADMIN_ICON_CLASS, getAdminSections, isAdminPathActive } from '../config/adminNav'

const Sidebar = ({ adminNavExpanded = false, onAdminNavExpandedChange }) => {
  const { aToken } = useContext(AdminContext)
  const { dToken } = useContext(DoctorContext)
  const { rToken } = useContext(ReceptionistContext)
  const { isRtl, t } = useLanguage()
  const location = useLocation()
  const [openAdminSections, setOpenAdminSections] = useState({})

  const adminSections = useMemo(() => getAdminSections(t), [t])
  const adminFlatLinks = useMemo(
    () =>
      adminSections.flatMap((section) =>
        section.links.map((link) => ({ ...link, sectionTitle: section.title }))
      ),
    [adminSections]
  )

  const collapseAdminNav = () => onAdminNavExpandedChange?.(false)
  const expandAdminNav = () => onAdminNavExpandedChange?.(true)
  const toggleAdminNav = () => (adminNavExpanded ? collapseAdminNav() : expandAdminNav())

  const sectionHasActiveLink = (section) =>
    section.links.some((link) => isAdminPathActive(location.pathname, link.path))

  const activeAdminSection = useMemo(
    () => adminSections.find((section) => sectionHasActiveLink(section))?.title,
    [location.pathname, adminSections]
  )

  const isSectionOpen = (section) => openAdminSections[section.title] ?? section.title === activeAdminSection

  const toggleSection = (sectionTitle) => {
    setOpenAdminSections((previous) => ({
      ...previous,
      [sectionTitle]: !(previous[sectionTitle] ?? sectionTitle === activeAdminSection)
    }))
  }

  const adminNavInactiveClass = adminNavExpanded
    ? 'flex w-full items-center gap-3 rounded-lg py-2.5 px-3 text-left transition-colors text-gray-600 hover:bg-gray-50 hover:text-gray-950'
    : 'flex w-full items-center justify-center rounded-lg py-2.5 px-2 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-950'
  const adminNavActiveClass = adminNavExpanded
    ? 'flex w-full items-center gap-3 rounded-lg bg-primary py-2.5 px-3 text-left text-white shadow-sm transition-colors'
    : 'flex w-full items-center justify-center rounded-lg bg-primary py-2.5 px-2 text-white shadow-sm transition-colors'

  const staffRowInactiveClass =
    'flex w-full cursor-pointer items-center justify-center gap-2 py-3 text-left text-[#515151] transition-colors hover:bg-gray-50 md:justify-start md:gap-3 md:py-3.5 md:px-6'
  const staffRowActiveClass = `${staffRowInactiveClass} bg-[#F2F3FF] border-r-4 border-primary`

  const sidebarPosition = isRtl ? 'right-0 border-l' : 'left-0 border-r'
  const adminWidthClass = adminNavExpanded ? 'w-64' : 'w-14'
  const staffWidthClass = 'w-14 sm:w-16 md:w-64'

  const renderAdminLinkIcon = (link) => {
    const LinkIcon = link.icon
    if (link.path === '/admin-dashboard') {
      return <img className='h-5 w-5 shrink-0' src={assets.home_icon} alt='' />
    }
    return <LinkIcon className={ADMIN_ICON_CLASS} />
  }

  return (
    <>
      {aToken && adminNavExpanded && (
        <button
          type='button'
          className='fixed inset-0 z-30 bg-gray-950/40 md:hidden'
          aria-label={t('Close')}
          onClick={collapseAdminNav}
        />
      )}

      <div
        className={`fixed ${sidebarPosition} top-[4.5rem] bottom-0 z-40 overflow-hidden border-gray-200 bg-white transition-[width] duration-200 ease-out ${
          aToken ? `${adminWidthClass} block` : `hidden md:block ${staffWidthClass}`
        }`}
      >
        {aToken && (
          <div className='flex h-full flex-col'>
            <div className={`shrink-0 border-b border-gray-100 p-2 ${adminNavExpanded ? 'px-3' : ''}`}>
              <button
                type='button'
                onClick={toggleAdminNav}
                className={`flex w-full items-center rounded-lg py-2.5 text-gray-700 transition hover:bg-gray-50 active:bg-gray-100 ${
                  adminNavExpanded ? 'justify-between gap-2 px-3' : 'justify-center px-2'
                }`}
                aria-expanded={adminNavExpanded}
                aria-label={adminNavExpanded ? t('Close') : t('Menu')}
              >
                {adminNavExpanded ? (
                  <>
                    <span className='flex items-center gap-2 text-sm font-semibold'>
                      <PanelLeftClose className='h-5 w-5 shrink-0 text-primary' />
                      {t('Close')}
                    </span>
                  </>
                ) : (
                  <Menu className='h-5 w-5 shrink-0 text-primary' />
                )}
              </button>
            </div>

            <div className='flex-1 overflow-y-auto overscroll-contain px-2 py-3'>
              {adminNavExpanded ? (
                <nav className='space-y-4 text-sm'>
                  {adminSections.map((section) => {
                    const activeSection = sectionHasActiveLink(section)
                    const openSection = isSectionOpen(section)
                    const SectionIcon = section.icon

                    return (
                      <div key={section.title} className='space-y-1'>
                        <button
                          type='button'
                          onClick={() => toggleSection(section.title)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition ${
                            activeSection
                              ? 'bg-[#F2F3FF] text-primary'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950'
                          }`}
                        >
                          <span className='flex min-w-0 items-center gap-2'>
                            <SectionIcon className={ADMIN_ICON_CLASS} />
                            <span className='truncate text-sm font-semibold'>{section.title}</span>
                          </span>
                          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${openSection ? 'rotate-180' : ''}`} />
                        </button>
                        {openSection && (
                          <ul className='ml-5 space-y-1 border-l border-gray-100 pl-2'>
                            {section.links.map((link) => (
                              <li key={link.path}>
                                <StaffNavButton
                                  to={link.path}
                                  onAfterNavigate={collapseAdminNav}
                                  inactiveClassName={adminNavInactiveClass}
                                  activeClassName={adminNavActiveClass}
                                  title={link.label}
                                >
                                  {renderAdminLinkIcon(link)}
                                  <span className='truncate'>{link.label}</span>
                                </StaffNavButton>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </nav>
              ) : (
                <nav className='space-y-1 text-sm' aria-label={t('Admin navigation')}>
                  {adminFlatLinks.map((link) => (
                      <StaffNavButton
                        key={link.path}
                        to={link.path}
                        onAfterNavigate={collapseAdminNav}
                        inactiveClassName={adminNavInactiveClass}
                        activeClassName={adminNavActiveClass}
                        title={link.label}
                      >
                        {renderAdminLinkIcon(link)}
                        <span className='sr-only'>{link.label}</span>
                      </StaffNavButton>
                  ))}
                </nav>
              )}
            </div>
          </div>
        )}

        {dToken && (
          <ul className='mt-5 overflow-y-auto text-[#515151]'>
            <li>
              <StaffNavButton to='/doctor-dashboard' inactiveClassName={staffRowInactiveClass} activeClassName={staffRowActiveClass}>
                <img className='w-4 sm:w-5 md:w-6 shrink-0' src={assets.home_icon} alt='Dashboard' />
                <p className='hidden md:block text-sm lg:text-base'>Dashboard</p>
              </StaffNavButton>
            </li>
            <li>
              <StaffNavButton to='/doctor-appointments' inactiveClassName={staffRowInactiveClass} activeClassName={staffRowActiveClass}>
                <img className='w-4 sm:w-5 md:w-6 shrink-0' src={assets.appointment_icon} alt='Appointments' />
                <p className='hidden md:block text-sm lg:text-base'>Appointments</p>
              </StaffNavButton>
            </li>
            <li>
              <StaffNavButton to='/patient-history' inactiveClassName={staffRowInactiveClass} activeClassName={staffRowActiveClass}>
                <ClipboardList className='w-5 sm:w-5 md:w-6 shrink-0 text-gray-800' />
                <p className='hidden md:block text-sm lg:text-base'>Patient History</p>
              </StaffNavButton>
            </li>
            <li>
              <StaffNavButton to='/doctor-availability' inactiveClassName={staffRowInactiveClass} activeClassName={staffRowActiveClass}>
                <CalendarClock className='w-5 sm:w-5 md:w-6 shrink-0 text-gray-800' />
                <p className='hidden md:block text-sm lg:text-base'>Availability</p>
              </StaffNavButton>
            </li>
            <li>
              <StaffNavButton to='/doctor-financial-analysis' inactiveClassName={staffRowInactiveClass} activeClassName={staffRowActiveClass}>
                <BarChart3 className='w-5 sm:w-5 md:w-6 shrink-0 text-gray-800' />
                <p className='hidden md:block text-sm lg:text-base'>Financial Analysis</p>
              </StaffNavButton>
            </li>
            <li>
              <StaffNavButton to='/doctor-profile' inactiveClassName={staffRowInactiveClass} activeClassName={staffRowActiveClass}>
                <img className='w-4 sm:w-5 md:w-6 shrink-0' src={assets.people_icon} alt='Profile' />
                <p className='hidden md:block text-sm lg:text-base'>Profile</p>
              </StaffNavButton>
            </li>
          </ul>
        )}

        {rToken && (
          <ul className='mt-5 overflow-y-auto text-[#515151]'>
            <li>
              <StaffNavButton to='/receptionist-dashboard' inactiveClassName={staffRowInactiveClass} activeClassName={staffRowActiveClass}>
                <img className='w-4 sm:w-5 md:w-6 shrink-0' src={assets.home_icon} alt='Dashboard' />
                <p className='hidden md:block text-sm lg:text-base'>Dashboard</p>
              </StaffNavButton>
            </li>
            <li>
              <StaffNavButton to='/receptionist-appointments' inactiveClassName={staffRowInactiveClass} activeClassName={staffRowActiveClass}>
                <ClipboardList className='w-5 sm:w-5 md:w-6 shrink-0 text-gray-800' />
                <p className='hidden md:block text-sm lg:text-base'>Appointments</p>
              </StaffNavButton>
            </li>
            <li>
              <StaffNavButton to='/receptionist-book-appointment' inactiveClassName={staffRowInactiveClass} activeClassName={staffRowActiveClass}>
                <CalendarPlus className='w-5 sm:w-5 md:w-6 shrink-0 text-gray-800' />
                <p className='hidden md:block text-sm lg:text-base'>Book Appointment</p>
              </StaffNavButton>
            </li>
            <li>
              <StaffNavButton to='/receptionist-patients' inactiveClassName={staffRowInactiveClass} activeClassName={staffRowActiveClass}>
                <UserRound className='w-5 sm:w-5 md:w-6 shrink-0 text-gray-800' />
                <p className='hidden md:block text-sm lg:text-base'>All Patients</p>
              </StaffNavButton>
            </li>
            <li>
              <StaffNavButton to='/receptionist-clinics' inactiveClassName={staffRowInactiveClass} activeClassName={staffRowActiveClass}>
                <Stethoscope className='w-5 sm:w-5 md:w-6 shrink-0 text-gray-800' />
                <p className='hidden md:block text-sm lg:text-base'>Clinics</p>
              </StaffNavButton>
            </li>
            <li>
              <StaffNavButton to='/receptionist-profile' inactiveClassName={staffRowInactiveClass} activeClassName={staffRowActiveClass}>
                <img className='w-4 sm:w-5 md:w-6 shrink-0' src={assets.people_icon} alt='My profile' />
                <p className='hidden md:block text-sm lg:text-base'>My Profile</p>
              </StaffNavButton>
            </li>
          </ul>
        )}
      </div>
    </>
  )
}

export default Sidebar
