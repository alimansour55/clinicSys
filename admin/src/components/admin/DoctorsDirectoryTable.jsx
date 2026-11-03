import React from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Mail, Phone, RefreshCw, Search, Stethoscope, UserPlus, X, XCircle } from 'lucide-react'
import { RatingBadge } from '../DoctorRating'
import { useLanguage } from '../../i18n'
import { Badge, Button, EmptyState, Field, IconButton, Input, Select, Skeleton, SkeletonGroup } from '../ui'
import { AdminPage, BulkBar, ExportButton, SelectBox, StatCard, selectionFor } from './AdminPage'

const DoctorsDirectoryTable = ({
  doctors,
  sortedDoctors,
  doctorsLoading,
  doctorStats,
  currency,
  searchQuery,
  setSearchQuery,
  availabilityFilter,
  setAvailabilityFilter,
  sortBy,
  sortDir,
  setSortBy,
  setSortDir,
  refreshing,
  onRefresh,
  onOpenDoctor,
  onToggleAvailability,
  selected = [],
  onSelect,
  onBulkAvailability,
  onExport
}) => {
  const { t, tc, localizeDigits } = useLanguage()
  const visibleIds = sortedDoctors.map((doctor) => doctor._id)
  const selection = selectionFor(selected, visibleIds)

  return (
    <AdminPage
      icon={Stethoscope}
      title={t('All doctors')}
      description={t('Search and filter the directory, open a profile to edit fees and settings, or toggle availability from the list.')}
      actions={
        <>
          <Button as={Link} to='/add-doctor' size='sm' leadingIcon={<UserPlus aria-hidden='true' className='size-4' />}>
            {t('Add doctor')}
          </Button>
          {onExport && <ExportButton onExport={onExport} disabled={!sortedDoctors.length} />}
          <Button
            variant='secondary'
            size='sm'
            onClick={onRefresh}
            disabled={refreshing}
            leadingIcon={<RefreshCw aria-hidden='true' className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />}
          >
            {t('Refresh')}
          </Button>
        </>
      }
    >
      <div className='mb-4 grid grid-cols-3 gap-3'>
        <StatCard label={t('Total')} value={localizeDigits(doctorStats.total)} />
        <StatCard label={t('Available')} value={localizeDigits(doctorStats.available)} />
        <StatCard label={t('Unavailable')} value={localizeDigits(doctorStats.unavailable)} />
      </div>

      <div className='mb-4 grid grid-cols-1 gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_14rem_14rem_auto] lg:items-end'>
        <div className='relative sm:col-span-2 lg:col-span-1'>
          <Field label={t('Search')}>
            <Input className='ps-10 pe-11' value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('Search name, email, speciality, location…')} />
          </Field>
          <Search aria-hidden='true' className='pointer-events-none absolute bottom-3.5 start-3 size-4 text-ink-3' />
          {searchQuery && (
            <IconButton size='sm' variant='ghost' label={t('Clear search')} onClick={() => setSearchQuery('')} className='absolute bottom-1 end-1'>
              <X aria-hidden='true' className='size-4' />
            </IconButton>
          )}
        </div>
        <Field label={t('Availability')}>
          <Select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}>
            <option value='all'>{t('All availability')}</option>
            <option value='available'>{t('Available only')}</option>
            <option value='unavailable'>{t('Unavailable only')}</option>
          </Select>
        </Field>
        <Field label={t('Sort by')}>
          <Select
            value={`${sortBy}:${sortDir}`}
            onChange={(e) => {
              const [by, dir] = e.target.value.split(':')
              setSortBy(by)
              setSortDir(dir)
            }}
          >
            <option value='name:asc'>{t('Name A to Z')}</option>
            <option value='name:desc'>{t('Name Z to A')}</option>
            <option value='speciality:asc'>{t('Speciality A to Z')}</option>
            <option value='fees:desc'>{t('Highest fee')}</option>
            <option value='fees:asc'>{t('Lowest fee')}</option>
          </Select>
        </Field>
        <p className='pb-2.5 text-body-sm text-ink-3'>{`${t('Showing')} ${localizeDigits(sortedDoctors.length)} ${t('of')} ${localizeDigits(doctors.length)}`}</p>
      </div>

      {onSelect && (
        <BulkBar count={selection.count} onClear={() => onSelect([])}>
          <Button size='sm' variant='secondary' onClick={() => onBulkAvailability(selection.ids, true)} leadingIcon={<CheckCircle2 aria-hidden='true' className='size-4' />}>
            {t('Make available')}
          </Button>
          <Button size='sm' variant='secondary' onClick={() => onBulkAvailability(selection.ids, false)} leadingIcon={<XCircle aria-hidden='true' className='size-4' />}>
            {t('Make unavailable')}
          </Button>
        </BulkBar>
      )}

      <div className='overflow-hidden rounded-card border border-line bg-surface'>
        {doctorsLoading ? (
          <SkeletonGroup className='space-y-3 p-4'>
            {[0, 1, 2, 3].map((key) => (
              <Skeleton key={key} className='h-14 w-full' />
            ))}
          </SkeletonGroup>
        ) : sortedDoctors.length === 0 ? (
          <EmptyState
            icon={<Stethoscope aria-hidden='true' />}
            title={t('No doctors match')}
            description={t('Try another search or add a new doctor to the directory.')}
            action={
              <Button as={Link} to='/add-doctor' leadingIcon={<UserPlus aria-hidden='true' className='size-4' />}>
                {t('Add doctor')}
              </Button>
            }
          />
        ) : (
          <>
            {onSelect && (
              <label className='flex items-center gap-3 border-b border-line bg-surface-sunken px-4 py-2.5 text-caption font-semibold text-ink-3'>
                <SelectBox label={t('Select all')} checked={selection.all} indeterminate={selection.some} onChange={(on) => onSelect(on ? visibleIds : [])} />
                {t('Select all')}
              </label>
            )}
            <ul className='divide-y divide-line'>
              {sortedDoctors.map((doctor) => {
                const name = tc(doctor.i18n?.name) || doctor.name
                return (
                  <li key={doctor._id} className='flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5'>
                    {onSelect && (
                      <SelectBox
                        label={`${t('Select')} ${name}`}
                        checked={selected.includes(doctor._id)}
                        onChange={(on) => onSelect(on ? [...selected, doctor._id] : selected.filter((id) => id !== doctor._id))}
                      />
                    )}
                    <button type='button' onClick={() => onOpenDoctor(doctor._id)} className='flex min-w-0 flex-1 basis-56 cursor-pointer items-center gap-3 text-start'>
                      <span className='relative shrink-0'>
                        <img className='size-12 rounded-control border border-line bg-surface-sunken object-cover' src={doctor.image} alt='' />
                        <RatingBadge summary={doctor.ratingSummary} className='absolute -start-1 -top-1 scale-90' />
                      </span>
                      <span className='min-w-0'>
                        <span className='block truncate font-semibold text-ink'>{name}</span>
                        <span className='block truncate text-caption text-ink-3'>{tc(doctor.i18n?.speciality) || t(doctor.speciality)}</span>
                      </span>
                    </button>
                    <div className='min-w-0 flex-1 basis-52 text-body-sm'>
                      <p className='flex min-w-0 items-center gap-1.5 text-ink-2'>
                        <Mail aria-hidden='true' className='size-3.5 shrink-0 text-ink-3' />
                        <span dir='ltr' className='truncate'>{doctor.email}</span>
                      </p>
                      <p className='mt-0.5 flex items-center gap-1.5 text-caption text-ink-3'>
                        <Phone aria-hidden='true' className='size-3.5 shrink-0' />
                        <span dir='ltr'>{doctor.phone || t('No phone')}</span>
                      </p>
                    </div>
                    <p className='w-20 text-body-sm font-semibold tabular-nums text-ink'>
                      {String(doctor.fees ?? '').trim() !== '' ? `${currency}${localizeDigits(Number(doctor.fees).toLocaleString())}` : t('Global')}
                    </p>
                    <Badge tone={doctor.available !== false ? 'success' : 'danger'} dot>
                      {doctor.available !== false ? t('Available') : t('Unavailable')}
                    </Badge>
                    <div className='flex flex-wrap items-center gap-2'>
                      <label className='flex min-h-9 cursor-pointer items-center gap-2 rounded-control border border-line px-2.5 text-caption font-semibold text-ink-2'>
                        <input
                          type='checkbox'
                          checked={doctor.available !== false}
                          onChange={(e) => onToggleAvailability(doctor._id, e.target.checked, e)}
                          className='size-4 accent-(--color-primary)'
                        />
                        {t('Available')}
                      </label>
                      <Button variant='secondary' size='sm' onClick={() => onOpenDoctor(doctor._id)}>
                        {t('Open profile')}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </AdminPage>
  )
}

export default DoctorsDirectoryTable
