import React, { useState } from 'react'
import { useContext } from 'react'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import { useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { RatingBadge, RatingsList, StarRow } from '../../components/DoctorRating'
import { Building2, KeyRound, Mail, MapPin, Pencil, Phone, Plus, ShieldCheck, Sparkles, UserCircle } from 'lucide-react'
import MfaSetupBox from '../../components/MfaSetupBox'
import { formatExperienceEn, parseExperienceYears } from '../../utils/doctorExperience'

const DoctorProfile = () => {

  const { dToken, profileData, setProfileData, getProfileData, getDoctorRatings, backendUrl } = useContext(DoctorContext)
  const { currency } = useContext(AppContext)

  const [isEdit, setIsEdit] = useState(false)
  const [ratingsData, setRatingsData] = useState({ summary: { averageRating: 0, ratingCount: 0 }, ratings: [] })
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const [mfaStatus, setMfaStatus] = useState(null)
  const [mfaSetup, setMfaSetup] = useState(null)
  const [mfaCode, setMfaCode] = useState('')

  const updateProfile = async () => {
    try {
    if (parseExperienceYears(profileData.experience) === null) {
      toast.error('Enter a valid number of years of experience (0–100)')
      return
    }
    if (!(profileData.about || '').trim()) {
      toast.error('Please add a short professional biography in About')
      return
    }
    const updateData = {
      address: {
        line1: profileData.address?.line1 || '',
        line2: profileData.address?.line2 || ''
      },
      locations: (profileData.locations || []).map((location) => location.trim()).filter(Boolean),
      available: profileData.available,
      gender: profileData.gender || '',
      title: profileData.title || '',
      acceptsVoiceCall: profileData.acceptsVoiceCall !== false,
      acceptsVideoCall: profileData.acceptsVideoCall !== false,
      experience: profileData.experience,
      about: (profileData.about || '').trim(),
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

  const loadMfaStatus = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/doctor/mfa/status', { headers: { dToken } })
      if (data.success) setMfaStatus(data.mfa)
    } catch (error) {
      toast.error(error.message)
    }
  }

  const startMfaSetup = async () => {
    try {
      const { data } = await axios.post(backendUrl + '/api/doctor/mfa/setup', {}, { headers: { dToken } })
      if (data.success) {
        setMfaSetup(data.setup)
        setMfaCode('')
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const enableMfa = async () => {
    try {
      const { data } = await axios.post(backendUrl + '/api/doctor/mfa/enable', { code: mfaCode }, { headers: { dToken } })
      if (data.success) {
        toast.success(data.message)
        setMfaSetup(null)
        setMfaCode('')
        loadMfaStatus()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const disableMfa = async () => {
    try {
      const { data } = await axios.post(backendUrl + '/api/doctor/mfa/disable', { code: mfaCode }, { headers: { dToken } })
      if (data.success) {
        toast.success(data.message)
        setMfaCode('')
        loadMfaStatus()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  useEffect(() => {
    if (!dToken) return
    const mfaTimer = setTimeout(() => loadMfaStatus(), 0)
    const loadRatings = async () => {
      setRatingsLoading(true)
      const data = await getDoctorRatings()
      setRatingsData(data)
      setRatingsLoading(false)
    }
    loadRatings()
    return () => clearTimeout(mfaTimer)
  }, [dToken])

  const locations = profileData.locations?.length ? profileData.locations : ['']
  const updateLocation = (index, value) => {
    setProfileData(prev => ({
      ...prev,
      locations: (prev.locations?.length ? prev.locations : ['']).map((location, itemIndex) => itemIndex === index ? value : location)
    }))
  }
  const addLocation = () => setProfileData(prev => ({ ...prev, locations: [...(prev.locations || []), ''] }))
  const removeLocation = (index) => setProfileData(prev => ({ ...prev, locations: (prev.locations || []).filter((_, itemIndex) => itemIndex !== index) }))


  if (!dToken) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-slate-500">
        Sign in to view your profile.
      </div>
    )
  }

  if (!profileData) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="animate-pulse space-y-6 rounded-2xl border border-slate-200 bg-white p-8">
          <div className="mx-auto h-40 w-40 rounded-2xl bg-slate-200" />
          <div className="mx-auto h-8 w-48 rounded bg-slate-200" />
          <div className="h-24 rounded-xl bg-slate-100" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full w-full bg-gradient-to-b from-slate-50 via-white to-slate-50/80 pb-12">
      <div className="relative border-b border-slate-200/80 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 pb-20 pt-8 sm:px-8 sm:pb-24 sm:pt-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent" />
        <div className="relative mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-200 ring-1 ring-white/20">
              <Sparkles className="h-3.5 w-3.5" />
              Your public profile
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Profile</h1>
            <p className="mt-1 max-w-xl text-sm text-indigo-200/90">
              How patients see you in the directory. Keep your bio professional, fee current, and locations accurate.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {isEdit ? (
              <button
                type="button"
                onClick={updateProfile}
                className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400"
              >
                Save changes
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEdit(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
              >
                <Pencil className="h-4 w-4" />
                Edit profile
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-16 max-w-5xl px-4 sm:-mt-20 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex shrink-0 justify-center lg:justify-start">
            <div className="relative w-full max-w-[280px] overflow-hidden rounded-2xl border-4 border-white bg-white shadow-xl shadow-slate-900/15 ring-1 ring-slate-200/80">
              <img className="aspect-square w-full object-cover" src={profileData.image} alt="" />
              <RatingBadge summary={profileData.ratingSummary || ratingsData.summary} className="absolute left-3 top-3" />
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{profileData.name}</h2>
                  <p className="mt-1 text-base font-medium text-slate-600">
                    {profileData.degree} · {profileData.speciality}
                  </p>
                  <div className="mt-3">
                    {isEdit ? (
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Years of experience
                        <input
                          className="mt-2 w-full max-w-[8rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold normal-case text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                          type="number"
                          min={0}
                          max={100}
                          value={parseExperienceYears(profileData.experience) ?? ''}
                          onChange={(e) => setProfileData((prev) => ({ ...prev, experience: e.target.value }))}
                        />
                        <span className="mt-1 block text-xs font-medium normal-case text-slate-500">years of experience</span>
                      </label>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-800 ring-1 ring-indigo-100">
                        {formatExperienceEn(profileData.experience) || 'Years of experience not set'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-6">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                  <UserCircle className="h-4 w-4 text-slate-400" />
                  About
                </h3>
                {isEdit ? (
                  <textarea
                    className="mt-1 w-full min-h-[120px] resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 sm:text-base"
                    value={profileData.about || ''}
                    onChange={(e) => setProfileData((prev) => ({ ...prev, about: e.target.value }))}
                    placeholder="Describe your expertise, approach, and what patients can expect."
                    maxLength={2000}
                  />
                ) : (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 sm:text-base">
                    {(profileData.about || '').trim() || 'Add a short professional biography so patients know your focus and approach.'}
                  </p>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-4 border-t border-slate-100 pt-6 text-sm">
                {profileData.email && (
                  <a href={`mailto:${profileData.email}`} className="inline-flex items-center gap-2 font-medium text-indigo-600 hover:text-indigo-800">
                    <Mail className="h-4 w-4 shrink-0" />
                    {profileData.email}
                  </a>
                )}
                {profileData.phone && (
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                    {profileData.phone}
                  </span>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
                <span className="text-sm font-semibold text-slate-700">Consultation fee</span>
                <span className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-900 shadow-inner">
                  <span className="flex items-center border-r border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600">{currency}</span>
                  <span className="px-3 py-2 text-sm font-bold tabular-nums">{Number(profileData.fees || 0).toLocaleString()}</span>
                </span>
                <span className="text-xs text-slate-500">Set by clinic admin</span>
              </div>

              <div className="mt-6 grid gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Gender
                  {isEdit ? (
                    <select
                      value={profileData.gender || ''}
                      onChange={(e) => setProfileData((prev) => ({ ...prev, gender: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Choose</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  ) : (
                    <span className="mt-2 block text-slate-600">{profileData.gender || 'Not set'}</span>
                  )}
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Academic title
                  {isEdit ? (
                    <select
                      value={profileData.title || ''}
                      onChange={(e) => setProfileData((prev) => ({ ...prev, title: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Choose</option>
                      <option value="Professor">Professor</option>
                      <option value="Lecturer">Lecturer</option>
                      <option value="Consultant">Consultant</option>
                      <option value="Specialist">Specialist</option>
                    </select>
                  ) : (
                    <span className="mt-2 block text-slate-600">{profileData.title || 'Not set'}</span>
                  )}
                </label>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
                <input
                  id="doctor-available-checkbox"
                  disabled={!isEdit}
                  onChange={() => isEdit && setProfileData((prev) => ({ ...prev, available: !prev.available }))}
                  checked={profileData.available}
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                />
                <label htmlFor="doctor-available-checkbox" className={`text-sm font-medium ${isEdit ? 'cursor-pointer text-slate-800' : 'text-slate-500'}`}>
                  Accepting new appointments
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/90 to-white p-6 shadow-sm">
              <p className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Building2 className="h-5 w-5 text-blue-600" />
                Clinic locations
              </p>
              <p className="mt-1 text-sm text-slate-600">Branches where you see patients. Set per-location hours under Availability.</p>
          {isEdit ? (
            <div className='mt-4 space-y-3'>
              {locations.map((location, index) => (
                <div key={index} className='flex items-center gap-2 bg-white rounded-lg border border-blue-200 p-3'>
                  <input 
                    className='flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none' 
                    type='text' 
                    value={location} 
                    onChange={(e) => updateLocation(index, e.target.value)} 
                    placeholder='e.g., Mohandseen Clinic, Downtown Branch'
                  />
                  {locations.length > 1 && (
                    <button 
                      type='button' 
                      onClick={() => removeLocation(index)} 
                      className='rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50'
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button 
                type='button' 
                onClick={addLocation} 
                className='inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50'
              >
                <Plus className='h-4 w-4' />
                Add location
              </button>
              <p className="mt-3 text-xs font-medium text-blue-800/90">
                After saving locations, open <strong>Availability</strong> to configure hours for each site.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {profileData.locations?.length ? (
                profileData.locations.map((location, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-900 ring-1 ring-blue-200/80 shadow-sm"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                    {location}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-600">No clinic locations added yet.</p>
              )}
            </div>
          )}
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6 shadow-sm">
              <p className="text-base font-bold text-slate-900">Payments & offers</p>
              <p className="mt-1 text-xs text-slate-500">Cash, online payment, and patient offers are managed by clinic admin.</p>
              <div className="mt-3 space-y-2 rounded-lg border border-emerald-100 bg-white/80 p-3 text-sm text-slate-700">
                <p><span className="font-semibold">Cash:</span> {profileData.acceptsCash !== false ? 'Accepted' : 'Not accepted'}</p>
                <p><span className="font-semibold">Online payment:</span> {profileData.acceptsOnlinePayment !== false ? 'Accepted' : 'Not accepted'}</p>
                <p>
                  <span className="font-semibold">Patient offer:</span>{' '}
                  {profileData.promoCode?.active
                    ? `${profileData.promoCode.code} — ${profileData.promoCode.discountValue}${profileData.promoCode.discountType === 'percentage' ? '%' : ` ${currency}`} off`
                    : 'None active'}
                </p>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-800">Consultation modes you can edit</p>
              <div className='mt-2 grid gap-3 sm:grid-cols-2'>
                <label className='flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-gray-700'>
                  <input disabled={!isEdit} type='checkbox' checked={profileData.acceptsVoiceCall !== false} onChange={(e) => setProfileData(prev => ({ ...prev, acceptsVoiceCall: e.target.checked }))} className='accent-primary' />
                  Accept voice calls
                </label>
                <label className='flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-gray-700'>
                  <input disabled={!isEdit} type='checkbox' checked={profileData.acceptsVideoCall !== false} onChange={(e) => setProfileData(prev => ({ ...prev, acceptsVideoCall: e.target.checked }))} className='accent-primary' />
                  Accept video calls
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-6 shadow-sm">
              <p className="text-base font-bold text-slate-900">Patient ratings</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <StarRow value={ratingsData.summary?.averageRating || profileData.ratingSummary?.averageRating} />
                {ratingsData.summary?.ratingCount || profileData.ratingSummary?.ratingCount
                  ? `${Number(ratingsData.summary?.averageRating || profileData.ratingSummary?.averageRating || 0).toFixed(1)} from ${ratingsData.summary?.ratingCount || profileData.ratingSummary?.ratingCount} ratings`
                  : 'No ratings yet'}
              </div>
              <div className="mt-4">
                {ratingsLoading ? <p className="text-sm text-slate-500">Loading ratings…</p> : <RatingsList ratings={ratingsData.ratings} />}
              </div>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/80 p-6 shadow-sm">
              <p className="flex items-center gap-2 text-base font-bold text-slate-900">
                <ShieldCheck className="h-5 w-5 text-blue-700" />
                Multi-factor authentication
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Status: <span className="font-semibold">{mfaStatus?.enabled ? 'Enabled' : 'Not configured'}</span>
                {mfaStatus?.required && (
                  <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Required</span>
                )}
              </p>

              {mfaSetup ? (
                <div className="mt-3 space-y-3 rounded-xl bg-white p-4 text-sm shadow-inner">
                  <MfaSetupBox mode="setup" setup={mfaSetup} />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={mfaCode}
                      onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit code"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-center font-semibold tracking-[0.35em]"
                      inputMode="numeric"
                    />
                    <button type="button" onClick={enableMfa} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                      Verify and enable
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {!mfaStatus?.enabled && (
                    <button type="button" onClick={startMfaSetup} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                      <KeyRound className="h-4 w-4" />
                      Set up MFA
                    </button>
                  )}
                  {mfaStatus?.enabled && !mfaStatus?.required && (
                    <>
                      <input
                        value={mfaCode}
                        onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit code"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-center font-semibold tracking-[0.35em]"
                        inputMode="numeric"
                      />
                      <button type="button" onClick={disableMfa} className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">
                        Disable MFA
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DoctorProfile
