import React, { useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { CalendarClock, MapPin, Phone, Plus, Save, Video, X } from 'lucide-react'
import { toast } from 'react-toastify'
import { DoctorContext } from '../../context/DoctorContext'
import { useLanguage } from '../../i18n'
import { parseMinutes } from '../../utils/schedule'
import { supportedHomeVisitAreas } from '../../utils/homeVisitAreas'

const dayOptions = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
]

const defaultSchedule = {
  workingDays: [0, 1, 2, 3, 4, 5, 6],
  startTime: '10:00',
  endTime: '21:00',
  breaks: [],
  slotDuration: 30,
  blockedDates: []
}

const defaultHomeVisitSchedule = {
  ...defaultSchedule,
  workingDays: [],
  slotDuration: 60
}

const toDateInputValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const todayKey = toDateInputValue(new Date())

const DoctorAvailability = () => {
  const { dToken, profileData, setProfileData, getProfileData, backendUrl } = useContext(DoctorContext)
  const { t } = useLanguage()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (dToken) getProfileData()
  }, [dToken])

  const schedule = useMemo(() => ({ ...defaultSchedule, ...(profileData?.schedule || {}) }), [profileData])
  const locationSchedules = useMemo(() => profileData?.locationSchedules || {}, [profileData])
  const homeVisitSchedule = useMemo(() => ({ ...defaultHomeVisitSchedule, ...(profileData?.homeVisitSchedule || {}) }), [profileData])
  const homeVisitAreas = useMemo(
    () => (Array.isArray(profileData?.homeVisitAreas) ? profileData.homeVisitAreas : []),
    [profileData]
  )

  const nextYearKey = useMemo(() => {
    const date = new Date()
    date.setFullYear(date.getFullYear() + 1)
    return toDateInputValue(date)
  }, [])

  const updateSchedule = (changes, key = 'schedule', defaults = defaultSchedule) => {
    setProfileData((prev) => ({
      ...prev,
      [key]: { ...defaults, ...(prev[key] || {}), ...changes }
    }))
  }

  const updateLocationSchedule = (location, changes) => {
    setProfileData((prev) => ({
      ...prev,
      locationSchedules: {
        ...(prev.locationSchedules || {}),
        [location]: {
          ...defaultSchedule,
          ...(prev.schedule || {}),
          ...(prev.locationSchedules?.[location] || {}),
          ...changes
        }
      }
    }))
  }

  const removeLocationSchedule = (location) => {
    setProfileData((prev) => {
      const newLocationSchedules = { ...(prev.locationSchedules || {}) }
      delete newLocationSchedules[location]
      return { ...prev, locationSchedules: newLocationSchedules }
    })
  }

  const toggleLocationWorkingDay = (location, locationSchedule, day) => {
    const workingDays = locationSchedule.workingDays.includes(day)
      ? locationSchedule.workingDays.filter((item) => item !== day)
      : [...locationSchedule.workingDays, day].sort((a, b) => a - b)
    updateLocationSchedule(location, { workingDays })
    if (workingDays.length > 0) {
      setProfileData((prev) => ({ ...prev, available: true }))
    }
  }

  const addLocationBreak = (location, targetSchedule) => updateLocationSchedule(location, { breaks: [...targetSchedule.breaks, { startTime: '13:00', endTime: '14:00' }] })
  const removeLocationBreak = (location, index, targetSchedule) => updateLocationSchedule(location, { breaks: targetSchedule.breaks.filter((_, itemIndex) => itemIndex !== index) })
  const updateLocationBreak = (location, index, field, value, targetSchedule) => {
    const breaks = [...targetSchedule.breaks]
    breaks[index] = { ...breaks[index], [field]: value }
    updateLocationSchedule(location, { breaks })
  }

  const setPreset = (workingDays, key = 'schedule', defaults = defaultSchedule) => updateSchedule({ workingDays }, key, defaults)

  const toggleWorkingDay = (targetSchedule, day, key = 'schedule', defaults = defaultSchedule) => {
    const workingDays = targetSchedule.workingDays.includes(day)
      ? targetSchedule.workingDays.filter((item) => item !== day)
      : [...targetSchedule.workingDays, day].sort((a, b) => a - b)
    updateSchedule({ workingDays }, key, defaults)
    if (workingDays.length > 0) {
      setProfileData((prev) => ({ ...prev, available: true }))
    }
  }

  const updateBreak = (targetSchedule, index, field, value, key = 'schedule', defaults = defaultSchedule) => {
    const breaks = [...targetSchedule.breaks]
    breaks[index] = { ...breaks[index], [field]: value }
    updateSchedule({ breaks }, key, defaults)
  }

  const addBreak = (targetSchedule, key = 'schedule', defaults = defaultSchedule) => updateSchedule({ breaks: [...targetSchedule.breaks, { startTime: '13:00', endTime: '14:00' }] }, key, defaults)
  const removeBreak = (targetSchedule, index, key = 'schedule', defaults = defaultSchedule) => updateSchedule({ breaks: targetSchedule.breaks.filter((_, itemIndex) => itemIndex !== index) }, key, defaults)

  const addBlockedDate = (targetSchedule, value, key = 'schedule', defaults = defaultSchedule) => {
    if (!value) return
    if (value < todayKey) return toast.warn('Past dates cannot be added')
    if (targetSchedule.blockedDates.includes(value)) return
    updateSchedule({ blockedDates: [...targetSchedule.blockedDates, value].sort() }, key, defaults)
  }

  const removeBlockedDate = (targetSchedule, value, key = 'schedule', defaults = defaultSchedule) => updateSchedule({ blockedDates: targetSchedule.blockedDates.filter((item) => item !== value) }, key, defaults)

  const toggleHomeVisitArea = (area) => {
    setProfileData((prev) => {
      const current = Array.isArray(prev.homeVisitAreas) ? [...prev.homeVisitAreas] : []
      const next = current.includes(area)
        ? current.filter((item) => item !== area)
        : [...current, area].sort((a, b) => a.localeCompare(b))
      return { ...prev, homeVisitAreas: next }
    })
  }

  const timeRangeOk = (s) => {
    const a = parseMinutes(s.startTime)
    const b = parseMinutes(s.endTime)
    return a != null && b != null && a < b
  }

  const saveSchedule = async () => {
    if (!profileData) return
    if (schedule.workingDays.length === 0) return toast.warn('Choose at least one working day')
    if (!timeRangeOk(schedule)) return toast.warn('Start time must be before end time')
    if (homeVisitSchedule.workingDays.length > 0 && !timeRangeOk(homeVisitSchedule)) return toast.warn('Home visit start time must be before end time')
    if (homeVisitSchedule.workingDays.length > 0 && homeVisitAreas.length === 0) {
      return toast.warn('Select at least one area you can visit for home appointments')
    }
    for (const loc of Object.keys(locationSchedules || {})) {
      const ls = { ...defaultSchedule, ...schedule, ...(locationSchedules[loc] || {}) }
      if ((ls.workingDays || []).length > 0 && !timeRangeOk(ls)) {
        return toast.warn(`Branch "${loc}": start time must be before end time`)
      }
    }

    const hasClinicSchedule =
      schedule.workingDays.length > 0 ||
      Object.values(locationSchedules || {}).some((entry) => (entry?.workingDays || []).length > 0)

    setSaving(true)
    try {
      const { data } = await axios.post(
        backendUrl + '/api/doctor/update-profile',
        {
          address: profileData.address,
          available: hasClinicSchedule ? true : profileData.available,
          acceptsVoiceCall: profileData.acceptsVoiceCall !== false,
          acceptsVideoCall: profileData.acceptsVideoCall !== false,
          schedule,
          locationSchedules,
          homeVisitSchedule,
          homeVisitAreas
        },
        { headers: { dToken } }
      )

      if (data.success) {
        toast.success('Availability saved')
        getProfileData()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  if (!profileData) {
    return <div className='p-6 text-sm text-gray-500'>Loading availability...</div>
  }

  return (
    <div className='w-full p-3 sm:p-5 md:p-6 lg:p-8'>
      <div className='max-w-5xl'>
        <div className='mb-6'>
          <h1 className='flex items-center gap-2 text-xl md:text-3xl font-bold text-gray-800'>
            <CalendarClock className='w-6 h-6 text-primary' />
            Availability
          </h1>
          <p className='text-sm text-gray-600 mt-1 ml-8'>Set your weekly working pattern once, then block breaks or unavailable dates when needed.</p>
        </div>

        <div className='bg-white border rounded-lg p-5 md:p-6 space-y-6'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <p className='font-semibold text-gray-800'>{profileData.name}</p>
              <p className='text-sm text-gray-500'>{profileData.speciality}</p>
            </div>
            <label className='inline-flex items-center gap-2 text-sm font-medium text-gray-700'>
              <input type='checkbox' checked={profileData.available} onChange={() => setProfileData((prev) => ({ ...prev, available: !prev.available }))} />
              Accepting appointments
            </label>
          </div>

          <div className='rounded-lg border border-indigo-100 bg-indigo-50 p-4'>
            <p className='text-sm font-semibold text-gray-800'>Remote consultation options</p>
            <p className='mt-1 text-sm text-gray-600'>Enabled call types will appear to patients and receptionists while booking.</p>
            <div className='mt-3 grid gap-3 sm:grid-cols-2'>
              <label className='flex items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-gray-700'>
                <span className='flex items-center gap-2'>
                  <Phone className='h-4 w-4 text-indigo-600' />
                  Voice calls
                </span>
                <input type='checkbox' checked={profileData.acceptsVoiceCall !== false} onChange={(e) => setProfileData((prev) => ({ ...prev, acceptsVoiceCall: e.target.checked }))} className='accent-primary' />
              </label>
              <label className='flex items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-gray-700'>
                <span className='flex items-center gap-2'>
                  <Video className='h-4 w-4 text-indigo-600' />
                  Video calls
                </span>
                <input type='checkbox' checked={profileData.acceptsVideoCall !== false} onChange={(e) => setProfileData((prev) => ({ ...prev, acceptsVideoCall: e.target.checked }))} className='accent-primary' />
              </label>
            </div>
          </div>

          <div>
            <p className='text-sm font-semibold text-gray-700 mb-2'>Repeat schedule</p>
            <div className='flex flex-wrap gap-2 mb-3'>
              <button type='button' onClick={() => setPreset([0, 1, 2, 3, 4, 5, 6])} className='rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'>7 days</button>
              <button type='button' onClick={() => setPreset([1, 2, 3, 4, 5])} className='rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'>Weekdays</button>
              <button type='button' onClick={() => setPreset([0, 2, 4])} className='rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'>Sun Tue Thu</button>
            </div>
            <div className='flex flex-wrap gap-2'>
              {dayOptions.map((day) => (
                <button
                  type='button'
                  key={day.value}
                  onClick={() => toggleWorkingDay(schedule, day.value)}
                  className={`min-w-14 rounded-lg border px-3 py-2 text-sm font-semibold ${schedule.workingDays.includes(day.value) ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {(profileData.locations || []).length > 0 && (
            <div className='rounded-lg border border-blue-100 bg-blue-50 p-4 md:p-5'>
              <div className='mb-4'>
                <p className='flex items-center gap-2 text-base font-semibold text-gray-800'>
                  <MapPin className='h-4 w-4 text-blue-600' />
                  Clinic branch availability
                </p>
                <p className='mt-1 text-sm text-gray-600'>
                  {t('Each branch can override the repeat schedule below. The same date and time cannot be booked at two branches; the booking screen greys out slots already chosen elsewhere.')}
                </p>
              </div>
              <div className='space-y-4'>
                {profileData.locations.map((location) => {
                  const locationSchedule = { ...defaultSchedule, ...schedule, ...(locationSchedules[location] || {}) }
                  return (
                    <div key={location} className='rounded-lg border border-blue-100 bg-white p-4'>
                      <div className='mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
                        <p className='font-semibold text-gray-900'>{location}</p>
                        <div className='flex gap-2'>
                          <button type='button' onClick={() => updateLocationSchedule(location, schedule)} className='text-xs font-semibold text-blue-700 hover:text-blue-900'>Use main schedule</button>
                          <button type='button' onClick={() => removeLocationSchedule(location)} className='text-xs font-semibold text-red-600 hover:text-red-800'>Clear custom</button>
                        </div>
                      </div>
                      
                      <div className='mb-4 flex flex-wrap gap-2'>
                        {dayOptions.map((day) => (
                          <button
                            type='button'
                            key={day.value}
                            onClick={() => toggleLocationWorkingDay(location, locationSchedule, day.value)}
                            className={`min-w-12 rounded-lg border px-3 py-2 text-xs font-semibold ${locationSchedule.workingDays.includes(day.value) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                      
                      <div className='grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4'>
                        <label className='text-sm font-semibold text-gray-700'>
                          Start time
                          <input type='time' value={locationSchedule.startTime} onChange={(e) => updateLocationSchedule(location, { startTime: e.target.value })} className='mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500' />
                        </label>
                        <label className='text-sm font-semibold text-gray-700'>
                          End time
                          <input type='time' value={locationSchedule.endTime} onChange={(e) => updateLocationSchedule(location, { endTime: e.target.value })} className='mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500' />
                        </label>
                        <label className='text-sm font-semibold text-gray-700'>
                          Slot duration
                          <select value={locationSchedule.slotDuration} onChange={(e) => updateLocationSchedule(location, { slotDuration: Number(e.target.value) })} className='mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500'>
                            <option value={10}>10 minutes</option>
                            <option value={15}>15 minutes</option>
                            <option value={20}>20 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={45}>45 minutes</option>
                            <option value={60}>60 minutes</option>
                          </select>
                        </label>
                      </div>

                      <div className='border-t border-gray-200 pt-4'>
                        <div className='flex items-center justify-between gap-3 mb-2'>
                          <p className='text-xs font-semibold text-gray-700'>Breaks for {location}</p>
                          <button type='button' onClick={() => addLocationBreak(location, locationSchedule)} className='inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50'>
                            <Plus className='w-3 h-3' />
                            Add break
                          </button>
                        </div>
                        <div className='space-y-2'>
                          {locationSchedule.breaks.length === 0 && <p className='text-xs text-gray-500'>No breaks added.</p>}
                          {locationSchedule.breaks.map((item, index) => (
                            <div key={index} className='grid grid-cols-[1fr_1fr_auto] gap-2 items-center'>
                              <input type='time' value={item.startTime} onChange={(e) => updateLocationBreak(location, index, 'startTime', e.target.value, locationSchedule)} className='border rounded-lg px-2 py-1 text-sm' />
                              <input type='time' value={item.endTime} onChange={(e) => updateLocationBreak(location, index, 'endTime', e.target.value, locationSchedule)} className='border rounded-lg px-2 py-1 text-sm' />
                              <button type='button' onClick={() => removeLocationBreak(location, index, locationSchedule)} className='rounded-lg border border-red-200 p-1 text-red-600 hover:bg-red-50'>
                                <X className='w-3 h-3' />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <label className='text-sm font-semibold text-gray-700'>
              Start time
              <input type='time' value={schedule.startTime} onChange={(e) => updateSchedule({ startTime: e.target.value })} className='mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500' />
            </label>
            <label className='text-sm font-semibold text-gray-700'>
              End time
              <input type='time' value={schedule.endTime} onChange={(e) => updateSchedule({ endTime: e.target.value })} className='mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500' />
            </label>
            <label className='text-sm font-semibold text-gray-700'>
              Slot duration
              <select value={schedule.slotDuration} onChange={(e) => updateSchedule({ slotDuration: Number(e.target.value) })} className='mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500'>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={20}>20 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </label>
          </div>

          <div>
            <div className='flex items-center justify-between gap-3 mb-2'>
              <p className='text-sm font-semibold text-gray-700'>Breaks</p>
              <button type='button' onClick={() => addBreak(schedule)} className='inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-primary hover:bg-gray-50'>
                <Plus className='w-4 h-4' />
                Break
              </button>
            </div>
            <div className='space-y-2'>
              {schedule.breaks.length === 0 && <p className='text-sm text-gray-500'>No breaks added.</p>}
              {schedule.breaks.map((item, index) => (
                <div key={index} className='grid grid-cols-[1fr_1fr_auto] gap-2 items-center'>
                  <input type='time' value={item.startTime} onChange={(e) => updateBreak(schedule, index, 'startTime', e.target.value)} className='border rounded-lg px-3 py-2' />
                  <input type='time' value={item.endTime} onChange={(e) => updateBreak(schedule, index, 'endTime', e.target.value)} className='border rounded-lg px-3 py-2' />
                  <button type='button' onClick={() => removeBreak(schedule, index)} className='rounded-lg border p-2 text-red-600'>
                    <X className='w-4 h-4' />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className='text-sm font-semibold text-gray-700 mb-2'>Unavailable dates</p>
            <input type='date' min={todayKey} max={nextYearKey} onChange={(e) => { addBlockedDate(schedule, e.target.value); e.target.value = '' }} className='border rounded-lg px-3 py-2 mb-3' />
            <div className='flex flex-wrap gap-2'>
              {schedule.blockedDates.length === 0 && <p className='text-sm text-gray-500'>No unavailable dates added.</p>}
              {schedule.blockedDates.map((date) => (
                <span key={date} className='inline-flex items-center gap-2 rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-sm'>
                  {date}
                  <button type='button' onClick={() => removeBlockedDate(schedule, date)} className='text-red-600'>
                    <X className='w-3 h-3' />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className='rounded-lg border border-emerald-100 bg-emerald-50 p-4 md:p-5 space-y-5'>
            <div>
              <p className='text-base font-semibold text-gray-800'>Home visit availability</p>
              <p className='mt-1 text-sm text-gray-600'>These slots are shown only when patients or receptionists choose Home visit.</p>
            </div>

            <div>
              <p className='text-sm font-semibold text-gray-700 mb-2'>Areas you can visit</p>
              <p className='mb-3 text-xs text-gray-600'>Choose supported areas only. Patients see these when booking a home visit with you.</p>
              <div className='flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-lg border border-emerald-200 bg-white p-3'>
                {supportedHomeVisitAreas.map((area) => (
                  <button
                    key={area}
                    type='button'
                    onClick={() => toggleHomeVisitArea(area)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      homeVisitAreas.includes(area)
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
              {homeVisitAreas.length > 0 && (
                <p className='mt-2 text-xs font-medium text-emerald-800'>
                  {homeVisitAreas.length} area{homeVisitAreas.length === 1 ? '' : 's'} selected
                </p>
              )}
            </div>

            <div>
              <p className='text-sm font-semibold text-gray-700 mb-2'>Repeat schedule</p>
              <div className='flex flex-wrap gap-2 mb-3'>
                <button type='button' onClick={() => setPreset([0, 1, 2, 3, 4, 5, 6], 'homeVisitSchedule', defaultHomeVisitSchedule)} className='rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'>7 days</button>
                <button type='button' onClick={() => setPreset([1, 2, 3, 4, 5], 'homeVisitSchedule', defaultHomeVisitSchedule)} className='rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'>Weekdays</button>
                <button type='button' onClick={() => setPreset([0, 2, 4], 'homeVisitSchedule', defaultHomeVisitSchedule)} className='rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'>Sun Tue Thu</button>
                <button type='button' onClick={() => updateSchedule({ workingDays: [] }, 'homeVisitSchedule', defaultHomeVisitSchedule)} className='rounded-lg border bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50'>Disable</button>
              </div>
              <div className='flex flex-wrap gap-2'>
                {dayOptions.map((day) => (
                  <button
                    type='button'
                    key={day.value}
                    onClick={() => toggleWorkingDay(homeVisitSchedule, day.value, 'homeVisitSchedule', defaultHomeVisitSchedule)}
                    className={`min-w-14 rounded-lg border px-3 py-2 text-sm font-semibold ${homeVisitSchedule.workingDays.includes(day.value) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-emerald-200'}`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
              <label className='text-sm font-semibold text-gray-700'>
                Start time
                <input type='time' value={homeVisitSchedule.startTime} onChange={(e) => updateSchedule({ startTime: e.target.value }, 'homeVisitSchedule', defaultHomeVisitSchedule)} className='mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500' />
              </label>
              <label className='text-sm font-semibold text-gray-700'>
                End time
                <input type='time' value={homeVisitSchedule.endTime} onChange={(e) => updateSchedule({ endTime: e.target.value }, 'homeVisitSchedule', defaultHomeVisitSchedule)} className='mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500' />
              </label>
              <label className='text-sm font-semibold text-gray-700'>
                Visit slot duration
                <select value={homeVisitSchedule.slotDuration} onChange={(e) => updateSchedule({ slotDuration: Number(e.target.value) }, 'homeVisitSchedule', defaultHomeVisitSchedule)} className='mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500'>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                  <option value={120}>120 minutes</option>
                </select>
              </label>
            </div>

            <div>
              <div className='flex items-center justify-between gap-3 mb-2'>
                <p className='text-sm font-semibold text-gray-700'>Home visit breaks</p>
                <button type='button' onClick={() => addBreak(homeVisitSchedule, 'homeVisitSchedule', defaultHomeVisitSchedule)} className='inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-gray-50'>
                  <Plus className='w-4 h-4' />
                  Break
                </button>
              </div>
              <div className='space-y-2'>
                {homeVisitSchedule.breaks.length === 0 && <p className='text-sm text-gray-500'>No home visit breaks added.</p>}
                {homeVisitSchedule.breaks.map((item, index) => (
                  <div key={index} className='grid grid-cols-[1fr_1fr_auto] gap-2 items-center'>
                    <input type='time' value={item.startTime} onChange={(e) => updateBreak(homeVisitSchedule, index, 'startTime', e.target.value, 'homeVisitSchedule', defaultHomeVisitSchedule)} className='border rounded-lg px-3 py-2' />
                    <input type='time' value={item.endTime} onChange={(e) => updateBreak(homeVisitSchedule, index, 'endTime', e.target.value, 'homeVisitSchedule', defaultHomeVisitSchedule)} className='border rounded-lg px-3 py-2' />
                    <button type='button' onClick={() => removeBreak(homeVisitSchedule, index, 'homeVisitSchedule', defaultHomeVisitSchedule)} className='rounded-lg border bg-white p-2 text-red-600'>
                      <X className='w-4 h-4' />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className='text-sm font-semibold text-gray-700 mb-2'>Home visit unavailable dates</p>
              <input type='date' min={todayKey} max={nextYearKey} onChange={(e) => { addBlockedDate(homeVisitSchedule, e.target.value, 'homeVisitSchedule', defaultHomeVisitSchedule); e.target.value = '' }} className='border rounded-lg px-3 py-2 mb-3' />
              <div className='flex flex-wrap gap-2'>
                {homeVisitSchedule.blockedDates.length === 0 && <p className='text-sm text-gray-500'>No home visit unavailable dates added.</p>}
                {homeVisitSchedule.blockedDates.map((date) => (
                  <span key={date} className='inline-flex items-center gap-2 rounded-full bg-white text-gray-700 px-3 py-1 text-sm'>
                    {date}
                    <button type='button' onClick={() => removeBlockedDate(homeVisitSchedule, date, 'homeVisitSchedule', defaultHomeVisitSchedule)} className='text-red-600'>
                      <X className='w-3 h-3' />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button type='button' onClick={saveSchedule} disabled={saving} className='inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white disabled:bg-gray-400'>
            <Save className='w-4 h-4' />
            {saving ? 'Saving...' : 'Save availability'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DoctorAvailability
