import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  BadgeCheck,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'
import MfaSetupBox from '../components/MfaSetupBox'

const today = new Date().toISOString().split('T')[0]

const getCompletionItems = (userData) => [
  { labelKey: 'Photo', complete: Boolean(userData?.image) },
  { labelKey: 'Phone', complete: Boolean(userData?.phone) && userData.phone !== '000000000' },
  { labelKey: 'Address', complete: Boolean(userData?.address?.line1 || userData?.address?.line2) },
  { labelKey: 'Gender', complete: Boolean(userData?.gender) && userData.gender !== 'Not Selected' },
  { labelKey: 'Birth date', complete: Boolean(userData?.dob) && userData.dob !== 'Not Selected' },
  { labelKey: 'Insurance', complete: Boolean(userData?.insurance?.enabled) },
]

const Field = ({ label, children }) => (
  <div>
    <p className='mb-1 text-xs font-bold uppercase tracking-wide text-gray-400'>{label}</p>
    {children}
  </div>
)

const ReadValue = ({ children, muted = false }) => (
  <p className={`min-h-10 rounded-xl border border-gray-100 px-3 py-2.5 text-sm font-medium ${muted ? 'bg-gray-50 text-gray-500' : 'bg-white text-gray-900'}`}>
    {children}
  </p>
)

const MyProfile = () => {
  const { userData, setUserData, token, backendUrl, loadUserProfileData, appointments = [], calculateAge, displayPersonName, language } = useContext(AppContext)
  const { t, localizeDigits, formatPercent } = useLanguage()
  const navigate = useNavigate()

  const fillT = (key, vars = {}) => {
    let s = String(t(key))
    Object.entries(vars || {}).forEach(([k, v]) => {
      s = s.split(`{{${k}}}`).join(String(v))
    })
    return localizeDigits(s)
  }

  const cleanValue = (value) => {
    if (!value || value === 'Not Selected') return t('Not provided')
    return value
  }

  const formatDate = (value) => {
    if (!value || value === 'Not Selected') return t('Not provided')
    const date = new Date(value)
    return Number.isNaN(date.getTime())
      ? value
      : localizeDigits(
          date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        )
  }

  const genderLabel = (g) => {
    if (!g || g === 'Not Selected') return t('Prefer not to say')
    if (g === 'Male') return t('Male')
    if (g === 'Female') return t('Female')
    return cleanValue(g)
  }

  const [isEdit, setIsEdit] = useState(false)
  const [image, setImage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [mfaStatus, setMfaStatus] = useState(null)
  const [mfaSetup, setMfaSetup] = useState(null)
  const [mfaCode, setMfaCode] = useState('')

  const address = userData?.address || { line1: '', line2: '' }
  const imagePreview = imagePreviewUrl || userData?.image
  const completionItems = useMemo(() => getCompletionItems(userData), [userData])
  const completedCount = completionItems.filter((item) => item.complete).length
  const completionPercent = Math.round((completedCount / completionItems.length) * 100)
  const upcomingCount = appointments.filter((item) => !item.cancelled && item.appointmentStatus !== 'Completed').length
  const completedAppointments = appointments.filter((item) => item.appointmentStatus === 'Completed').length

  const setField = (field, value) => setUserData((prev) => ({ ...prev, [field]: value }))
  const setAddressField = (field, value) => setUserData((prev) => ({ ...prev, address: { ...(prev.address || {}), [field]: value } }))

  useEffect(() => {
    if (!image) {
      setImagePreviewUrl('')
      return undefined
    }

    const previewUrl = URL.createObjectURL(image)
    setImagePreviewUrl(previewUrl)

    return () => URL.revokeObjectURL(previewUrl)
  }, [image])

  const loadMfaStatus = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/user/mfa/status`, { headers: { token } })
      if (data.success) setMfaStatus(data.mfa)
    } catch (error) {
      console.log(error)
    }
  }

  useEffect(() => {
    if (!token) return
    loadUserProfileData()
    loadMfaStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh profile when opening page (e.g. after staff updated insurance)
  }, [token])

  const startMfaSetup = async () => {
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/mfa/setup`, {}, { headers: { token } })
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
      const { data } = await axios.post(`${backendUrl}/api/user/mfa/enable`, { code: mfaCode }, { headers: { token } })
      if (data.success) {
        toast.success(data.message)
        setMfaSetup(null)
        setMfaCode('')
        loadMfaStatus()
        loadUserProfileData()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const disableMfa = async () => {
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/mfa/disable`, { code: mfaCode }, { headers: { token } })
      if (data.success) {
        toast.success(data.message)
        setMfaCode('')
        loadMfaStatus()
        loadUserProfileData()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const cancelEdit = () => {
    setImage(null)
    setIsEdit(false)
    loadUserProfileData()
  }

  const updateUserProfileData = async () => {
    try {
      setSaving(true)

      const formData = new FormData()
      formData.append('name', userData.name || '')
      formData.append('phone', userData.phone || '')
      formData.append('address', JSON.stringify(userData.address || { line1: '', line2: '' }))
      formData.append('gender', userData.gender || 'Not Selected')
      formData.append('dob', userData.dob || '')

      if (image) formData.append('image', image)

      const { data } = await axios.post(`${backendUrl}/api/user/update-profile`, formData, { headers: { token } })

      if (data.success) {
        toast.success(data.message)
        await loadUserProfileData()
        setIsEdit(false)
        setImage(null)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  if (!userData) return null

  return (
    <main className='pb-12'>
      <section className='overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm'>
        <div className='bg-gradient-to-r from-teal-50 via-white to-blue-50 px-5 py-6 sm:px-7 lg:px-8'>
          <div className='flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'>
            <div className='flex flex-col gap-5 sm:flex-row sm:items-center'>
              <div className='relative h-32 w-32 shrink-0'>
                <img className='h-32 w-32 rounded-2xl border-4 border-white bg-gray-100 object-cover shadow-sm' src={imagePreview} alt={displayPersonName(userData.name) || t('Profile')} />
                {isEdit && (
                  <label className='absolute -bottom-2 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-primary-dark'>
                    <Camera className='h-4 w-4' />
                    {t('Change photo')}
                    <input type='file' accept='image/*' onChange={(e) => setImage(e.target.files?.[0] || null)} hidden />
                  </label>
                )}
              </div>

              <div className='min-w-0'>
                <div className='mb-2 flex flex-wrap items-center gap-2'>
                  <span className='rounded-full bg-white px-3 py-1 text-xs font-bold text-primary shadow-sm'>
                    {userData.patientId ? localizeDigits(String(userData.patientId)) : t('Patient profile')}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${userData.isActive === false ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {userData.isActive === false ? t('Inactive account') : t('Active account')}
                  </span>
                </div>
                {isEdit ? (
                  <input
                    className='w-full rounded-xl border border-teal-200 bg-white px-4 py-3 text-2xl font-bold text-gray-950 outline-none focus:ring-4 focus:ring-teal-100 sm:text-3xl'
                    type='text'
                    value={userData.name || ''}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder={t('Full name')}
                  />
                ) : (
                  <h1 className='break-words text-3xl font-bold text-gray-950'>{displayPersonName(userData.name)}</h1>
                )}
                <p className='mt-2 max-w-2xl text-sm text-gray-600'>
                  {t('Profile hero description')}
                </p>
              </div>
            </div>

            <div className='flex flex-wrap gap-2'>
              {isEdit ? (
                <>
                  <button onClick={cancelEdit} className='inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50'>
                    <X className='h-4 w-4' />
                    {t('Cancel')}
                  </button>
                  <button
                    onClick={updateUserProfileData}
                    disabled={saving}
                    className='inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-gray-400'
                  >
                    <Save className='h-4 w-4' />
                    {saving ? t('Saving...') : t('Save profile')}
                  </button>
                </>
              ) : (
                <button onClick={() => setIsEdit(true)} className='inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-dark'>
                  <UserRound className='h-4 w-4' />
                  {t('Edit profile')}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 border-t border-teal-100 lg:grid-cols-[minmax(0,1fr)_330px]'>
          <div className='space-y-5 p-5 sm:p-7 lg:p-8'>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              {[
                { labelKey: 'Upcoming visits', value: upcomingCount, icon: CalendarDays, color: 'bg-blue-50 text-blue-700' },
                { labelKey: 'Completed visits', value: completedAppointments, icon: BadgeCheck, color: 'bg-emerald-50 text-emerald-700' },
                { labelKey: 'Profile complete', value: formatPercent(completionPercent), icon: CheckCircle2, color: 'bg-teal-50 text-primary' },
              ].map(({ labelKey, value, icon: Icon, color }) => (
                <div key={labelKey} className='rounded-2xl border border-gray-100 bg-gray-50 p-4'>
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                    <Icon className='h-5 w-5' />
                  </div>
                  <p className='text-2xl font-bold text-gray-950'>{localizeDigits(String(value))}</p>
                  <p className='text-sm text-gray-500'>{t(labelKey)}</p>
                </div>
              ))}
            </div>

            <section className='rounded-2xl border border-gray-200 bg-white p-5'>
              <div className='mb-5 flex items-center justify-between gap-3'>
                <div>
                  <p className='text-xs font-bold uppercase tracking-wide text-gray-400'>{t('Contact Information')}</p>
                  <h2 className='text-lg font-bold text-gray-950'>{t('How the clinic reaches you')}</h2>
                </div>
                <Mail className='h-5 w-5 text-primary' />
              </div>

              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <Field label={t('Email address')}>
                  <ReadValue>{userData.email}</ReadValue>
                </Field>
                <Field label={t('Phone number')}>
                  {isEdit ? (
                    <input className='w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-teal-50' type='text' value={userData.phone || ''} onChange={(e) => setField('phone', e.target.value)} />
                  ) : (
                    <ReadValue muted={!userData.phone || userData.phone === '000000000'}>{cleanValue(userData.phone === '000000000' ? '' : userData.phone)}</ReadValue>
                  )}
                </Field>
                <Field label={t('Address line 1')}>
                  {isEdit ? (
                    <input className='w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-teal-50' value={address.line1 || ''} onChange={(e) => setAddressField('line1', e.target.value)} placeholder={t('Street, building, area')} />
                  ) : (
                    <ReadValue muted={!address.line1}>{cleanValue(address.line1)}</ReadValue>
                  )}
                </Field>
                <Field label={t('Address line 2')}>
                  {isEdit ? (
                    <input className='w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-teal-50' value={address.line2 || ''} onChange={(e) => setAddressField('line2', e.target.value)} placeholder={t('Apartment, floor, landmark')} />
                  ) : (
                    <ReadValue muted={!address.line2}>{cleanValue(address.line2)}</ReadValue>
                  )}
                </Field>
              </div>
            </section>

            <section className='rounded-2xl border border-gray-200 bg-white p-5'>
              <div className='mb-5 flex items-center justify-between gap-3'>
                <div>
                  <p className='text-xs font-bold uppercase tracking-wide text-gray-400'>{t('Personal Details')}</p>
                  <h2 className='text-lg font-bold text-gray-950'>{t('Identity and basic care details')}</h2>
                </div>
                <ShieldCheck className='h-5 w-5 text-primary' />
              </div>

              <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                <Field label={t('Patient ID')}>
                  <ReadValue>{userData.patientId || t('Not assigned')}</ReadValue>
                </Field>
                <Field label={t('Gender')}>
                  {isEdit ? (
                    <select className='w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-teal-50' onChange={(e) => setField('gender', e.target.value)} value={userData.gender || 'Not Selected'}>
                      <option value='Not Selected'>{t('Prefer not to say')}</option>
                      <option value='Male'>{t('Male')}</option>
                      <option value='Female'>{t('Female')}</option>
                    </select>
                  ) : (
                    <ReadValue muted={!userData.gender || userData.gender === 'Not Selected'}>{genderLabel(userData.gender)}</ReadValue>
                  )}
                </Field>
                <Field label={t('Birth date')}>
                  {isEdit ? (
                    <input className='w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-teal-50' type='date' max={today} onChange={(e) => setField('dob', e.target.value)} value={userData.dob && userData.dob !== 'Not Selected' ? userData.dob : ''} />
                  ) : (
                    <ReadValue muted={!userData.dob || userData.dob === 'Not Selected'}>{formatDate(userData.dob)}</ReadValue>
                  )}
                </Field>
              </div>

              <div className='mt-4 rounded-2xl bg-teal-50 p-4 text-sm text-teal-900'>
                <p className='font-bold'>{t('Care note')}</p>
                <p className='mt-1'>
                  {userData.dob && userData.dob !== 'Not Selected'
                    ? fillT('{{n}} years approximate age', { n: calculateAge(userData.dob) })
                    : t('Birth date care hint')}
                </p>
              </div>
            </section>
          </div>

          <aside className='space-y-5 border-t border-gray-100 bg-gray-50 p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-6'>
            <section className='rounded-2xl border border-gray-200 bg-white p-5'>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='font-bold text-gray-950'>{t('Profile readiness')}</h2>
                <span className='rounded-full bg-primary px-3 py-1 text-xs font-bold text-white'>{formatPercent(completionPercent)}</span>
              </div>
              <div className='h-2 overflow-hidden rounded-full bg-gray-100'>
                <div className='h-full rounded-full bg-primary transition-all' style={{ width: `${completionPercent}%` }}></div>
              </div>
              <div className='mt-4 space-y-2'>
                {completionItems.map((item) => (
                  <div key={item.labelKey} className='flex items-center justify-between gap-3 text-sm'>
                    <span className='text-gray-600'>{t(item.labelKey)}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.complete ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.complete ? t('Done') : t('Missing')}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className='rounded-2xl border border-gray-200 bg-white p-5'>
              <div className='mb-4 flex items-start justify-between gap-3'>
                <div>
                  <h2 className='font-bold text-gray-950'>{t('Account security')}</h2>
                  <p className='mt-1 text-xs text-gray-500'>{t('Protect sign-in with an authenticator app.')}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${mfaStatus?.enabled ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {mfaStatus?.enabled ? t('MFA On') : t('MFA Off')}
                </span>
              </div>

              {mfaStatus?.required && (
                <p className='mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700'>
                  {t('MFA is required for this account.')}
                </p>
              )}

              {mfaSetup ? (
                <div className='space-y-3'>
                  <MfaSetupBox mode='setup' setup={mfaSetup} />
                  <input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={t('6-digit code')} className='w-full rounded-xl border border-gray-200 px-3 py-2.5 text-center text-sm font-bold tracking-[0.35em] outline-none focus:border-primary focus:ring-4 focus:ring-teal-50' inputMode='numeric' />
                  <button type='button' onClick={enableMfa} className='inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark'>
                    <ShieldCheck className='h-4 w-4' />
                    {t('Verify and enable')}
                  </button>
                </div>
              ) : (
                <div className='space-y-3'>
                  {!mfaStatus?.enabled && (
                    <button type='button' onClick={startMfaSetup} className='inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark disabled:bg-gray-300' disabled={mfaStatus?.canSelfManage === false && !mfaStatus?.required}>
                      <KeyRound className='h-4 w-4' />
                      {t('Set up authenticator')}
                    </button>
                  )}
                  {mfaStatus?.enabled && !mfaStatus?.required && (
                    <>
                      <input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={t('6-digit code')} className='w-full rounded-xl border border-gray-200 px-3 py-2.5 text-center text-sm font-bold tracking-[0.35em] outline-none focus:border-primary focus:ring-4 focus:ring-teal-50' inputMode='numeric' />
                      <button type='button' onClick={disableMfa} className='inline-flex w-full items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50'>
                        {t('Disable MFA')}
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>

            <section className='rounded-2xl border border-gray-200 bg-white p-5'>
              <h2 className='mb-4 font-bold text-gray-950'>{t('Connected care')}</h2>
              <div className='space-y-3'>
                <button onClick={() => navigate('/my-appointments')} className='flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-left transition hover:border-primary/30 hover:bg-teal-50'>
                  <CalendarDays className='h-5 w-5 text-primary' />
                  <span>
                    <span className='block text-sm font-bold text-gray-900'>{t('My Appointments')}</span>
                    <span className='block text-xs text-gray-500'>{t('View visits payment prescriptions')}</span>
                  </span>
                </button>
                <button onClick={() => navigate('/medical-history')} className='flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-left transition hover:border-primary/30 hover:bg-teal-50'>
                  <ClipboardList className='h-5 w-5 text-primary' />
                  <span>
                    <span className='block text-sm font-bold text-gray-900'>{t('Medical history')}</span>
                    <span className='block text-xs text-gray-500'>{t('Update allergies conditions notes')}</span>
                  </span>
                </button>
                <button onClick={() => navigate('/insurance')} className='flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-left transition hover:border-primary/30 hover:bg-teal-50'>
                  <CreditCard className='h-5 w-5 text-primary' />
                  <span>
                    <span className='block text-sm font-bold text-gray-900'>{userData.insurance?.enabled ? t('Edit insurance') : t('Add insurance')}</span>
                    <span className='block text-xs text-gray-500'>{userData.insurance?.enabled ? userData.insurance.idNumber : t('Attach medical card details')}</span>
                  </span>
                </button>
              </div>
            </section>

            <section className='rounded-2xl border border-gray-200 bg-white p-5'>
              <h2 className='mb-3 font-bold text-gray-950'>{t('Quick contact')}</h2>
              <div className='space-y-2 text-sm text-gray-600'>
                <p className='flex items-center gap-2'><Mail className='h-4 w-4 text-primary' /> {userData.email}</p>
                <p className='flex items-center gap-2'><Phone className='h-4 w-4 text-primary' /> {cleanValue(userData.phone === '000000000' ? '' : userData.phone)}</p>
                <p className='flex items-center gap-2'><MapPin className='h-4 w-4 text-primary' /> {address.line1 || address.line2 ? [address.line1, address.line2].filter(Boolean).join(', ') : t('Address not provided')}</p>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}

export default MyProfile
