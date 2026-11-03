import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  CalendarDays,
  CornerDownLeft,
  Languages,
  LayoutDashboard,
  Moon,
  Plus,
  Search,
  Stethoscope,
  Sun,
  UserCog,
  UserRound
} from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { getAdminSections } from '../../config/adminNav'
import { useLanguage } from '../../i18n'
import { useTheme } from '../../utils/theme'
import { Modal } from '../ui'

const OPEN_EVENT = 'clinivo:open-command-palette'

/** Lets the navbar's search button open the palette without passing state through the app. */
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_EVENT))

const SEARCH_DELAY_MS = 200

export const matchesQuery = (label, query) => String(label || '').toLowerCase().includes(query.trim().toLowerCase())

const Group = ({ title, children }) => (
  <div role='group' aria-label={title} className='mb-2'>
    <p className='px-2 pb-1 pt-2 text-caption font-semibold text-ink-3'>{title}</p>
    {children}
  </div>
)

export default function CommandPalette() {
  const { searchEverything } = useContext(AdminContext)
  const { t, tc, language, toggleLanguage, localizeDigits } = useLanguage()
  const { isDark, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [cursor, setCursor] = useState(0)
  const listRef = useRef(null)
  const latestSearch = useRef(searchEverything)
  latestSearch.current = searchEverything

  useEffect(() => {
    const onOpen = () => setOpen(true)
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (open) return
    setQuery('')
    setResults(null)
    setCursor(0)
  }, [open])

  useEffect(() => {
    const text = query.trim()
    setCursor(0)
    if (text.length < 2) {
      setResults(null)
      setSearching(false)
      return undefined
    }
    const controller = new AbortController()
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        setResults(await latestSearch.current(text, controller.signal))
      } catch {
        if (!controller.signal.aborted) setResults(null)
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, SEARCH_DELAY_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const groups = useMemo(() => {
    const go = (path, state) => () => navigate(path, state ? { state } : undefined)
    const actions = [
      { id: 'add-doctor', label: t('Add doctor'), icon: Plus, run: go('/add-doctor') },
      { id: 'add-receptionist', label: t('Add receptionist'), icon: Plus, run: go('/add-receptionist') },
      { id: 'add-clinic', label: t('Add Clinic'), icon: Plus, run: go('/clinics') },
      {
        id: 'theme',
        label: isDark ? t('Switch to light theme') : t('Switch to dark theme'),
        icon: isDark ? Sun : Moon,
        run: toggleTheme
      },
      {
        id: 'language',
        label: language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية',
        icon: Languages,
        run: toggleLanguage
      }
    ]
    const pages = getAdminSections(t).flatMap((section) =>
      section.links.map((link) => ({ id: link.path, label: link.label, hint: section.title, icon: link.icon, run: go(link.path) }))
    )
    const filter = (items) => (query.trim() ? items.filter((item) => matchesQuery(item.label, query)) : items)

    const found = results || {}
    const records = [
      {
        title: t('Doctors'),
        items: (found.doctors || []).map((doctor) => ({
          id: `doctor-${doctor._id}`,
          label: tc(doctor.i18n?.name) || doctor.name,
          hint: t(doctor.speciality),
          icon: Stethoscope,
          run: go('/doctor-list', { openDoctorId: doctor._id })
        }))
      },
      {
        title: t('Patients'),
        items: (found.patients || []).map((patient) => ({
          id: `patient-${patient._id}`,
          label: patient.name,
          hint: patient.patientId || patient.email,
          icon: UserRound,
          run: go('/patients', { openPatientId: patient._id })
        }))
      },
      {
        title: t('Receptionists'),
        items: (found.receptionists || []).map((receptionist) => ({
          id: `receptionist-${receptionist._id}`,
          label: tc(receptionist.i18n?.name) || receptionist.name,
          hint: receptionist.email,
          icon: UserCog,
          run: go(`/edit-receptionist/${receptionist._id}`)
        }))
      },
      {
        title: t('Clinics'),
        items: (found.clinics || []).map((clinic) => ({
          id: `clinic-${clinic._id}`,
          label: tc(clinic.i18n?.name) || t(clinic.name),
          icon: Building2,
          run: go('/clinics', { openClinicId: clinic._id })
        }))
      },
      {
        title: t('Appointments'),
        items: (found.appointments || []).map((appointment) => ({
          id: `appointment-${appointment._id}`,
          label: appointment.userData?.name || appointment.reservationNumber,
          hint: [tc(appointment.docData?.i18n?.name) || appointment.docData?.name, localizeDigits(String(appointment.slotDate || '').replaceAll('_', '/'))].filter(Boolean).join(' · '),
          icon: CalendarDays,
          run: go('/all-appointments', { search: appointment.reservationNumber || appointment.userData?.name })
        }))
      }
    ]

    return [
      ...records,
      { title: t('Actions'), items: filter(actions) },
      { title: t('Pages'), items: filter(pages) }
    ].filter((group) => group.items.length > 0)
  }, [query, results, t, tc, navigate, isDark, toggleTheme, language, toggleLanguage, localizeDigits])

  const flat = groups.flatMap((group) => group.items)

  const choose = (item) => {
    setOpen(false)
    item?.run()
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((current) => (flat.length ? (current + 1) % flat.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((current) => (flat.length ? (current - 1 + flat.length) % flat.length : 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(flat[cursor])
    }
  }

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  let index = -1

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={t('Search everything')} size='lg'>
      <div className='relative'>
        <Search aria-hidden='true' className='pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-ink-3' />
        <input
          data-autofocus
          role='combobox'
          aria-expanded='true'
          aria-controls='command-palette-list'
          aria-activedescendant={flat[cursor] ? `palette-${flat[cursor].id}` : undefined}
          aria-label={t('Search everything')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('Doctors, patients, reservations, pages…')}
          className='min-h-12 w-full rounded-control border border-field bg-surface ps-11 pe-3 text-body text-ink'
        />
      </div>

      <div id='command-palette-list' ref={listRef} role='listbox' aria-label={t('Results')} className='mt-2 h-[52vh] overflow-y-auto sm:h-96'>
        {groups.map((group) => (
          <Group key={group.title} title={group.title}>
            {group.items.map((item) => {
              index += 1
              const position = index
              const selected = position === cursor
              const Icon = item.icon || LayoutDashboard
              return (
                <button
                  key={item.id}
                  id={`palette-${item.id}`}
                  type='button'
                  role='option'
                  aria-selected={selected}
                  onClick={() => choose(item)}
                  onMouseMove={() => setCursor(position)}
                  className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-control px-2.5 py-1.5 text-start ${
                    selected ? 'bg-primary-soft' : ''
                  }`}
                >
                  <Icon aria-hidden='true' className={`size-4 shrink-0 ${selected ? 'text-brand' : 'text-ink-3'}`} />
                  <span className='min-w-0 flex-1 truncate text-body-sm font-medium text-ink'>{item.label}</span>
                  {item.hint && <span className='max-w-[45%] truncate text-caption text-ink-3'>{item.hint}</span>}
                  {selected && <CornerDownLeft aria-hidden='true' className='hidden size-3.5 shrink-0 text-ink-3 rtl:-scale-x-100 sm:block' />}
                </button>
              )
            })}
          </Group>
        ))}
        {!flat.length && (
          <p aria-live='polite' className='px-2 py-10 text-center text-body-sm text-ink-3'>
            {searching ? t('Searching…') : t('Nothing matches that')}
          </p>
        )}
      </div>
    </Modal>
  )
}
