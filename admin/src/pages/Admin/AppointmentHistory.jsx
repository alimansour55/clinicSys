import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ArrowLeft, Banknote, Calendar, CheckCircle2, Clipboard, Clock, FileText, ListChecks, Pill, Search, Stethoscope, Thermometer, Trash2, User, X } from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { AdminPage, ConfirmDialog, ExportButton, StatCard } from '../../components/admin/AdminPage'
import { Badge, Button, EmptyState, IconButton, Input, Skeleton, SkeletonGroup } from '../../components/ui'
import { useLanguage } from '../../i18n'
import { downloadCsv } from '../../utils/csvExport'
import { parseExperienceYears } from '../../utils/doctorExperience'
import { toWesternAsciiDigits } from '../../utils/arabicNumerals'

const NO_VALUE = '—'

/* Separate grids for header and rows, so both use this one template */
const GRID_TEMPLATE = 'xl:grid-cols-[1.75rem_minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_7rem]'

const SECTION = 'mb-4 rounded-card border border-line bg-surface p-4 shadow-e1 sm:mb-6 sm:p-6'

const getReservationNumber = (item) => item.reservationNumber || `RES-${String(item.appointmentId || item._id || '').slice(-6).toUpperCase()}`

/** `slotDate` is day_month_year. Anything else is treated as no date, including 31_2_2026. */
const isValidSlotDate = (slotDate) => {
  const [day, month, year] = String(slotDate || '').split('_').map(Number)
  if (!day || !month || !year) return false
  return new Date(year, month - 1, day).getMonth() === month - 1
}

/* Accounts can hold no birth date, or the text 'Not Selected' */
const ageFrom = (dob) => {
  const birth = new Date(dob)
  if (!dob || Number.isNaN(birth.getTime())) return null
  const today = new Date()
  const hadBirthday = today.getMonth() > birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate())
  const age = today.getFullYear() - birth.getFullYear() - (hadBirthday ? 0 : 1)
  return age >= 0 ? age : null
}

const normalizeSearch = (value) => toWesternAsciiDigits(value).toLowerCase().trim()

const searchTextFor = (item) =>
  normalizeSearch(
    [item.userData?.patientId, item.userData?.name, item.docData?.name, item.docData?.i18n?.name?.en, item.docData?.i18n?.name?.ar, getReservationNumber(item)]
      .filter(Boolean)
      .join(' '),
  )

const Avatar = ({ src, className }) =>
  src ? (
    <img className={`shrink-0 rounded-full bg-surface-sunken object-cover ${className}`} src={src} alt='' />
  ) : (
    <span aria-hidden='true' className={`flex shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-3 ${className}`}>
      <User className='size-1/2' />
    </span>
  )

const InfoLine = ({ label, value, ltr = false }) => {
  if (value === null || value === undefined || value === '') return null
  return (
    <p className='min-w-0 break-words'>
      <span className='font-medium text-ink'>{label}: </span>
      <span dir={ltr ? 'ltr' : undefined}>{value}</span>
    </p>
  )
}

const FactTile = ({ icon, label, value, valueClassName = 'text-ink' }) => {
  const Icon = icon
  return (
    <div className='min-w-0 rounded-control bg-surface-sunken p-3 sm:p-4'>
      <p className='mb-1 flex items-center gap-1 text-caption text-ink-3'>
        <Icon aria-hidden='true' className='size-3.5' />
        {label}
      </p>
      <div className={`break-words text-body-sm font-semibold ${valueClassName}`}>{value}</div>
    </div>
  )
}

const MedicalSection = ({ icon, title, barClassName, iconClassName, children }) => {
  const Icon = icon
  return (
    <div className={`border-s-4 ps-4 ${barClassName}`}>
      <h3 className='mb-2 flex items-center gap-2 text-body-sm font-semibold text-ink'>
        <Icon aria-hidden='true' className={`size-4 ${iconClassName}`} />
        {title}
      </h3>
      {children}
    </div>
  )
}

const MedicalText = ({ children }) => <p className='whitespace-pre-line break-words rounded-control bg-surface-sunken p-3 text-body-sm text-ink'>{children}</p>

const AppointmentHistory = () => {
  const { aToken, membersHistory, getAppointmentsHistory, deleteAppointmentHistory } = useContext(AdminContext)
  const { slotDateFormat, currency } = useContext(AppContext)
  const { t, tc, localizeDigits, language } = useLanguage()

  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(Boolean(aToken))
  const detailTopRef = useRef(null)

  useEffect(() => {
    if (!aToken) return undefined
    let active = true
    Promise.resolve(getAppointmentsHistory()).finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
    // getAppointmentsHistory is rebuilt on every provider render, so listing it would refetch forever
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  /* A long list on a phone would otherwise open the record scrolled halfway down */
  useEffect(() => {
    if (selectedAppointment) detailTopRef.current?.scrollIntoView({ block: 'start' })
  }, [selectedAppointment])

  const history = useMemo(() => membersHistory || [], [membersHistory])

  const filteredHistory = useMemo(() => {
    const query = normalizeSearch(searchQuery)
    const result = query ? history.filter((item) => searchTextFor(item).includes(query)) : [...history]
    return result.reverse()
  }, [history, searchQuery])

  const patientName = (item) => item.userData?.name || t('Unknown patient')
  const doctorName = (item) => tc(item.docData?.i18n?.name) || item.docData?.name || t('Unknown doctor')
  const doctorSpeciality = (item) => tc(item.docData?.i18n?.speciality) || tc(item.docData?.speciality) || ''
  const formatSlotDate = (item) => (isValidSlotDate(item.slotDate) ? localizeDigits(slotDateFormat(item.slotDate)) : NO_VALUE)
  const formatSlotTime = (item) => (item.slotTime ? localizeDigits(item.slotTime) : NO_VALUE)

  const formatExperience = (doctor) => {
    const years = parseExperienceYears(doctor?.experience)
    if (years === null) return doctor?.experience || ''
    return `${localizeDigits(years)} ${years === 1 ? t('year of experience') : t('years of experience')}`
  }

  const formatCreatedAt = (value) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? NO_VALUE : date.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB')
  }

  const closeDeleteDialog = () => {
    if (!deleting) setShowDeleteModal(false)
  }

  /* deleteAppointmentHistory shows its own result and refreshes the list */
  const confirmDelete = async () => {
    setDeleting(true)
    await deleteAppointmentHistory(selectedAppointment._id)
    setDeleting(false)
    setShowDeleteModal(false)
    setSelectedAppointment(null)
  }

  /* Medical records are sensitive, so this is exactly what the list shows and nothing more */
  const exportRows = () => {
    downloadCsv(
      'appointment-history',
      [
        { label: t('Reservation'), value: getReservationNumber },
        { label: t('Patient'), value: (row) => row.userData?.name || '' },
        { label: t('Patient ID'), value: (row) => row.userData?.patientId || '' },
        { label: t('Diagnosis'), value: (row) => row.diagnosis || '' },
        { label: t('Date'), value: formatSlotDate },
        { label: t('Time'), value: (row) => row.slotTime || '' },
        { label: t('Doctor'), value: (row) => tc(row.docData?.i18n?.name) || row.docData?.name || '' },
        { label: t('Speciality'), value: doctorSpeciality },
      ],
      filteredHistory,
    )
  }

  if (selectedAppointment) {
    const record = selectedAppointment
    const age = ageFrom(record.userData?.dob)

    return (
      <div ref={detailTopRef}>
        <AdminPage
          title={t('Appointment Record')}
          icon={FileText}
          width='max-w-5xl'
          actions={
            <Button variant='secondary' size='sm' onClick={() => setSelectedAppointment(null)} leadingIcon={<ArrowLeft aria-hidden='true' className='size-4 rtl:-scale-x-100' />}>
              {t('Back to History')}
            </Button>
          }
        >
          <section className={SECTION}>
            <h2 className='mb-3 flex items-center gap-2 text-subtitle font-semibold text-ink'>
              <User aria-hidden='true' className='size-5 text-brand' />
              {t('Patient Information')}
            </h2>
            <div className='flex flex-col items-start gap-4 sm:flex-row sm:items-center'>
              <Avatar src={record.userData?.image} className='size-16 sm:size-20' />
              <div className='w-full min-w-0 flex-1'>
                <p className='mb-2 break-words text-title font-semibold text-ink'>{patientName(record)}</p>
                <div className='mb-3 flex flex-wrap gap-2'>
                  {record.userData?.patientId && (
                    <Badge tone='brand'>
                      <User aria-hidden='true' className='size-3' />
                      <span dir='ltr'>{record.userData.patientId}</span>
                    </Badge>
                  )}
                  <Badge>
                    {`${t('Reservation')}: `}
                    <span dir='ltr'>{getReservationNumber(record)}</span>
                  </Badge>
                  {age !== null && <Badge>{`${t('Age')}: ${localizeDigits(age)}`}</Badge>}
                </div>
                <div className='grid grid-cols-1 gap-2 text-body-sm text-ink-2 sm:grid-cols-2'>
                  <InfoLine label={t('Email')} value={record.userData?.email} ltr />
                  <InfoLine label={t('Phone')} value={record.userData?.phone} ltr />
                </div>
              </div>
            </div>
          </section>

          <section className={SECTION}>
            <h2 className='mb-3 flex items-center gap-2 text-subtitle font-semibold text-ink'>
              <Stethoscope aria-hidden='true' className='size-5 text-brand' />
              {t('Doctor Information')}
            </h2>
            <div className='flex items-start gap-4'>
              <Avatar src={record.docData?.image} className='size-14 sm:size-16' />
              <div className='min-w-0 flex-1'>
                <p className='mb-2 break-words text-title font-semibold text-ink'>{doctorName(record)}</p>
                <div className='grid grid-cols-1 gap-2 text-body-sm text-ink-2 sm:grid-cols-2'>
                  <InfoLine label={t('Specialty')} value={doctorSpeciality(record)} />
                  <InfoLine label={t('Degree')} value={tc(record.docData?.i18n?.degree) || tc(record.docData?.degree)} />
                  <InfoLine label={t('Experience')} value={formatExperience(record.docData)} />
                  <InfoLine label={t('Email')} value={record.docData?.email} ltr />
                </div>
              </div>
            </div>
          </section>

          <section className={SECTION}>
            <h2 className='mb-4 flex items-center gap-2 text-subtitle font-semibold text-ink'>
              <Calendar aria-hidden='true' className='size-5 text-brand' />
              {t('Appointment Details')}
            </h2>
            <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
              <FactTile icon={Calendar} label={t('Date')} value={formatSlotDate(record)} />
              <FactTile icon={Clock} label={t('Time')} value={<span dir='ltr'>{formatSlotTime(record)}</span>} />
              <FactTile icon={Banknote} label={t('Fees')} value={record.amount === null || record.amount === undefined ? NO_VALUE : `${currency}${localizeDigits(record.amount)}`} />
              <FactTile icon={CheckCircle2} label={t('Status')} value={t('Completed')} valueClassName='text-success-ink' />
            </div>

            {record.createdAt && (
              <div className='mt-5 border-t border-line pt-5'>
                <h3 className='mb-3 text-body-sm font-semibold text-ink'>{t('Prescription Timeline')}</h3>
                <div className='flex items-start gap-3'>
                  <span aria-hidden='true' className='mt-2 size-2 shrink-0 rounded-full bg-success' />
                  <div>
                    <p className='text-body-sm font-medium text-ink-2'>{t('Created')}</p>
                    <p className='text-caption text-ink-3'>{formatCreatedAt(record.createdAt)}</p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className={SECTION}>
            <h2 className='mb-5 flex items-center gap-2 text-subtitle font-semibold text-ink'>
              <FileText aria-hidden='true' className='size-5 text-brand' />
              {t('Medical Details')}
            </h2>

            <div className='space-y-5'>
              <MedicalSection icon={Stethoscope} title={t('Diagnosis')} barClassName='border-primary' iconClassName='text-brand'>
                <MedicalText>{record.diagnosis || t('Not specified')}</MedicalText>
              </MedicalSection>

              {record.symptoms && (
                <MedicalSection icon={Thermometer} title={t('Symptoms')} barClassName='border-warning' iconClassName='text-warning-ink'>
                  <MedicalText>{record.symptoms}</MedicalText>
                </MedicalSection>
              )}

              {(record.medicationItems?.length > 0 || record.medicines) && (
                <MedicalSection icon={Pill} title={t('Prescribed Medicines')} barClassName='border-success' iconClassName='text-success-ink'>
                  {record.medicationItems?.length > 0 ? (
                    <div className='overflow-x-auto rounded-control border border-line'>
                      <table className='w-full min-w-[32rem] text-body-sm text-ink'>
                        <thead className='bg-surface-sunken text-ink-2'>
                          <tr>
                            <th scope='col' className='p-2 text-start font-semibold'>{t('Medicine')}</th>
                            <th scope='col' className='p-2 text-start font-semibold'>{t('Dosage')}</th>
                            <th scope='col' className='p-2 text-start font-semibold'>{t('Frequency')}</th>
                            <th scope='col' className='p-2 text-start font-semibold'>{t('Duration')}</th>
                            <th scope='col' className='p-2 text-start font-semibold'>{t('Instructions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {record.medicationItems.map((item, index) => (
                            <tr key={item._id || index} className='border-t border-line'>
                              <td className='p-2'>{item.name}</td>
                              <td className='p-2'>{item.dosage}</td>
                              <td className='p-2'>{item.frequency}</td>
                              <td className='p-2'>{item.duration}</td>
                              <td className='p-2'>{item.instructions || NO_VALUE}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <MedicalText>{record.medicines}</MedicalText>
                  )}
                </MedicalSection>
              )}

              {record.instructions && (
                <MedicalSection icon={Clipboard} title={t('Patient Instructions')} barClassName='border-info' iconClassName='text-info-ink'>
                  <MedicalText>{record.instructions}</MedicalText>
                </MedicalSection>
              )}

              {record.labTests && (
                <MedicalSection icon={Activity} title={t('Lab Tests')} barClassName='border-danger' iconClassName='text-danger-ink'>
                  <MedicalText>{record.labTests}</MedicalText>
                </MedicalSection>
              )}

              {record.nextVisit && (
                <MedicalSection icon={Calendar} title={t('Follow-up Visit')} barClassName='border-accent' iconClassName='text-accent-ink'>
                  <MedicalText>{record.nextVisit}</MedicalText>
                </MedicalSection>
              )}

              {record.documentation && (
                <MedicalSection icon={FileText} title={t('Documentation')} barClassName='border-line-strong' iconClassName='text-ink-2'>
                  <MedicalText>{record.documentation}</MedicalText>
                </MedicalSection>
              )}
            </div>

            {record._id && (
              <div className='mt-6 border-t border-line pt-5'>
                <Button variant='danger' className='w-full sm:w-auto' onClick={() => setShowDeleteModal(true)} leadingIcon={<Trash2 aria-hidden='true' className='size-4' />}>
                  {t('Delete Record')}
                </Button>
              </div>
            )}
          </section>
        </AdminPage>

        <ConfirmDialog
          open={showDeleteModal}
          danger
          busy={deleting}
          title={t('Delete Appointment Record?')}
          body={`${patientName(record)} (${getReservationNumber(record)}). ${t('Are you sure you want to delete this appointment record? This action cannot be undone.')}`}
          confirmLabel={t('Delete')}
          onConfirm={confirmDelete}
          onClose={closeDeleteDialog}
        />
      </div>
    )
  }

  return (
    <AdminPage
      title={t('Appointment History')}
      description={t('View and manage completed appointments')}
      icon={FileText}
      actions={<ExportButton onExport={exportRows} disabled={loading || filteredHistory.length === 0} />}
    >
      <div className='mb-4 grid grid-cols-2 gap-3 sm:max-w-md'>
        <StatCard label={t('Total')} value={localizeDigits(history.length)} icon={ListChecks} />
        <StatCard label={t('Showing')} value={localizeDigits(filteredHistory.length)} icon={Search} />
      </div>

      <div className='mb-4 rounded-card border border-line bg-surface p-3 shadow-e1 sm:p-4'>
        <div data-input-field className='relative'>
          <Search aria-hidden='true' className='pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3' />
          <Input
            type='search'
            aria-label={t('Search appointment history')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('Search by name, patient ID or reservation...')}
            className='ps-10! pe-11! [&::-webkit-search-cancel-button]:hidden'
          />
          {searchQuery && (
            <IconButton label={t('Clear search')} size='sm' className='absolute end-1 top-1/2 -translate-y-1/2' onClick={() => setSearchQuery('')}>
              <X aria-hidden='true' className='size-4' />
            </IconButton>
          )}
        </div>
      </div>

      <div className='overflow-hidden rounded-card border border-line bg-surface text-body-sm text-ink-2 shadow-e1 xl:max-h-[75vh] xl:overflow-y-auto'>
        <div className={`sticky top-0 z-10 hidden items-center gap-3 border-b border-line bg-surface-sunken px-5 py-3 text-caption font-semibold text-ink-2 xl:grid ${GRID_TEMPLATE}`}>
          <p>#</p>
          <p>{t('Patient')}</p>
          <p>{t('Patient ID')}</p>
          <p>{t('Diagnosis')}</p>
          <p>{t('Date & Time')}</p>
          <p>{t('Doctor')}</p>
          <p>{t('Action')}</p>
        </div>

        {loading ? (
          <SkeletonGroup>
            {[1, 2, 3, 4, 5, 6].map((row) => (
              <div key={row} className='flex items-center gap-3 border-b border-line p-4'>
                <Skeleton circle className='size-10 shrink-0' />
                <div className='min-w-0 flex-1 space-y-2'>
                  <Skeleton className='h-4 w-2/3 max-w-xs' />
                  <Skeleton className='h-3 w-1/2 max-w-48' />
                </div>
                <Skeleton className='hidden h-8 w-20 sm:block' />
              </div>
            ))}
          </SkeletonGroup>
        ) : filteredHistory.length === 0 ? (
          <EmptyState
            icon={<Search />}
            title={t('No records found')}
            description={searchQuery.trim() ? t('Try adjusting your search') : t('No appointment history available')}
            action={
              searchQuery ? (
                <Button variant='secondary' size='sm' onClick={() => setSearchQuery('')}>
                  {t('Clear search')}
                </Button>
              ) : null
            }
          />
        ) : (
          <ul>
            {filteredHistory.map((item, index) => {
              const speciality = doctorSpeciality(item)
              const reservation = getReservationNumber(item)
              return (
                <li
                  key={item._id || index}
                  className={`grid grid-cols-1 gap-3 border-b border-line p-4 last:border-b-0 hover:bg-surface-sunken/60 xl:items-center xl:px-5 xl:py-3 ${GRID_TEMPLATE}`}
                >
                  <p className='hidden tabular-nums xl:block'>{localizeDigits(index + 1)}</p>

                  <div className='flex min-w-0 items-start gap-3 xl:items-center'>
                    <Avatar src={item.userData?.image} className='size-12 xl:size-10' />
                    <div className='min-w-0'>
                      <p className='truncate font-medium text-ink'>{patientName(item)}</p>
                      <p className='truncate text-caption font-semibold text-brand'>
                        <span dir='ltr'>{reservation}</span>
                      </p>
                      {item.userData?.patientId && (
                        <p className='truncate text-caption text-ink-3 xl:hidden'>
                          {`${t('Patient ID')}: `}
                          <span dir='ltr'>{item.userData.patientId}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <p className='hidden truncate xl:block'>
                    <span dir='ltr'>{item.userData?.patientId || NO_VALUE}</span>
                  </p>

                  <div className='min-w-0'>
                    <span className='inline-block max-w-full break-words rounded-control bg-primary-soft px-2 py-1 text-caption font-medium text-brand'>
                      {item.diagnosis || t('N/A')}
                    </span>
                  </div>

                  <p className='min-w-0 text-ink-2'>
                    {formatSlotDate(item)}
                    {' · '}
                    <span dir='ltr'>{formatSlotTime(item)}</span>
                  </p>

                  <div className='flex min-w-0 items-center gap-2'>
                    <Avatar src={item.docData?.image} className='size-8' />
                    <div className='min-w-0'>
                      <p className='truncate font-medium text-ink'>{doctorName(item)}</p>
                      {speciality && <p className='truncate text-caption text-ink-3'>{speciality}</p>}
                    </div>
                  </div>

                  <div className='flex justify-end xl:justify-start'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='text-brand!'
                      aria-label={`${t('View Details')}: ${patientName(item)}`}
                      onClick={() => setSelectedAppointment(item)}
                    >
                      {t('View Details')}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </AdminPage>
  )
}

export default AppointmentHistory
