import { Home, Phone, Stethoscope, Video } from 'lucide-react'

export const MODE_META = {
  clinic: { icon: Stethoscope, label: 'Clinic visit' },
  voice: { icon: Phone, label: 'Voice call' },
  tele: { icon: Video, label: 'Video call' },
  home: { icon: Home, label: 'Home visit' },
}

export const doctorHref = (row, mode) => `/appointment/${row.id}${mode && mode !== 'clinic' ? `?consultation=${mode}` : ''}`
