import React, { useContext } from 'react'
import { AdminContext } from '../context/AdminContext'
import { NavLink } from 'react-router-dom'
import { assets } from '../assets/assets'
import { DoctorContext } from '../context/DoctorContext'
import { Building2, CalendarClock, CalendarPlus, ClipboardList, CreditCard, LayoutTemplate, PanelBottom, ShieldCheck, UserCog, UserRound } from 'lucide-react'
import { ReceptionistContext } from '../context/ReceptionistContext'
import { useLanguage } from '../i18n'

const Sidebar = () => {
  const { aToken } = useContext(AdminContext)
  const { dToken } = useContext(DoctorContext)
  const { rToken } = useContext(ReceptionistContext)
  const { isRtl } = useLanguage()

  return (
    <div className={`fixed ${isRtl ? 'right-0 border-l' : 'left-0 border-r'} top-16 bottom-0 w-14 sm:w-16 md:w-64 bg-white overflow-y-auto z-40`}>
      {aToken && (
        <ul className='text-[#515151] mt-5'>
          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-2 sm:px-3 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`}
            to={'/admin-dashboard'}
            >
            <img className='w-4 sm:w-5 md:w-6 flex-shrink-0' src={assets.home_icon} alt="Dashboard" />
            <p className='hidden md:block text-sm lg:text-base'>Dashboard</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-2 sm:px-3 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`}
            to={'/all-appointments'}
            >
            <img className='w-4 sm:w-5 md:w-6 flex-shrink-0' src={assets.appointment_icon} alt="Appointments" />
            <p className='hidden md:block text-sm lg:text-base'>Appointments</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-2 sm:px-3 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/appointment-history'}
            >
            <ClipboardList className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
            <p className='hidden md:block text-sm lg:text-base'>Appointment History</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-2 sm:px-3 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/add-doctor'}
            >
            <img className='w-4 sm:w-5 md:w-6 flex-shrink-0' src={assets.add_icon} alt="Add Doctor" />
            <p className='hidden md:block text-sm lg:text-base'>Add Doctor</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-2 sm:px-3 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/doctor-list'}
            >
            <img className='w-4 sm:w-5 md:w-6 flex-shrink-0' src={assets.people_icon} alt="Doctors" />
            <p className='hidden md:block text-sm lg:text-base'>Doctors List</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-2 sm:px-3 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/patients'}
            >
            <UserRound className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
            <p className='hidden md:block text-sm lg:text-base'>Patients</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-2 sm:px-3 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/clinics'}
            >
            <Building2 className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
            <p className='hidden md:block text-sm lg:text-base'>Clinics</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-2 sm:px-3 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/home-hero-settings'}
            >
            <LayoutTemplate className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
            <p className='hidden md:block text-sm lg:text-base'>Home Hero</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-2 sm:px-3 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/home-banner-settings'}
            >
            <LayoutTemplate className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
            <p className='hidden md:block text-sm lg:text-base'>Home Banner</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-2 sm:px-3 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/footer-settings'}
            >
            <PanelBottom className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
            <p className='hidden md:block text-sm lg:text-base'>Footer</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-2 sm:px-3 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/add-receptionist'}
            >
            <UserCog className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
            <p className='hidden md:block text-sm lg:text-base'>Add Receptionist</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-2 sm:px-3 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/receptionist-list'}
            >
            <CreditCard className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
            <p className='hidden md:block text-sm lg:text-base'>Receptionists</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-2 sm:px-3 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/audit-logs'}
            >
            <ShieldCheck className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
            <p className='hidden md:block text-sm lg:text-base'>Audit Logs</p>
          </NavLink>
        </ul>
      )}

      {dToken && (
        <ul className='text-[#515151] mt-5'>
          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-4 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/doctor-dashboard'}
            >
            <img className='w-4 sm:w-5 md:w-6 flex-shrink-0' src={assets.home_icon} alt="Dashboard" />
            <p className='hidden md:block text-sm lg:text-base'>Dashboard</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-4 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/doctor-appointments'}
            >
            <img className='w-4 sm:w-5 md:w-6 flex-shrink-0' src={assets.appointment_icon} alt="Appointments" />
            <p className='hidden md:block text-sm lg:text-base'>Appointments</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-4 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/patient-history'}
            >
            <ClipboardList className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
            <p className='hidden md:block text-sm lg:text-base'>Patient History</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-4 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/doctor-availability'}
            >
            <CalendarClock className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
            <p className='hidden md:block text-sm lg:text-base'>Availability</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-4 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`
            }
            to={'/doctor-profile'}
            >
            <img className='w-4 sm:w-5 md:w-6 flex-shrink-0' src={assets.people_icon} alt="Profile" />
            <p className='hidden md:block text-sm lg:text-base'>Profile</p>
          </NavLink>

        </ul>
      )}

      {rToken && (
        <ul className='text-[#515151] mt-5'>
          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-4 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`}
            to={'/receptionist-dashboard'}
          >
            <img className='w-4 sm:w-5 md:w-6 flex-shrink-0' src={assets.home_icon} alt="Dashboard" />
            <p className='hidden md:block text-sm lg:text-base'>Dashboard</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-4 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`}
            to={'/receptionist-appointments'}
          >
            <ClipboardList className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
            <p className='hidden md:block text-sm lg:text-base'>Appointments</p>
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 py-3 md:py-3.5 px-4 md:px-6 cursor-pointer hover:bg-gray-50 transition-colors
            ${isActive ? 'bg-[#F2F3FF] border-r-4 border-primary' : ''}`}
            to={'/receptionist-book-appointment'}
          >
            <CalendarPlus className='w-5 sm:w-5 md:w-6 flex-shrink-0 text-gray-800' />
            <p className='hidden md:block text-sm lg:text-base'>Book Appointment</p>
          </NavLink>
        </ul>
      )}
      
    </div>
  )
}

export default Sidebar
