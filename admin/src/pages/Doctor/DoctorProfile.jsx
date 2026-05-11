import React, { useState } from 'react'
import { useContext } from 'react'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import { useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { RatingBadge, RatingsList, StarRow } from '../../components/DoctorRating'
import { MapPin, Plus } from 'lucide-react'

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

const todayKey = new Date().toISOString().slice(0, 10)

const DoctorProfile = () => {

  const { dToken, profileData, setProfileData, getProfileData, getDoctorRatings, backendUrl } = useContext(DoctorContext)
  const { currency } = useContext(AppContext)

  const [isEdit, setIsEdit] = useState(false)
  const [ratingsData, setRatingsData] = useState({ summary: { averageRating: 0, ratingCount: 0 }, ratings: [] })
  const [ratingsLoading, setRatingsLoading] = useState(false)

  const updateProfile = async () => {
    try {
    const updateData = {
      address: profileData.address,
      locations: (profileData.locations || []).map((location) => location.trim()).filter(Boolean),
      fees: profileData.fees,
      available: profileData.available,
      schedule: { ...defaultSchedule, ...(profileData.schedule || {}) },
    }   
    const { data } = await axios.post(backendUrl + '/api/doctor/update-profile', updateData, {headers: {dToken}})
    if(data.success){
     toast.success(data.message)
     setIsEdit(false)
     getProfileData()
    } else {
      toast.error(data.message)
    }
    } catch (error) {
      toast.error(error.message)
    }

  }

  useEffect(()=>{
    if(dToken){
      getProfileData()
      const loadRatings = async () => {
        setRatingsLoading(true)
        const data = await getDoctorRatings()
        setRatingsData(data)
        setRatingsLoading(false)
      }
      loadRatings()
    }
  },[dToken])

  const schedule = { ...defaultSchedule, ...(profileData?.schedule || {}) }

  const updateSchedule = (changes) => {
    setProfileData(prev => ({
      ...prev,
      schedule: { ...defaultSchedule, ...(prev.schedule || {}), ...changes }
    }))
  }

  const toggleWorkingDay = (day) => {
    const workingDays = schedule.workingDays.includes(day)
      ? schedule.workingDays.filter(item => item !== day)
      : [...schedule.workingDays, day].sort((a, b) => a - b)
    updateSchedule({ workingDays })
  }

  const updateBreak = (index, field, value) => {
    const breaks = [...(schedule.breaks || [])]
    breaks[index] = { ...breaks[index], [field]: value }
    updateSchedule({ breaks })
  }

  const addBreak = () => updateSchedule({ breaks: [...(schedule.breaks || []), { startTime: '13:00', endTime: '14:00' }] })
  const removeBreak = (index) => updateSchedule({ breaks: schedule.breaks.filter((_, itemIndex) => itemIndex !== index) })
  const addBlockedDate = (value) => {
    if (!value || schedule.blockedDates.includes(value)) return
    if (value < todayKey) return toast.warn('Past dates cannot be added')
    updateSchedule({ blockedDates: [...schedule.blockedDates, value].sort() })
  }
  const removeBlockedDate = (value) => updateSchedule({ blockedDates: schedule.blockedDates.filter(item => item !== value) })

  const locations = profileData.locations?.length ? profileData.locations : ['']
  const updateLocation = (index, value) => {
    setProfileData(prev => ({
      ...prev,
      locations: (prev.locations?.length ? prev.locations : ['']).map((location, itemIndex) => itemIndex === index ? value : location)
    }))
  }
  const addLocation = () => setProfileData(prev => ({ ...prev, locations: [...(prev.locations || []), ''] }))
  const removeLocation = (index) => setProfileData(prev => ({ ...prev, locations: (prev.locations || []).filter((_, itemIndex) => itemIndex !== index) }))


  return profileData && (
    <div>
      
     <div className='flex flex-col gap-4 m-5'>
      <div>
        <div className='relative w-full sm:max-w-64'>
          <img className='bg-primary/80 w-full rounded-lg' src={profileData.image} alt="" />
          <RatingBadge summary={profileData.ratingSummary || ratingsData.summary} className='absolute left-3 top-3' />
        </div>
      </div>

      <div className='flex-1 border border-stone-100 rounded-lg p-8 py-7 bg-white'>
        {/* Doc Info: name, degree, experience */}

        <p className='flex items-center gap-2 text-3xl font-medium text-gray-700'>{profileData.name}</p>
        <div className='flex items-center gap-2 mt-1 text-gray-600'>
          <p>{profileData.degree} - {profileData.speciality}</p>
          <button className='py-0.5 px-2 border text-xs rounded-full'>{profileData.experience}</button>
        </div>

        {/* Doc About */}
        <div>
          <p className='flex items-center gap-1 text-sm font-medium text-neutral-800 mt-3' >About:</p>
          <p className='text-sm text-gray-600 max-w-[700px] mt-1'>
            {profileData.about}
          </p>
        </div>

        <p className='text-gray-600 font-medium mt-4'>Appointment fee: <span className='text-gray-800' >{currency} {isEdit ? <input type="number" onChange={(e) => setProfileData(prev => ({...prev, fees: e.target.value}))} value={profileData.fees} />  : profileData.fees}</span></p>

        <div className='flex gap-2 py-2'>
          <p>Address: </p>
          <p className='text-sm'>
             {isEdit ? <input type="text" onChange={(e) => setProfileData(prev => ({...prev,address:{...prev.address,line1:e.target.value} }))} value={profileData.address.line1} />  :   profileData.address.line1}
            <br />
             {isEdit ? <input type="text" onChange={(e) => setProfileData(prev => ({...prev,address:{...prev.address,line2:e.target.value} }))} value={profileData.address.line2} />  :  profileData.address.line2}
          </p>
        </div>

        <div className='mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4'>
          <p className='flex items-center gap-2 text-sm font-semibold text-gray-800'>
            <MapPin className='h-4 w-4 text-blue-600' />
            Clinic locations
          </p>
          {isEdit ? (
            <div className='mt-3 space-y-2'>
              {locations.map((location, index) => (
                <div key={index} className='flex items-center gap-2'>
                  <input className='w-full rounded-lg border px-3 py-2 text-sm' type='text' value={location} onChange={(e) => updateLocation(index, e.target.value)} placeholder='e.g., Mohandseen' />
                  {locations.length > 1 && <button type='button' onClick={() => removeLocation(index)} className='rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600'>Remove</button>}
                </div>
              ))}
              <button type='button' onClick={addLocation} className='inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700'>
                <Plus className='h-4 w-4' />
                Add location
              </button>
            </div>
          ) : (
            <p className='mt-2 text-sm text-gray-700'>{profileData.locations?.length ? profileData.locations.join(', ') : 'No extra locations added'}</p>
          )}
        </div>

        <div className='flex gap-1 pt-2'>
          <input onChange={() => isEdit && setProfileData(prev => ({...prev, available: !prev.available}))} checked={profileData.available} type="checkbox" name='' id='' />
          <label htmlFor="">Accepting appointments</label>
        </div>

        <div className='mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4'>
          <p className='text-lg font-semibold text-gray-800'>Patient Ratings</p>
          <div className='mt-2 flex items-center gap-2 text-sm text-gray-700'>
            <StarRow value={ratingsData.summary?.averageRating || profileData.ratingSummary?.averageRating} />
            {ratingsData.summary?.ratingCount || profileData.ratingSummary?.ratingCount
              ? `${Number(ratingsData.summary?.averageRating || profileData.ratingSummary?.averageRating || 0).toFixed(1)} from ${ratingsData.summary?.ratingCount || profileData.ratingSummary?.ratingCount} ratings`
              : 'No ratings yet'}
          </div>
          <div className='mt-4'>
            {ratingsLoading ? <p className='text-sm text-gray-500'>Loading ratings...</p> : <RatingsList ratings={ratingsData.ratings} />}
          </div>
        </div>

        <div className='mt-6 border-t border-gray-100 pt-5'>
          <div className='flex flex-col gap-1 mb-4'>
            <p className='text-lg font-semibold text-gray-800'>Schedule</p>
            <p className='text-sm text-gray-500'>Manage working days, appointment times, breaks, slot length, and blocked dates.</p>
          </div>

          <div className='grid gap-5'>
            <div>
              <p className='text-sm font-medium text-gray-700 mb-2'>Working days</p>
              <div className='flex flex-wrap gap-2'>
                {dayOptions.map(day => (
                  <button
                    type='button'
                    key={day.value}
                    disabled={!isEdit}
                    onClick={() => toggleWorkingDay(day.value)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium disabled:cursor-default ${schedule.workingDays.includes(day.value) ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'}`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
              <label className='text-sm font-medium text-gray-700'>
                Start time
                <input disabled={!isEdit} type='time' value={schedule.startTime} onChange={(e) => updateSchedule({ startTime: e.target.value })} className='mt-1 w-full border rounded-lg px-3 py-2 disabled:bg-gray-50' />
              </label>
              <label className='text-sm font-medium text-gray-700'>
                End time
                <input disabled={!isEdit} type='time' value={schedule.endTime} onChange={(e) => updateSchedule({ endTime: e.target.value })} className='mt-1 w-full border rounded-lg px-3 py-2 disabled:bg-gray-50' />
              </label>
              <label className='text-sm font-medium text-gray-700'>
                Slot duration
                <select disabled={!isEdit} value={schedule.slotDuration} onChange={(e) => updateSchedule({ slotDuration: Number(e.target.value) })} className='mt-1 w-full border rounded-lg px-3 py-2 disabled:bg-gray-50'>
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
                <p className='text-sm font-medium text-gray-700'>Break times</p>
                {isEdit && <button type='button' onClick={addBreak} className='text-sm text-primary font-medium'>Add break</button>}
              </div>
              <div className='space-y-2'>
                {schedule.breaks.length === 0 && <p className='text-sm text-gray-500'>No breaks configured.</p>}
                {schedule.breaks.map((item, index) => (
                  <div key={index} className='grid grid-cols-[1fr_1fr_auto] gap-2 items-center'>
                    <input disabled={!isEdit} type='time' value={item.startTime} onChange={(e) => updateBreak(index, 'startTime', e.target.value)} className='border rounded-lg px-3 py-2 disabled:bg-gray-50' />
                    <input disabled={!isEdit} type='time' value={item.endTime} onChange={(e) => updateBreak(index, 'endTime', e.target.value)} className='border rounded-lg px-3 py-2 disabled:bg-gray-50' />
                    {isEdit && <button type='button' onClick={() => removeBreak(index)} className='px-3 py-2 rounded-lg border text-red-600'>Remove</button>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className='text-sm font-medium text-gray-700 mb-2'>Blocked dates</p>
              {isEdit && <input type='date' min={todayKey} onChange={(e) => { addBlockedDate(e.target.value); e.target.value = '' }} className='border rounded-lg px-3 py-2 mb-3' />}
              <div className='flex flex-wrap gap-2'>
                {schedule.blockedDates.length === 0 && <p className='text-sm text-gray-500'>No blocked dates.</p>}
                {schedule.blockedDates.map(date => (
                  <span key={date} className='inline-flex items-center gap-2 rounded-full bg-red-50 text-red-700 px-3 py-1 text-sm'>
                    {date}
                    {isEdit && <button type='button' onClick={() => removeBlockedDate(date)} className='font-bold'>x</button>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {
          isEdit
          ? <button onClick={updateProfile} className='px-4 py-1 border border-green-500 text-sm rounded-full mt-5 hover:bg-green-500 hover:text-white transition-all '>Save</button>
          : <button onClick={() => setIsEdit(true)} className='px-4 py-1 border border-primary text-sm rounded-full mt-5 hover:bg-primary hover:text-white transition-all '>Edit</button>  
        }


      </div>
     
     </div>

    </div>
  )
}

export default DoctorProfile
