import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  UserRound,
} from 'lucide-react'

export const DOCTOR_ICON_CLASS = 'h-4 w-4 shrink-0'

export const isDoctorPathActive = (pathname, path) => pathname === path

export const getDoctorNavLinks = (t) => [
  {
    label: t('Dashboard'),
    path: '/doctor-dashboard',
    icon: LayoutDashboard,
    tone: 'text-blue-700 bg-blue-50 border-blue-100 hover:bg-blue-100',
    active: 'bg-blue-600 border-blue-600',
  },
  {
    label: t('Appointments'),
    path: '/doctor-appointments',
    icon: ClipboardList,
    tone: 'text-violet-700 bg-violet-50 border-violet-100 hover:bg-violet-100',
    active: 'bg-violet-600 border-violet-600',
  },
  {
    label: t('Patient History'),
    path: '/patient-history',
    icon: ClipboardList,
    tone: 'text-sky-700 bg-sky-50 border-sky-100 hover:bg-sky-100',
    active: 'bg-sky-600 border-sky-600',
  },
  {
    label: t('Availability'),
    path: '/doctor-availability',
    icon: CalendarClock,
    tone: 'text-cyan-700 bg-cyan-50 border-cyan-100 hover:bg-cyan-100',
    active: 'bg-cyan-600 border-cyan-600',
  },
  {
    label: t('Financial Analysis'),
    path: '/doctor-financial-analysis',
    icon: BarChart3,
    tone: 'text-amber-700 bg-amber-50 border-amber-100 hover:bg-amber-100',
    active: 'bg-amber-600 border-amber-600',
  },
  {
    label: t('Profile'),
    path: '/doctor-profile',
    icon: UserRound,
    tone: 'text-indigo-700 bg-indigo-50 border-indigo-100 hover:bg-indigo-100',
    active: 'bg-indigo-600 border-indigo-600',
  },
]

export const findActiveDoctorLink = (pathname, links) =>
  links.find((link) => isDoctorPathActive(pathname, link.path)) || null
