import React, { useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { CalendarClock, Plus, Save, X } from 'lucide-react'
import { toast } from 'react-toastify'
import { DoctorContext } from '../../context/DoctorContext'

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

const toDateInputValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const todayKey = toDateInputValue(new Date())

const DoctorAvailability = () => {
  const { dToken, profileData, setProfileData, getProfileData, backendUrl } = useContext(DoctorContext)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (dToken) getProfileData()
  }, [dToken])

  const schedule = useMemo(() => ({ ...defaultSchedule, ...(profileData?.schedule || {}) }), [profileData])
  const nextYearKey = useMemo(() => {
    const date = new Date()
    date.setFullYear(date.getFullYear() + 1)
    return toDateInputValue(date)
  }, [])

  const updateSchedule = (changes) => {
    setProfileData((prev) => ({
      ...prev,
      schedule: { ...defaultSchedule, ...(prev.schedule || {}), ...changes }
    }))
  }

  const setPreset = (workingDays) => updateSchedule({ workingDays })

  const toggleWorkingDay = (day) => {
    const workingDays = schedule.workingDays.includes(day)
      ? schedule.workingDays.filter((item) => item !== day)
      : [...schedule.workingDays, day].sort((a, b) => a - b)
    updateSchedule({ workingDays })
  }

  const updateBreak = (index, field, value) => {
    const breaks = [...schedule.breaks]
    breaks[index] = { ...breaks[index], [field]: value }
    updateSchedule({ breaks })
  }

  const addBreak = () => updateSchedule({ breaks: [...schedule.breaks, { startTime: '13:00', endTime: '14:00' }] })
  const removeBreak = (index) => updateSchedule({ breaks: schedule.breaks.filter((_, itemIndex) => itemIndex !== index) })

  const addBlockedDate = (value) => {
    if (!value) return
    if (value < todayKey) return toast.warn('Past dates cannot be added')
    if (schedule.blockedDates.includes(value)) return
    updateSchedule({ blockedDates: [...schedule.blockedDates, value].sort() })
  }

  const removeBlockedDate = (value) => updateSchedule({ blockedDates: schedule.blockedDates.filter((item) => item !== value) })

  const saveSchedule = async () => {
    if (!profileData) return
    if (schedule.workingDays.length === 0) return toast.warn('Choose at least one working day')
    if (schedule.startTime >= schedule.endTime) return toast.warn('Start time must be before end time')

    setSaving(true)
    try {
      const { data } = await axios.post(
        backendUrl + '/api/doctor/update-profile',
        {
          fees: profileData.fees,
          address: profileData.address,
          available: profileData.available,
          schedule
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
                  onClick={() => toggleWorkingDay(day.value)}
                  className={`min-w-14 rounded-lg border px-3 py-2 text-sm font-semibold ${schedule.workingDays.includes(day.value) ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

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
              <button type='button' onClick={addBreak} className='inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-primary hover:bg-gray-50'>
                <Plus className='w-4 h-4' />
                Break
              </button>
            </div>
            <div className='space-y-2'>
              {schedule.breaks.length === 0 && <p className='text-sm text-gray-500'>No breaks added.</p>}
              {schedule.breaks.map((item, index) => (
                <div key={index} className='grid grid-cols-[1fr_1fr_auto] gap-2 items-center'>
                  <input type='time' value={item.startTime} onChange={(e) => updateBreak(index, 'startTime', e.target.value)} className='border rounded-lg px-3 py-2' />
                  <input type='time' value={item.endTime} onChange={(e) => updateBreak(index, 'endTime', e.target.value)} className='border rounded-lg px-3 py-2' />
                  <button type='button' onClick={() => removeBreak(index)} className='rounded-lg border p-2 text-red-600'>
                    <X className='w-4 h-4' />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className='text-sm font-semibold text-gray-700 mb-2'>Unavailable dates</p>
            <input type='date' min={todayKey} max={nextYearKey} onChange={(e) => { addBlockedDate(e.target.value); e.target.value = '' }} className='border rounded-lg px-3 py-2 mb-3' />
            <div className='flex flex-wrap gap-2'>
              {schedule.blockedDates.length === 0 && <p className='text-sm text-gray-500'>No unavailable dates added.</p>}
              {schedule.blockedDates.map((date) => (
                <span key={date} className='inline-flex items-center gap-2 rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-sm'>
                  {date}
                  <button type='button' onClick={() => removeBlockedDate(date)} className='text-red-600'>
                    <X className='w-3 h-3' />
                  </button>
                </span>
              ))}
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
