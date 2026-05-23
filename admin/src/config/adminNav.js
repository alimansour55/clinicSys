import {
  Building2,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Globe,
  HeartHandshake,
  Home,
  Image,
  LayoutDashboard,
  LayoutTemplate,
  LineChart,
  PanelBottom,
  ShieldCheck,
  Stethoscope,
  UserCog,
  UserRound,
  UsersRound,
  Wallet
} from 'lucide-react'
import { assets } from '../assets/assets'

export const ADMIN_ICON_CLASS = 'h-5 w-5 shrink-0'

export const isAdminPathActive = (pathname, path) => {
  if (path === '/doctor-list') {
    return pathname === '/doctor-list' || pathname === '/add-doctor'
  }
  if (path === '/receptionist-list') {
    return (
      pathname === '/receptionist-list' ||
      pathname === '/add-receptionist' ||
      pathname.startsWith('/edit-receptionist/')
    )
  }
  if (path === '/patients') {
    return pathname === '/patients' || pathname === '/receptionist-patients'
  }
  if (path === '/all-appointments') {
    return (
      pathname === '/all-appointments' ||
      pathname === '/actual-appointments' ||
      pathname === '/finished-appointments'
    )
  }
  return pathname === path
}

export const getAdminSections = (t) => [
  {
    title: t('Overview'),
    icon: LayoutDashboard,
    links: [
      { label: t('Dashboard'), path: '/admin-dashboard', icon: CalendarDays },
      { label: t('Clinics'), path: '/clinics', icon: Building2 },
      { label: t('Financial Analytics'), path: '/admin-financial-analytics', icon: LineChart },
      { label: t('Insurance providers'), path: '/insurance-providers-settings', icon: HeartHandshake },
      { label: t('Home visit pricing'), path: '/home-visit-pricing-settings', icon: Home },
      { label: t('Global visit fees'), path: '/global-visit-fees-settings', icon: Wallet },
      { label: t('User languages settings'), path: '/language-settings', icon: Globe }
    ]
  },
  {
    title: t('Users'),
    icon: UsersRound,
    links: [
      { label: t('Users'), path: '/users', icon: UsersRound },
      { label: t('Patients'), path: '/patients', icon: UserRound },
      { label: t('Doctors'), path: '/doctor-list', icon: Stethoscope },
      { label: t('Receptionists'), path: '/receptionist-list', icon: UserCog }
    ]
  },
  {
    title: t('Appointments'),
    icon: CalendarClock,
    links: [
      { label: t('All Appointments'), path: '/all-appointments', icon: ClipboardList },
      { label: t('Actual Appointments'), path: '/actual-appointments', icon: CalendarPlus },
      { label: t('Finished Appointments'), path: '/finished-appointments', icon: CalendarCheck2 },
      { label: t('Appointment History'), path: '/appointment-history', icon: ClipboardList }
    ]
  },
  {
    title: t('Page Design'),
    icon: LayoutTemplate,
    links: [
      { label: t('Site logo'), path: '/site-logo-settings', icon: Image },
      { label: t('Home Hero'), path: '/home-hero-settings', icon: LayoutTemplate },
      { label: t('Home Banner'), path: '/home-banner-settings', icon: LayoutTemplate },
      { label: t('Service Cards'), path: '/home-service-cards-settings', icon: LayoutTemplate },
      { label: t('Footer'), path: '/footer-settings', icon: PanelBottom }
    ]
  },
  {
    title: t('Security Options'),
    icon: ShieldCheck,
    links: [
      { label: t('Security'), path: '/security-settings', icon: ShieldCheck },
      { label: t('Audit Logs'), path: '/audit-logs', icon: ClipboardList }
    ]
  }
]

export const findActiveAdminLink = (pathname, sections) => {
  for (const section of sections) {
    for (const link of section.links) {
      if (isAdminPathActive(pathname, link.path)) {
        return { ...link, sectionTitle: section.title }
      }
    }
  }
  return null
}

/** Legacy dashboard icon for desktop sidebar */
export const adminDashboardIcon = assets.home_icon
