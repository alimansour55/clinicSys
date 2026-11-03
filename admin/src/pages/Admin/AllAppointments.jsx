import { useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Ban, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Clock, Home, ListChecks, Phone, Search, SlidersHorizontal, User, Video, X } from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { AdminPage, BulkBar, ConfirmDialog, ExportButton, SelectBox, StatCard, selectionFor } from '../../components/admin/AdminPage'
import { Badge, Button, EmptyState, Field, IconButton, Input, Select, Skeleton, SkeletonGroup, notify } from '../../components/ui'
import { useLanguage } from '../../i18n'
import { downloadCsv } from '../../utils/csvExport'
import { toWesternAsciiDigits } from '../../utils/arabicNumerals'

const NO_FILTERS = { status: 'all', dateRange: 'all' }
const DAY_MS = 24 * 60 * 60 * 1000
const NO_VALUE = '—'

/* Separate grids for header and rows, so the two templates must stay identical */
const GRID_WITH_SELECT = 'xl:grid-cols-[1.5rem_1.75rem_minmax(0,1.7fr)_minmax(0,0.8fr)_2.5rem_minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1fr)_6.5rem]'
const GRID_NO_SELECT = 'xl:grid-cols-[1.75rem_minmax(0,1.7fr)_minmax(0,0.8fr)_2.5rem_minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1fr)_6.5rem]'

/** Live row: cancelled (any reason) */
const isRowCancelled = (item) => item.cancelled === true || item.appointmentStatus === 'Cancelled'

/** Live row: completed / finished visit */
const isRowFinished = (item) => item.isCompleted === true || item.appointmentStatus === 'Finished'

/** Still on the schedule — not done and not cancelled */
const isRowActual = (item) => !isRowCancelled(item) && !isRowFinished(item)

const getReservationNumber = (item) => item.reservationNumber || `RES-${String(item._id || '').slice(-6).toUpperCase()}`

const getAppointmentMode = (item) => item.appointmentType || 'Clinic'

/** `slotDate` is day_month_year. Returns null for anything else, including 31_2_2026. */
const parseSlotDate = (slotDate) => {
  const [day, month, year] = String(slotDate || '').split('_').map(Number)
  if (!day || !month || !year) return null
  const date = new Date(year, month - 1, day)
  return date.getMonth() === month - 1 ? date : null
}

/* Rounded, not floored: a clock change makes one day 23 hours long */
const daysFromToday = (date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((date - today) / DAY_MS)
}

const DATE_RANGE_MATCHES = {
  today: (days) => days === 0,
  tomorrow: (days) => days === 1,
  week: (days) => days >= -7 && days <= 0,
  '15days': (days) => days >= -15 && days <= 0,
  month: (days) => days >= -30 && days <= 0,
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
    [
      item.userData?.patientId,
      item.userData?.name,
      item.docData?.name,
      item.docData?.i18n?.name?.en,
      item.docData?.i18n?.name?.ar,
      getReservationNumber(item),
    ]
      .filter(Boolean)
      .join(' '),
  )

const statusKeyOf = (item) => (isRowCancelled(item) ? 'cancelled' : isRowFinished(item) ? 'completed' : 'pending')

const modeTone = (mode) => (mode === 'Home Visit' ? 'success' : mode === 'Voice Call' || mode === 'Video Call' ? 'info' : 'neutral')

const refundTone = (status) => (status === 'Refund Failed' ? 'danger' : status === 'Refunded' ? 'success' : 'warning')

const MODE_ICONS = { 'Video Call': Video, 'Voice Call': Phone, 'Home Visit': Home }

const Avatar = ({ src, className }) =>
  src ? (
    <img className={`shrink-0 rounded-full bg-surface-sunken object-cover ${className}`} src={src} alt='' />
  ) : (
    <span aria-hidden='true' className={`flex shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-3 ${className}`}>
      <User className='size-1/2' />
    </span>
  )

const FilterChip = ({ label, clearLabel, onClear }) => (
  <span className='inline-flex max-w-full items-center gap-1 rounded-full bg-primary-soft py-0.5 ps-3 pe-0.5 text-caption font-semibold text-brand'>
    <span className='truncate'>{label}</span>
    <button type='button' aria-label={clearLabel} title={clearLabel} onClick={onClear} className='flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-surface'>
      <X aria-hidden='true' className='size-3' />
    </button>
  </span>
)

const ListSkeleton = () => (
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
)

const AllAppointments = () => {
  const location = useLocation()
  const scope = location.pathname === '/actual-appointments' ? 'actual' : location.pathname === '/finished-appointments' ? 'finished' : 'all'

  const { aToken, appointments, getAllAppointments, cancelAppointment, bulkCancelAppointments } = useContext(AdminContext)
  const { slotDateFormat, currency } = useContext(AppContext)
  const { t, tc, localizeDigits, isRtl } = useLanguage()

  const [searchQuery, setSearchQuery] = useState(() => String(location.state?.search || ''))
  const [showFilters, setShowFilters] = useState(false)
  const [isLoading, setIsLoading] = useState(Boolean(aToken))
  const [filters, setFilters] = useState(NO_FILTERS)
  const [selected, setSelected] = useState([])
  const [cancelTarget, setCancelTarget] = useState(null)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [busy, setBusy] = useState(false)

  /* Each arrival starts clean: another of the three routes, or a search from the command palette */
  const [seenLocationKey, setSeenLocationKey] = useState(location.key)
  if (seenLocationKey !== location.key) {
    setSeenLocationKey(location.key)
    setSearchQuery(String(location.state?.search || ''))
    setFilters(NO_FILTERS)
    setSelected([])
  }

  useEffect(() => {
    if (!aToken) return undefined
    let active = true
    Promise.resolve(getAllAppointments()).finally(() => {
      if (active) setIsLoading(false)
    })
    return () => {
      active = false
    }
    // getAllAppointments is rebuilt on every provider render, so listing it would refetch forever
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  const scopePool = useMemo(() => {
    const list = appointments || []
    if (scope === 'actual') return list.filter(isRowActual)
    if (scope === 'finished') return list.filter((item) => !isRowActual(item))
    return list
  }, [appointments, scope])

  const filteredAppointments = useMemo(() => {
    let result = scopePool

    const query = normalizeSearch(searchQuery)
    if (query) result = result.filter((item) => searchTextFor(item).includes(query))

    if (filters.status !== 'all') result = result.filter((item) => statusKeyOf(item) === filters.status)

    const matchesRange = DATE_RANGE_MATCHES[filters.dateRange]
    if (matchesRange) {
      result = result.filter((item) => {
        const date = parseSlotDate(item.slotDate)
        return date ? matchesRange(daysFromToday(date)) : false
      })
    }

    return result
  }, [scopePool, searchQuery, filters])

  const counts = useMemo(() => {
    const tally = { pending: 0, completed: 0, cancelled: 0, today: 0 }
    scopePool.forEach((item) => {
      tally[statusKeyOf(item)] += 1
      const date = parseSlotDate(item.slotDate)
      if (date && daysFromToday(date) === 0) tally.today += 1
    })
    return tally
  }, [scopePool])

  /* Only a visit still on the schedule can be cancelled */
  const canSelect = scope !== 'finished'
  const selectableIds = canSelect ? filteredAppointments.filter((item) => isRowActual(item) && item._id).map((item) => item._id) : []
  const selection = selectionFor(selected, selectableIds)
  const gridTemplate = canSelect ? GRID_WITH_SELECT : GRID_NO_SELECT

  const toggleOne = (id, checked) => setSelected((current) => (checked ? [...current, id] : current.filter((value) => value !== id)))

  const clearFilters = () => {
    setSearchQuery('')
    setFilters(NO_FILTERS)
  }

  const hasActiveFilters = Boolean(searchQuery.trim()) || filters.status !== 'all' || filters.dateRange !== 'all'

  const pageMeta =
    scope === 'actual'
      ? {
          title: t('Actual Appointments'),
          subtitle: t('Active visits only — not completed and not cancelled. Use the sidebar “All Appointments” to see everything.'),
        }
      : scope === 'finished'
        ? {
            title: t('Finished Appointments'),
            subtitle: t('Completed or cancelled visits. Archived records are under Appointment History.'),
          }
        : {
            title: t('All Appointments'),
            subtitle: t('Monitor and manage every appointment in the system.'),
          }

  const statusLabels = { pending: t('Pending'), completed: t('Completed'), cancelled: t('Cancelled') }
  const dateLabels = {
    today: t('Today'),
    tomorrow: t('Tomorrow'),
    week: t('Last 7 Days'),
    '15days': t('Last 15 Days'),
    month: t('Last 30 Days'),
  }
  const statusOptions = scope === 'finished' ? ['completed', 'cancelled'] : ['pending', 'completed', 'cancelled']

  const patientName = (item) => item.userData?.name || t('Unknown patient')
  const doctorName = (item) => tc(item.docData?.i18n?.name) || item.docData?.name || t('Unknown doctor')
  const doctorSpeciality = (item) => tc(item.docData?.i18n?.speciality) || tc(item.docData?.speciality) || ''
  const formatSlotDate = (item) => (parseSlotDate(item.slotDate) ? localizeDigits(slotDateFormat(item.slotDate)) : NO_VALUE)
  const formatSlotTime = (item) => (item.slotTime ? localizeDigits(item.slotTime) : NO_VALUE)
  const formatAmount = (item) => (item.amount === null || item.amount === undefined ? NO_VALUE : `${currency}${localizeDigits(item.amount)}`)
  const formatPayment = (item) => [t(item.paymentStatus || 'Not Paid'), item.paymentMethod ? t(item.paymentMethod) : ''].filter(Boolean).join(' - ')
  const formatHomeAddress = (address) =>
    [
      address?.area ? t(address.area) : '',
      address?.street,
      address?.building ? `${t('Building')} ${address.building}` : '',
      address?.floor ? `${t('Floor')} ${address.floor}` : '',
      address?.apartment ? `${t('Apartment')} ${address.apartment}` : '',
    ]
      .filter(Boolean)
      .join(isRtl ? '، ' : ', ')

  const cancelWarning = t('This cancels the visit and frees the time slot. The patient is notified, and a refund is requested for card payments.')

  const closeDialogs = () => {
    if (busy) return
    setCancelTarget(null)
    setConfirmBulk(false)
  }

  /* cancelAppointment shows its own result and refreshes the list */
  const confirmCancelOne = async () => {
    setBusy(true)
    await cancelAppointment(cancelTarget._id)
    setBusy(false)
    setCancelTarget(null)
  }

  const confirmCancelSelected = async () => {
    setBusy(true)
    const result = await bulkCancelAppointments(selection.ids)
    if (result) {
      const cancelled = result.cancelled || 0
      const failed = result.failed || []
      const summary = `${t('Appointments cancelled')}: ${localizeDigits(cancelled)}`
      if (!failed.length) {
        notify.success(summary)
      } else {
        const message = `${summary}. ${t('Could not be cancelled')}: ${localizeDigits(failed.length)}. ${t(failed[0].message) || ''}`
        if (cancelled) notify.warning(message)
        else notify.error(message)
      }
      /* What failed stays selected, so it is clear which ones are left */
      setSelected(failed.map((entry) => entry.appointmentId))
      await getAllAppointments()
    }
    setBusy(false)
    setConfirmBulk(false)
  }

  const exportRows = () => {
    downloadCsv(
      `${scope}-appointments`,
      [
        { label: t('Reservation'), value: getReservationNumber },
        { label: t('Patient'), value: (row) => row.userData?.name || '' },
        { label: t('Patient ID'), value: (row) => row.userData?.patientId || '' },
        { label: t('Age'), value: (row) => ageFrom(row.userData?.dob) },
        { label: t('Date'), value: formatSlotDate },
        { label: t('Time'), value: (row) => row.slotTime || '' },
        { label: t('Visit type'), value: (row) => t(getAppointmentMode(row)) },
        { label: t('Address'), value: (row) => (getAppointmentMode(row) === 'Home Visit' ? formatHomeAddress(row.homeVisitAddress) : '') },
        { label: t('Doctor'), value: (row) => tc(row.docData?.i18n?.name) || row.docData?.name || '' },
        { label: t('Speciality'), value: doctorSpeciality },
        { label: t('Fees'), value: (row) => row.amount },
        { label: t('Payment'), value: formatPayment },
        { label: t('Refund'), value: (row) => (row.refundStatus && row.refundStatus !== 'Not Refunded' ? t(row.refundStatus) : '') },
        { label: t('Status'), value: (row) => statusLabels[statusKeyOf(row)] },
      ],
      filteredAppointments,
    )
  }

  const statCards =
    scope === 'actual'
      ? [
          { key: 'total', label: t('Total'), value: scopePool.length, icon: ListChecks, onClick: () => setFilters(NO_FILTERS) },
          { key: 'today', label: t('Today'), value: counts.today, icon: CalendarDays, onClick: () => setFilters({ ...NO_FILTERS, dateRange: 'today' }) },
        ]
      : [
          { key: 'total', label: t('Total'), value: scopePool.length, icon: ListChecks, onClick: () => setFilters(NO_FILTERS) },
          ...(scope === 'all'
            ? [{ key: 'pending', label: t('Pending'), value: counts.pending, icon: Clock, tone: 'text-warning-ink', onClick: () => setFilters({ ...filters, status: 'pending' }) }]
            : []),
          { key: 'completed', label: t('Completed'), value: counts.completed, icon: CheckCircle2, tone: 'text-success-ink', onClick: () => setFilters({ ...filters, status: 'completed' }) },
          { key: 'cancelled', label: t('Cancelled'), value: counts.cancelled, icon: Ban, tone: 'text-danger-ink', onClick: () => setFilters({ ...filters, status: 'cancelled' }) },
        ]

  return (
    <AdminPage
      title={pageMeta.title}
      description={pageMeta.subtitle}
      icon={ClipboardList}
      actions={
        <>
          <Button
            variant='secondary'
            size='sm'
            aria-expanded={showFilters}
            onClick={() => setShowFilters(!showFilters)}
            leadingIcon={<SlidersHorizontal aria-hidden='true' className='size-4' />}
            trailingIcon={showFilters ? <ChevronUp aria-hidden='true' className='size-4' /> : <ChevronDown aria-hidden='true' className='size-4' />}
          >
            {t('Filters')}
          </Button>
          <ExportButton onExport={exportRows} disabled={isLoading || filteredAppointments.length === 0} />
        </>
      }
    >
      <div className='mb-4 grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]'>
        {statCards.map(({ key, value, ...card }) => (
          <StatCard key={key} value={localizeDigits(value)} {...card} />
        ))}
      </div>

      <div className='mb-4 rounded-card border border-line bg-surface p-3 shadow-e1 sm:p-4'>
        <div data-input-field className='relative'>
          <Search aria-hidden='true' className='pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3' />
          <Input
            type='search'
            aria-label={t('Search appointments')}
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

        {showFilters && (
          <div className='mt-3 grid gap-3 rounded-control bg-surface-sunken p-3 sm:grid-cols-2 sm:p-4'>
            {scope !== 'actual' && (
              <Field label={t('Status')}>
                <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                  <option value='all'>{t('All Status')}</option>
                  {statusOptions.map((value) => (
                    <option key={value} value={value}>
                      {statusLabels[value]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={t('Date Range')}>
              <Select value={filters.dateRange} onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}>
                <option value='all'>{t('All Dates')}</option>
                {Object.entries(dateLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {/* Outside the panel: a filter still applies after the panel is closed */}
        {hasActiveFilters && (
          <div className='mt-3 flex flex-wrap items-center gap-2'>
            {searchQuery.trim() && <FilterChip label={`${t('Search')}: ${searchQuery.trim()}`} clearLabel={t('Clear search')} onClear={() => setSearchQuery('')} />}
            {filters.status !== 'all' && <FilterChip label={`${t('Status')}: ${statusLabels[filters.status]}`} clearLabel={t('Clear status filter')} onClear={() => setFilters({ ...filters, status: 'all' })} />}
            {filters.dateRange !== 'all' && <FilterChip label={`${t('Date')}: ${dateLabels[filters.dateRange]}`} clearLabel={t('Clear date filter')} onClear={() => setFilters({ ...filters, dateRange: 'all' })} />}
            <Button variant='ghost' size='sm' onClick={clearFilters}>
              {t('Clear all')}
            </Button>
          </div>
        )}
      </div>

      <BulkBar count={selection.count} onClear={() => setSelected([])}>
        <Button variant='danger' size='sm' onClick={() => setConfirmBulk(true)} leadingIcon={<Ban aria-hidden='true' className='size-4' />}>
          {t('Cancel selected')}
        </Button>
      </BulkBar>

      <div className='mb-2 flex min-h-6 flex-wrap items-center justify-between gap-2'>
        <p aria-live='polite' className='text-body-sm text-ink-3'>
          {`${t('Showing')}: ${localizeDigits(filteredAppointments.length)}`}
        </p>
        {selectableIds.length > 0 && !isLoading && (
          <label className='flex cursor-pointer items-center gap-2 text-body-sm font-medium text-ink-2 xl:hidden'>
            <SelectBox
              checked={selection.all}
              indeterminate={selection.some}
              onChange={(checked) => setSelected(checked ? selectableIds : [])}
              label={t('Select all')}
            />
            {t('Select all')}
          </label>
        )}
      </div>

      <div className='overflow-hidden rounded-card border border-line bg-surface text-body-sm text-ink-2 shadow-e1 xl:max-h-[75vh] xl:overflow-y-auto'>
        <div className={`sticky top-0 z-10 hidden items-center gap-3 border-b border-line bg-surface-sunken px-5 py-3 text-caption font-semibold text-ink-2 xl:grid ${gridTemplate}`}>
          {canSelect && (
            <span className='flex'>
              {selectableIds.length > 0 && (
                <SelectBox
                  checked={selection.all}
                  indeterminate={selection.some}
                  onChange={(checked) => setSelected(checked ? selectableIds : [])}
                  label={t('Select all')}
                />
              )}
            </span>
          )}
          <p>#</p>
          <p>{t('Patient')}</p>
          <p>{t('Patient ID')}</p>
          <p>{t('Age')}</p>
          <p>{t('Date & Time')}</p>
          <p>{t('Doctor')}</p>
          <p>{t('Fees')}</p>
          <p>{t('Action')}</p>
        </div>

        {isLoading ? (
          <ListSkeleton />
        ) : filteredAppointments.length === 0 ? (
          <EmptyState
            icon={<Search />}
            title={t('No appointments found')}
            description={hasActiveFilters ? t('Try adjusting your search or filters') : t('No appointments available')}
            action={
              hasActiveFilters ? (
                <Button variant='secondary' size='sm' onClick={clearFilters}>
                  {t('Clear all filters')}
                </Button>
              ) : null
            }
          />
        ) : (
          <ul>
            {filteredAppointments.map((item, index) => {
              const mode = getAppointmentMode(item)
              const ModeIcon = MODE_ICONS[mode]
              const age = ageFrom(item.userData?.dob)
              const isSelectable = canSelect && isRowActual(item) && Boolean(item._id)
              const reservation = getReservationNumber(item)
              const speciality = doctorSpeciality(item)
              const homeAddress = mode === 'Home Visit' ? formatHomeAddress(item.homeVisitAddress) : ''
              const hasRefund = item.refundStatus && item.refundStatus !== 'Not Refunded'

              return (
                <li
                  key={item._id || index}
                  className={`grid gap-3 border-b border-line p-4 last:border-b-0 hover:bg-surface-sunken/60 xl:items-center xl:px-5 xl:py-3 ${gridTemplate} ${
                    isSelectable ? 'grid-cols-[auto_minmax(0,1fr)]' : 'grid-cols-1'
                  }`}
                >
                  {isSelectable ? (
                    <label className='-m-2 flex cursor-pointer self-start p-2 xl:self-center'>
                      <SelectBox
                        checked={selected.includes(item._id)}
                        onChange={(checked) => toggleOne(item._id, checked)}
                        label={`${t('Select')} ${reservation}`}
                      />
                    </label>
                  ) : (
                    canSelect && <span aria-hidden='true' className='hidden xl:block' />
                  )}

                  <p className='hidden tabular-nums xl:block'>{localizeDigits(index + 1)}</p>

                  <div className='flex min-w-0 items-start gap-3 xl:items-center'>
                    <Avatar src={item.userData?.image} className='size-12 xl:size-10' />
                    <div className='min-w-0'>
                      <p className='truncate font-medium text-ink'>{patientName(item)}</p>
                      <p className='truncate text-caption font-semibold text-brand'>
                        <span dir='ltr'>{reservation}</span>
                      </p>
                      <div className='mt-0.5 text-caption text-ink-3 xl:hidden'>
                        {item.userData?.patientId && (
                          <p className='truncate'>
                            {`${t('Patient ID')}: `}
                            <span dir='ltr'>{item.userData.patientId}</span>
                          </p>
                        )}
                        {age !== null && <p>{`${t('Age')}: ${localizeDigits(age)}`}</p>}
                      </div>
                    </div>
                  </div>

                  <p className='hidden truncate xl:block'>
                    <span dir='ltr'>{item.userData?.patientId || NO_VALUE}</span>
                  </p>
                  <p className='hidden tabular-nums xl:block'>{age === null ? NO_VALUE : localizeDigits(age)}</p>

                  <div className='col-span-full min-w-0 xl:col-span-1'>
                    <p className='text-ink-2'>
                      {formatSlotDate(item)}
                      {' · '}
                      <span dir='ltr'>{formatSlotTime(item)}</span>
                    </p>
                    <Badge tone={modeTone(mode)} className='mt-1'>
                      {ModeIcon && <ModeIcon aria-hidden='true' className='size-3' />}
                      {t(mode)}
                    </Badge>
                    {homeAddress && <p className='mt-1 break-words text-caption text-success-ink'>{homeAddress}</p>}
                  </div>

                  <div className='col-span-full flex min-w-0 items-center gap-2 xl:col-span-1'>
                    <Avatar src={item.docData?.image} className='size-8' />
                    <div className='min-w-0'>
                      <p className='text-caption text-ink-3 xl:hidden'>{t('Doctor')}</p>
                      <p className='truncate font-medium text-ink'>{doctorName(item)}</p>
                      {speciality && <p className='truncate text-caption text-ink-3'>{speciality}</p>}
                    </div>
                  </div>

                  <div className='col-span-full flex min-w-0 flex-wrap items-center gap-1.5 xl:col-span-1 xl:block'>
                    <p className='font-medium text-ink tabular-nums'>{formatAmount(item)}</p>
                    <Badge tone={item.paymentStatus === 'Paid' ? 'success' : 'warning'} className='max-w-full whitespace-normal! xl:mt-1'>
                      {formatPayment(item)}
                    </Badge>
                    {hasRefund && (
                      <Badge tone={refundTone(item.refundStatus)} className='max-w-full whitespace-normal! xl:mt-1'>
                        {t(item.refundStatus)}
                      </Badge>
                    )}
                  </div>

                  <div className='col-span-full flex justify-end xl:col-span-1 xl:justify-start'>
                    {isRowCancelled(item) ? (
                      <Badge tone='danger'>{t('Cancelled')}</Badge>
                    ) : isRowFinished(item) ? (
                      <Badge tone='success'>{t('Completed')}</Badge>
                    ) : (
                      <Button
                        variant='secondary'
                        size='sm'
                        className='text-danger-ink!'
                        aria-label={`${t('Cancel appointment')}: ${patientName(item)}`}
                        onClick={() => setCancelTarget(item)}
                        leadingIcon={<X aria-hidden='true' className='size-4' />}
                      >
                        {t('Cancel')}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        danger
        busy={busy}
        title={t('Cancel this appointment?')}
        body={cancelTarget ? `${patientName(cancelTarget)} (${getReservationNumber(cancelTarget)}). ${cancelWarning}` : ''}
        confirmLabel={t('Cancel appointment')}
        onConfirm={confirmCancelOne}
        onClose={closeDialogs}
      />

      <ConfirmDialog
        open={confirmBulk}
        danger
        busy={busy}
        title={t('Cancel the selected appointments?')}
        body={`${t('Selected')}: ${localizeDigits(selection.count)}. ${cancelWarning}`}
        confirmLabel={t('Cancel selected')}
        onConfirm={confirmCancelSelected}
        onClose={closeDialogs}
      />
    </AdminPage>
  )
}

export default AllAppointments
