import {
  CalendarPlus,
  ClipboardList,
  LayoutDashboard,
  Stethoscope,
  UserRound,
} from 'lucide-react'

export const RECEPTIONIST_ICON_CLASS = 'h-4 w-4 shrink-0'

export const isReceptionistPathActive = (pathname, path) => pathname === path

export const getReceptionistNavLinks = (t) => [
  {
    label: t('Dashboard'),
    path: '/receptionist-dashboard',
    icon: LayoutDashboard,
    tone: 'text-blue-700 bg-blue-50 border-blue-100 hover:bg-blue-100',
    active: 'bg-blue-600 border-blue-600',
  },
  {
    label: t('Appointments'),
    path: '/receptionist-appointments',
    icon: ClipboardList,
    tone: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-100 hover:bg-fuchsia-100',
    active: 'bg-fuchsia-600 border-fuchsia-600',
  },
  {
    label: t('Book Appointment'),
    path: '/receptionist-book-appointment',
    icon: CalendarPlus,
    tone: 'text-emerald-700 bg-emerald-50 border-emerald-100 hover:bg-emerald-100',
    active: 'bg-emerald-600 border-emerald-600',
  },
  {
    label: t('All Patients'),
    path: '/receptionist-patients',
    icon: UserRound,
    tone: 'text-sky-700 bg-sky-50 border-sky-100 hover:bg-sky-100',
    active: 'bg-sky-600 border-sky-600',
  },
  {
    label: t('Clinics'),
    path: '/receptionist-clinics',
    icon: Stethoscope,
    tone: 'text-violet-700 bg-violet-50 border-violet-100 hover:bg-violet-100',
    active: 'bg-violet-600 border-violet-600',
  },
  {
    label: t('My Profile'),
    path: '/receptionist-profile',
    icon: UserRound,
    tone: 'text-indigo-700 bg-indigo-50 border-indigo-100 hover:bg-indigo-100',
    active: 'bg-indigo-600 border-indigo-600',
  },
]

export const findActiveReceptionistLink = (pathname, links) =>
  links.find((link) => isReceptionistPathActive(pathname, link.path)) || null
