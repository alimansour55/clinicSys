import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Loader2, Mail, Phone, RefreshCw, Search, Sparkles, Stethoscope, UserPlus, X } from 'lucide-react'
import { RatingBadge } from '../DoctorRating'
import { useLanguage } from '../../i18n'

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
  onToggleAvailability
}) => {
  const { t } = useLanguage()

  return (
  <div className='w-full bg-[#f4f6fb] p-3 sm:p-5 md:p-6 lg:p-8'>
    <div className='mx-auto max-w-7xl'>
      <div className='overflow-hidden rounded-2xl border border-slate-700/20 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-800 shadow-xl'>
        <div className='relative px-5 py-8 sm:px-8 sm:py-10'>
          <div className='relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between'>
            <div className='max-w-2xl'>
              <div className='inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/90 ring-1 ring-white/20'>
                <Sparkles className='h-3.5 w-3.5' />
                Doctor directory
              </div>
              <h1 className='mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl'>All doctors</h1>
              <p className='mt-3 text-sm leading-relaxed text-white/85 sm:text-base'>
                Search and filter the directory, open a profile to edit fees and settings, or toggle availability from the list.
              </p>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <Link
                to='/add-doctor'
                className='inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-md transition hover:bg-white/95'
              >
                <UserPlus className='h-4 w-4 text-primary' />
                {t('Add doctor')}
              </Link>
              <button
                type='button'
                onClick={onRefresh}
                disabled={refreshing}
                aria-label={t('Refresh')}
                className='inline-flex items-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50'
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {t('Refresh')}
              </button>
            </div>
          </div>
          <div className='relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3'>
            {[
              { label: 'Total', value: doctorStats.total },
              { label: 'Available', value: doctorStats.available },
              { label: 'Unavailable', value: doctorStats.unavailable }
            ].map(({ label, value }) => (
              <div key={label} className='rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm'>
                <p className='text-xs font-semibold uppercase tracking-wide text-white/70'>{label}</p>
                <p className='mt-1 text-2xl font-bold tabular-nums text-white'>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='mt-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 lg:flex-row lg:items-end lg:justify-between'>
        <div className='grid w-full gap-3 sm:grid-cols-2 lg:max-w-4xl lg:grid-cols-3'>
          <div className='relative sm:col-span-2 lg:col-span-1'>
            <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search name, email, speciality, location…'
              className='w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
            />
            {searchQuery && (
              <button type='button' onClick={() => setSearchQuery('')} className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600' aria-label='Clear search'>
                <X className='h-4 w-4' />
              </button>
            )}
          </div>
          <div className='relative'>
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className='w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-10 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
            >
              <option value='all'>All availability</option>
              <option value='available'>Available only</option>
              <option value='unavailable'>Unavailable only</option>
            </select>
            <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
          </div>
          <div className='relative'>
            <select
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [by, dir] = e.target.value.split(':')
                setSortBy(by)
                setSortDir(dir)
              }}
              className='w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-10 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
            >
              <option value='name:asc'>Name A → Z</option>
              <option value='name:desc'>Name Z → A</option>
              <option value='speciality:asc'>Speciality A → Z</option>
              <option value='fees:desc'>Highest fee</option>
              <option value='fees:asc'>Lowest fee</option>
            </select>
            <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
          </div>
        </div>
        <p className='text-center text-sm font-medium text-gray-600 lg:text-right'>
          Showing <span className='font-bold text-gray-900'>{sortedDoctors.length}</span> of {doctors.length}
        </p>
      </div>

      <div className='mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm'>
        <div className='hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.75fr)_minmax(0,1.1fr)] gap-3 border-b border-gray-100 bg-gray-50/90 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 xl:grid'>
          <span>Doctor</span>
          <span>Contact</span>
          <span>Speciality</span>
          <span>Fee</span>
          <span>Status</span>
          <span className='text-right'>Actions</span>
        </div>

        {doctorsLoading ? (
          <div className='flex items-center justify-center py-20 text-gray-500'>
            <Loader2 className='h-9 w-9 animate-spin text-indigo-600' />
          </div>
        ) : sortedDoctors.length === 0 ? (
          <div className='px-6 py-16 text-center'>
            <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400'>
              <Stethoscope className='h-8 w-8' />
            </div>
            <p className='mt-4 text-lg font-semibold text-gray-900'>No doctors match</p>
            <p className='mt-1 text-sm text-gray-600'>Try another search or add a new doctor to the directory.</p>
            <Link
              to='/add-doctor'
              className='mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700'
            >
              <UserPlus className='h-4 w-4' />
              {t('Add doctor')}
            </Link>
          </div>
        ) : (
          <ul className='divide-y divide-gray-100'>
            {sortedDoctors.map((doctor) => (
              <li key={doctor._id} className='transition hover:bg-slate-50/80'>
                <div className='grid grid-cols-1 gap-3 px-4 py-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.75fr)_minmax(0,1.1fr)] xl:items-center xl:gap-3'>
                  <div className='flex min-w-0 items-center gap-3'>
                    <div className='relative shrink-0'>
                      <img className='h-12 w-12 rounded-xl border border-gray-200 bg-gray-100 object-cover shadow-sm' src={doctor.image} alt='' />
                      <RatingBadge summary={doctor.ratingSummary} className='absolute -left-1 -top-1 scale-90' />
                    </div>
                    <div className='min-w-0'>
                      <p className='truncate font-semibold text-gray-900'>{doctor.name}</p>
                      <p className='truncate text-xs text-gray-500 xl:hidden'>
                        {doctor.locations?.length ? doctor.locations.join(', ') : 'No location'}
                      </p>
                    </div>
                  </div>
                  <div className='min-w-0 text-sm'>
                    <p className='flex items-center gap-1.5 truncate font-medium text-gray-800'>
                      <Mail className='h-3.5 w-3.5 shrink-0 text-indigo-600' />
                      {doctor.email}
                    </p>
                    <p className='mt-0.5 flex items-center gap-1.5 truncate text-xs text-gray-500'>
                      <Phone className='h-3.5 w-3.5 shrink-0 text-gray-400' />
                      {doctor.phone || 'No phone'}
                    </p>
                  </div>
                  <p className='text-sm font-medium text-gray-800'>{doctor.speciality}</p>
                  <p className='text-sm font-bold tabular-nums text-gray-900'>
                    {String(doctor.fees ?? '').trim() !== ''
                      ? `${currency}${Number(doctor.fees).toLocaleString()}`
                      : 'Global'}
                  </p>
                  <div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${doctor.available !== false ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                      {doctor.available !== false ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                  <div className='flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-3 xl:border-t-0 xl:pt-0'>
                    <label className='inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700'>
                      <input
                        type='checkbox'
                        checked={doctor.available !== false}
                        onChange={(e) => onToggleAvailability(doctor._id, e.target.checked, e)}
                        className='accent-indigo-600'
                      />
                      Available
                    </label>
                    <button
                      type='button'
                      onClick={() => onOpenDoctor(doctor._id)}
                      className='rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700'
                    >
                      Open profile
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  </div>
  )
}

export default DoctorsDirectoryTable
